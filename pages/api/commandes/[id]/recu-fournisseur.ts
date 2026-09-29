import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { z } from 'zod';
import { dbConnect } from '../../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../../lib/permissions';
import { logAction } from '../../../../lib/audit';
import { getChantierScope, inScope } from '../../../../lib/scope';
import { RecuSchema, avancerSiJustifie } from '../../../../lib/justificatifs';
import Commande from '../../../../models/Commande';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

const BodySchema = z.object({ recuFournisseur: RecuSchema });

const STATUTS_AUTORISES = ['COMMANDE_FOURNISSEUR', 'LIVRAISON', 'RECEPTION_RC', 'PAIEMENT'];

// Le RB transmet à l'administrateur l'image du reçu envoyée par le fournisseur
async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('commande', 'update'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    const data = BodySchema.parse(req.body);
    const commande = await Commande.findById(id);
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
    if (!inScope(await getChantierScope(req), commande.chantier)) {
      return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
    }
    if (!STATUTS_AUTORISES.includes(commande.statut)) {
      return res.status(400).json({ error: `Reçu non modifiable pour une commande en statut ${commande.statut}` });
    }

    const remplacement = Boolean(commande.recuFournisseurDate);
    commande.recuFournisseur = data.recuFournisseur;
    commande.recuFournisseurDate = new Date();
    commande.recuFournisseurPar = req.user!.userId as unknown as mongoose.Types.ObjectId;
    commande.updatedBy = req.user!.userId as unknown as mongoose.Types.ObjectId;
    await commande.save();

    const avance = await avancerSiJustifie(commande);

    await logAction(remplacement ? 'Remplacement reçu fournisseur' : 'Transmission reçu fournisseur', 'Commande', {
      targetId: commande._id.toString(),
      targetCode: commande.code,
      details: { statutCommande: commande.statut, justificatifsComplets: avance },
      req,
    });

    return res.status(200).json({ id: commande._id.toString(), statut: commande.statut });
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
