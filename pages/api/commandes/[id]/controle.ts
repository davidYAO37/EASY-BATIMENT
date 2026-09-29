import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../../lib/permissions';
import { logAction } from '../../../../lib/audit';
import Commande from '../../../../models/Commande';
import Paiement from '../../../../models/Paiement';

const ControleSchema = z
  .object({
    action: z.enum(['VALIDER', 'ANOMALIE']),
    commentaire: z.string().optional(),
  })
  .refine((d) => d.action !== 'ANOMALIE' || Boolean(d.commentaire?.trim()), {
    message: 'Un commentaire est requis pour signaler une anomalie',
    path: ['commentaire'],
  });

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('admin', 'all'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  try {
    const data = ControleSchema.parse(req.body);

    const commande = await Commande.findById(id);
    if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

    if (commande.statut !== 'JUSTIFICATIFS' && commande.statut !== 'CONTROLE_ADMIN') {
      return res.status(400).json({
        error: `Contrôle impossible pour une commande en statut ${commande.statut}`,
      });
    }

    const paiement = await Paiement.findOne({ commande: commande._id }).sort({ createdAt: -1 });
    if (!paiement) return res.status(400).json({ error: 'Aucun paiement trouvé pour cette commande' });

    const ecart = Math.abs(paiement.montant - commande.montant);
    const recuFournisseur = Boolean(commande.recuFournisseur || paiement.recuFournisseur);
    const recuPhysique = Boolean(paiement.recuPhysique);
    const conforme =
      ecart === 0 &&
      recuFournisseur &&
      recuPhysique &&
      paiement.fournisseur.toString() === commande.fournisseur.toString();

    let actionLabel = '';
    if (data.action === 'VALIDER') {
      if (!conforme) {
        return res.status(400).json({
          error: 'Validation refusée : un ou plusieurs justificatifs sont non conformes',
          details: { ecart, recuFournisseur, recuPhysique },
        });
      }
      commande.statut = 'CLOTURE';
      actionLabel = 'Validation dépense';
      paiement.statut = 'Contrôlé';
    } else {
      commande.statut = 'ANOMALIE';
      actionLabel = 'Anomalie';
      paiement.statut = 'Anomalie';
    }

    await commande.save();
    await paiement.save();

    await logAction(actionLabel, 'Commande', {
      targetId: commande._id.toString(),
      targetCode: commande.code,
      details: {
        statutCommande: commande.statut,
        ecart,
        conforme,
        commentaire: data.commentaire,
      },
      req,
    });

    return res.status(200).json({
      id: commande._id.toString(),
      code: commande.code,
      statut: commande.statut,
      conforme,
      ecart,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
