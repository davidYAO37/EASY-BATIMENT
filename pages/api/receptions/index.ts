import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generateReceptionCode } from '../../../lib/utils/codes';
import { getNextCommandeStatus } from '../../../lib/workflow';
import type { CommandeStatus } from '../../../models/Commande';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';
import Reception from '../../../models/Reception';
import Commande from '../../../models/Commande';
import MouvementStock from '../../../models/MouvementStock';

const LigneSchema = z.object({
  article: z.string().min(1),
  recu: z.number().min(0),
  etat: z.enum(['Conforme', 'Manquant', 'Endommagé', 'Non conforme', 'Livraison partielle', 'Autre']),
  commentaire: z.string().optional(),
  photos: z.array(z.string()).optional(),
});

const ReceptionSchema = z.object({
  commande: z.string().min(1),
  dateReception: z.string().datetime().optional(),
  observation: z.string().optional(),
  lignes: z.array(LigneSchema).min(1),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('reception', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const receptions = await Reception.find(scopeFilter(await getChantierScope(req)))
        .populate('commande', 'code')
        .populate('chantier', 'code nom')
        .populate('recuPar', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(receptions);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('reception', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = ReceptionSchema.parse(req.body);

      const commande = await Commande.findById(data.commande);
      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
      if (!inScope(await getChantierScope(req), commande.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      if (!['COMMANDE_FOURNISSEUR', 'LIVRAISON'].includes(commande.statut)) {
        return res.status(400).json({
          error: `Réception impossible pour une commande en statut ${commande.statut}`,
        });
      }

      const commandeLignes = commande.articles;

      for (const ligne of data.lignes) {
        const cmd = commandeLignes.find((c) => c.article.toString() === ligne.article);
        if (!cmd) {
          return res.status(400).json({
            error: `Article ${ligne.article} ne fait pas partie de la commande`,
          });
        }

        if (ligne.recu !== cmd.quantite && ligne.etat === 'Conforme') {
          return res.status(400).json({
            error: `Article ${ligne.article} : quantité reçue diffère de la commande. L'état ne peut pas être Conforme.`,
          });
        }

        if (ligne.recu === cmd.quantite && ligne.etat !== 'Conforme') {
          return res.status(400).json({
            error: `Article ${ligne.article} : quantité reçue identique à la commande. L'état doit être Conforme.`,
          });
        }
      }

      const statutPrecedent = commande.statut;
      const nextStatus = getNextCommandeStatus(statutPrecedent, 'RECEVOIR_LIVRAISON');
      if (!nextStatus) return res.status(400).json({ error: 'Transition de statut impossible' });
      const claimed = await Commande.updateOne(
        { _id: commande._id, statut: statutPrecedent },
        { $set: { statut: nextStatus, updatedBy: req.user!.userId } }
      );
      if (claimed.modifiedCount === 0) {
        return res.status(409).json({ error: 'Cette commande a déjà été réceptionnée' });
      }
      commande.statut = nextStatus as CommandeStatus;

      const reception = await Reception.create({
        code: await generateReceptionCode(),
        commande: commande._id,
        chantier: commande.chantier,
        fournisseur: commande.fournisseur,
        lignes: data.lignes.map((l) => {
          const cmd = commandeLignes.find((c) => c.article.toString() === l.article)!;
          return {
            ...l,
            commande: cmd.quantite,
            designation: undefined,
          };
        }),
        dateReception: data.dateReception ? new Date(data.dateReception) : new Date(),
        recuPar: req.user!.userId,
        observation: data.observation,
      });

      for (const ligne of data.lignes) {
        await MouvementStock.create({
          chantier: commande.chantier,
          article: ligne.article,
          type: 'Entrée',
          quantite: ligne.recu,
          motif: `Réception commande ${commande.code}`,
          utilisateur: req.user!.userId,
          reference: reception.code,
          date: new Date(),
        });
      }

      await logAction('Réception matériel', 'Reception', {
        targetId: reception._id.toString(),
        targetCode: reception.code,
        details: {
          commande: commande.code,
          statutCommande: commande.statut,
        },
        req,
      });

      return res.status(201).json({
        id: reception._id.toString(),
        code: reception.code,
        commande: commande.code,
        statut: commande.statut,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
