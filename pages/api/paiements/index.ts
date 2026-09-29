import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generatePaiementCode } from '../../../lib/utils/codes';
import { getNextCommandeStatus } from '../../../lib/workflow';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';
import { RecuSchema, avancerSiJustifie } from '../../../lib/justificatifs';
import Paiement from '../../../models/Paiement';
import Decaissement from '../../../models/Decaissement';
import Commande from '../../../models/Commande';
import '../../../models/Fournisseur';
import '../../../models/Chantier';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const PaiementSchema = z.object({
  decaissement: z.string().min(1),
  montant: z.number().min(0),
  modePaiement: z.string().min(1),
  datePaiement: z.string().datetime().optional(),
  recuPhysique: RecuSchema.optional().or(z.literal('')),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('paiement', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const scope = await getChantierScope(req);
      const paiements = await Paiement.find(scopeFilter(scope))
        .select('-recuFournisseur -recuPhysique')
        .populate('commande', 'code statut')
        .populate('chantier', 'code nom')
        .populate('fournisseur', 'nom')
        .populate('effectuePar', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(paiements);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('paiement', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = PaiementSchema.parse(req.body);
      const isAdmin = req.user!.permissions.includes('admin.all');

      const existing = await Decaissement.findById(data.decaissement);
      if (!existing) return res.status(404).json({ error: 'Décaissement introuvable' });
      if (!isAdmin && existing.utilisateurReceptionnaire?.toString() !== req.user!.userId) {
        return res.status(403).json({ error: 'Ce décaissement a été remis à un autre réceptionniste' });
      }

      const commande = await Commande.findById(existing.commande);
      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
      if (!inScope(await getChantierScope(req), commande.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      if (commande.statut !== 'RECEPTION_RC') {
        return res.status(400).json({ error: `Paiement impossible pour une commande en statut ${commande.statut}` });
      }

      // Réservation atomique : un décaissement ne peut être consommé qu'une seule fois
      const decaissement = await Decaissement.findOneAndUpdate(
        { _id: existing._id, statut: { $in: ['Autorisé', 'Remis'] } },
        { $set: { statut: 'Payé' } },
        { new: true }
      );
      if (!decaissement) {
        return res.status(409).json({ error: 'Ce décaissement a déjà été payé' });
      }

      let paiement;
      try {
        const now = new Date();
        paiement = await Paiement.create({
          code: await generatePaiementCode(),
          decaissement: decaissement._id,
          commande: commande._id,
          chantier: commande.chantier,
          montant: data.montant,
          fournisseur: commande.fournisseur,
          datePaiement: data.datePaiement ? new Date(data.datePaiement) : now,
          modePaiement: data.modePaiement,
          recuPhysique: data.recuPhysique || undefined,
          recuPhysiqueDate: data.recuPhysique ? now : undefined,
          effectuePar: req.user!.userId,
          statut: 'Effectué',
        });
      } catch (err) {
        await Decaissement.updateOne({ _id: decaissement._id }, { $set: { statut: existing.statut } });
        if ((err as { code?: number }).code === 11000) {
          return res.status(409).json({ error: 'Un paiement existe déjà pour ce décaissement' });
        }
        throw err;
      }

      const nextStatus = getNextCommandeStatus(commande.statut, 'EFFECTUER_PAIEMENT');
      if (nextStatus) {
        commande.statut = nextStatus as 'PAIEMENT' | 'JUSTIFICATIFS';
        await commande.save();
      }
      await avancerSiJustifie(commande);

      const anomalie = data.montant !== decaissement.montant;
      if (anomalie) {
        await logAction('Anomalie détectée', 'Paiement', {
          targetId: paiement._id.toString(),
          targetCode: paiement.code,
          details: {
            ecart: data.montant - decaissement.montant,
            montantPaiement: data.montant,
            montantDecaissement: decaissement.montant,
          },
          req,
        });
      }

      await logAction('Paiement', 'Paiement', {
        targetId: paiement._id.toString(),
        targetCode: paiement.code,
        details: {
          montant: paiement.montant,
          commande: commande.code,
          decaissement: decaissement.code,
          mode: paiement.modePaiement,
          recuPhysique: Boolean(data.recuPhysique),
        },
        req,
      });

      return res.status(201).json({
        id: paiement._id.toString(),
        code: paiement.code,
        statut: paiement.statut,
        statutCommande: commande.statut,
        anomalie,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
