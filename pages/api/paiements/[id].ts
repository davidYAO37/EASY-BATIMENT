import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope } from '../../../lib/scope';
import { RecuSchema, avancerSiJustifie } from '../../../lib/justificatifs';
import Paiement from '../../../models/Paiement';
import Commande from '../../../models/Commande';
import '../../../models/Fournisseur';
import '../../../models/Chantier';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const RecuBodySchema = z.object({
  recuPhysique: RecuSchema,
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('paiement', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const paiement = await Paiement.findById(id)
        .populate('commande', 'code')
        .populate('chantier')
        .populate('fournisseur', 'nom')
        .lean();

      if (!paiement) return res.status(404).json({ error: 'Paiement introuvable' });
      if (!inScope(await getChantierScope(req), paiement.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      return res.status(200).json(paiement);
    } catch (error) {
      return handleError(res, error);
    }
  }

  // Transmission du reçu physique par le RC après le paiement
  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('paiement', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = RecuBodySchema.parse(req.body);
      const paiement = await Paiement.findById(id);
      if (!paiement) return res.status(404).json({ error: 'Paiement introuvable' });
      if (!inScope(await getChantierScope(req), paiement.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      if (paiement.statut !== 'Effectué') {
        return res.status(400).json({ error: 'Ce paiement a déjà été contrôlé' });
      }

      paiement.recuPhysique = data.recuPhysique;
      paiement.recuPhysiqueDate = new Date();
      await paiement.save();

      const commande = await Commande.findById(paiement.commande);
      const avance = commande ? await avancerSiJustifie(commande) : false;

      await logAction('Transmission reçu physique', 'Paiement', {
        targetId: paiement._id.toString(),
        targetCode: paiement.code,
        details: { commande: commande?.code, statutCommande: commande?.statut, justificatifsComplets: avance },
        req,
      });

      return res.status(200).json({ id: paiement._id.toString(), statutCommande: commande?.statut });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
