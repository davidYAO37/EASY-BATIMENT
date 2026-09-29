import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { z } from 'zod';
import { dbConnect } from '../../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../../lib/api/middleware';
import { hasPermission } from '../../../../lib/permissions';
import { getNextDemandeAchatStatus, getRequiredPermission, WorkflowAction } from '../../../../lib/workflow';
import { logAction } from '../../../../lib/audit';
import { generateCommandeCode } from '../../../../lib/utils/codes';
import DemandeAchat, { DemandeAchatStatus, ILigneDemande } from '../../../../models/DemandeAchat';
import Commande, { ICommande } from '../../../../models/Commande';
import Fournisseur from '../../../../models/Fournisseur';

const ActionSchema = z.object({
  action: z.enum([
    'SOUMETTRE',
    'RECEVOIR',
    'TRANSMETTRE_ADMIN',
    'VALIDER',
    'COMMANDER',
    'REFUSER',
    'DEMANDER_MODIFICATION',
  ]),
  commentaire: z.string().optional(),
  fournisseur: z.string().optional(),
  lignes: z.array(z.number().int().min(0)).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    const data = ActionSchema.parse(req.body);

    const demande = await DemandeAchat.findById(id);
    if (!demande) return res.status(404).json({ error: 'Demande introuvable' });

    const nextStatus = getNextDemandeAchatStatus(demande.statut, data.action as WorkflowAction);
    if (!nextStatus) {
      return res.status(400).json({
        error: `Action ${data.action} impossible depuis le statut ${demande.statut}`,
      });
    }

    const requiredPermission = getRequiredPermission(demande.statut, data.action as WorkflowAction);
    if (requiredPermission) {
      const allowed = await hasPermission(req.user!.role, requiredPermission);
      if (!allowed) return res.status(403).json({ error: 'Permission refusée' });
    }

    let commandeCreee: ICommande | null = null;
    let fournisseur: { _id: mongoose.Types.ObjectId; nom: string } | null = null;
    let lignesACommander: number[] = [];

    if (data.action === 'VALIDER' || data.action === 'COMMANDER') {
      let fournisseurId = demande.fournisseur?.toString();
      if (!fournisseurId && data.fournisseur) {
        fournisseurId = data.fournisseur;
      }
      if (!fournisseurId) {
        return res.status(400).json({
          error: 'Un fournisseur du catalogue est requis pour générer la commande',
        });
      }

      const doc = await Fournisseur.findById(fournisseurId).lean();
      if (!doc) {
        return res.status(404).json({ error: 'Fournisseur introuvable' });
      }
      fournisseur = doc as unknown as { _id: mongoose.Types.ObjectId; nom: string };

      const restantes = (demande.articles || [])
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => !l.commande)
        .map(({ i }) => i);

      if (data.action === 'VALIDER') {
        lignesACommander = restantes;
      } else if (data.lignes?.length) {
        const set = new Set(data.lignes);
        lignesACommander = restantes.filter((i) => set.has(i));
        if (lignesACommander.length !== set.size) {
          return res.status(400).json({ error: 'Certaines lignes sont déjà commandées ou inexistantes' });
        }
      } else {
        lignesACommander = restantes.filter((i) => demande.articles[i].priorite);
      }
      if (!lignesACommander.length) {
        return res.status(400).json({ error: 'Aucune ligne à commander (cochez des priorités ou des lignes)' });
      }
    }

    // Transition atomique : empêche un double traitement (double-clic, deux onglets)
    const statutPrecedent = demande.statut;
    const isCommande = data.action === 'VALIDER' || data.action === 'COMMANDER';

    let statutFinal: string = nextStatus;
    if (isCommande) {
      const restantesApres = (demande.articles || []).filter(
        (l, i) => !l.commande && !lignesACommander.includes(i)
      ).length;
      statutFinal = restantesApres > 0 ? 'COMMANDE_PARTIELLE' : 'FINANCE_AUTORISEE';
    }

    const filter: Record<string, unknown> = { _id: demande._id, statut: statutPrecedent };
    if (data.action === 'COMMANDER') {
      for (const i of lignesACommander) filter[`articles.${i}.commande`] = null;
    }
    const update: Record<string, unknown> = { statut: statutFinal, updatedBy: req.user!.userId };
    if (fournisseur) update.fournisseur = fournisseur._id;
    const claimed = await DemandeAchat.updateOne(filter, { $set: update });
    if (claimed.modifiedCount === 0) {
      return res.status(409).json({ error: 'Cette demande a déjà été traitée par un autre utilisateur' });
    }
    demande.statut = statutFinal as DemandeAchatStatus;

    if (isCommande && fournisseur) {
      const lignesSel = lignesACommander.map((i) => demande.articles[i]);
      const montant = lignesSel.reduce(
        (acc: number, l: ILigneDemande) => acc + l.quantite * l.prixEstimatif,
        0
      );

      try {
        commandeCreee = await Commande.create({
          code: await generateCommandeCode(),
          demandeAchat: demande._id,
          chantier: demande.chantier,
          fournisseur: fournisseur._id,
          articles: lignesSel.map((l: ILigneDemande) => ({
            article: l.article,
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixEstimatif,
            total: l.quantite * l.prixEstimatif,
          })),
          montant,
          modePaiement: 'Espèces',
          dateCommande: new Date(),
          datePrevueLivraison: demande.dateSouhaitee,
          statut: 'COMMANDE_FOURNISSEUR',
          createdBy: req.user!.userId as unknown as mongoose.Types.ObjectId,
        });
        const mark: Record<string, unknown> = {};
        for (const i of lignesACommander) mark[`articles.${i}.commande`] = commandeCreee._id;
        await DemandeAchat.updateOne({ _id: demande._id }, { $set: mark });
      } catch (err) {
        await DemandeAchat.updateOne({ _id: demande._id }, { $set: { statut: statutPrecedent } });
        throw err;
      }

      await logAction('Création', 'Commande', {
        targetId: commandeCreee._id.toString(),
        targetCode: commandeCreee.code,
        details: {
          demandeAchat: demande.code,
          montant: commandeCreee.montant,
          fournisseur: fournisseur.nom,
        },
        req,
      });
    }

    await logAction(data.action, 'DemandeAchat', {
      targetId: demande._id.toString(),
      targetCode: demande.code,
      details: {
        statutPrecedent,
        nouveauStatut: statutFinal,
        commentaire: data.commentaire,
        commande: commandeCreee?.code,
        lignesCommandees: lignesACommander.length || undefined,
      },
      req,
    });

    const result: Record<string, unknown> = {
      id: demande._id.toString(),
      code: demande.code,
      statut: demande.statut,
    };
    if (commandeCreee) {
      result.commande = commandeCreee.code;
      result.commandeId = commandeCreee._id.toString();
    }

    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
