import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generateCommandeCode } from '../../../lib/utils/codes';
import { logAction } from '../../../lib/audit';
import { getChantierScope, scopeFilter } from '../../../lib/scope';
import Commande from '../../../models/Commande';
import DemandeAchat from '../../../models/DemandeAchat';
import Fournisseur from '../../../models/Fournisseur';
import '../../../models/Article';

const LigneSchema = z.object({
  article: z.string().min(1),
  designation: z.string().optional(),
  quantite: z.number().min(1),
  prixUnitaire: z.number().min(0),
});

const CommandeSchema = z.object({
  demandeAchat: z.string().min(1),
  fournisseur: z.string().min(1),
  articles: z.array(LigneSchema).min(1),
  modePaiement: z.string().min(1),
  dateCommande: z.string().datetime(),
  datePrevueLivraison: z.string().datetime().optional(),
  bonCommande: z.string().optional(),
  facture: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('commande', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const scope = await getChantierScope(req);
      const commandes = await Commande.find(scopeFilter(scope))
        .select('-recuFournisseur')
        .populate('chantier', 'code nom receptionnisteChantier')
        .populate('fournisseur', 'nom')
        .populate('demandeAchat', 'code')
        .populate('articles.article', 'nom unite')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(commandes);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('commande', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = CommandeSchema.parse(req.body);

      const demande = await DemandeAchat.findById(data.demandeAchat);
      if (!demande) return res.status(404).json({ error: 'Demande introuvable' });
      if (!['FINANCE_AUTORISEE', 'COMMANDE_PARTIELLE'].includes(demande.statut)) {
        return res.status(400).json({
          error: 'La demande doit être au moins en commande partielle pour créer une commande',
        });
      }

      const restantes = (demande.articles || [])
        .map((l, i) => ({ l, i }))
        .filter(({ l }) => !l.commande);
      const idsRestants = new Set(restantes.map(({ l }) => String(l.article)));
      const idsDemandes = new Set(data.articles.map((l) => l.article));
      if (!idsDemandes.size || ![...idsDemandes].every((a) => idsRestants.has(a))) {
        return res.status(400).json({
          error: 'Seules les lignes non encore commandées de la demande peuvent être commandées',
        });
      }

      const fournisseur = await Fournisseur.findById(data.fournisseur);
      if (!fournisseur) return res.status(404).json({ error: 'Fournisseur introuvable' });

      const montant = data.articles.reduce((acc, l) => acc + l.quantite * l.prixUnitaire, 0);
      const code = await generateCommandeCode();

      const commande = await Commande.create({
        code,
        demandeAchat: data.demandeAchat,
        chantier: demande.chantier,
        fournisseur: data.fournisseur,
        articles: data.articles.map((l) => ({
          ...l,
          total: l.quantite * l.prixUnitaire,
        })),
        montant,
        modePaiement: data.modePaiement,
        dateCommande: new Date(data.dateCommande),
        datePrevueLivraison: data.datePrevueLivraison ? new Date(data.datePrevueLivraison) : undefined,
        bonCommande: data.bonCommande,
        facture: data.facture,
        statut: 'COMMANDE_FOURNISSEUR',
        createdBy: req.user!.userId,
      });

      const mark: Record<string, unknown> = {};
      for (const { l, i } of restantes) {
        if (idsDemandes.has(String(l.article))) mark[`articles.${i}.commande`] = commande._id;
      }
      mark.statut = restantes.length === idsDemandes.size ? 'FINANCE_AUTORISEE' : 'COMMANDE_PARTIELLE';
      await DemandeAchat.updateOne({ _id: demande._id }, { $set: mark });

      await logAction('Création', 'Commande', {
        targetId: commande._id.toString(),
        targetCode: commande.code,
        details: {
          demandeAchat: demande.code,
          montant: commande.montant,
          fournisseur: fournisseur.nom,
        },
        req,
      });

      return res.status(201).json({
        id: commande._id.toString(),
        code: commande.code,
        statut: commande.statut,
        montant: commande.montant,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
