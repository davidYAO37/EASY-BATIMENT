import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generateDecaissementCode } from '../../../lib/utils/codes';
import { logAction } from '../../../lib/audit';
import Decaissement from '../../../models/Decaissement';
import Commande from '../../../models/Commande';
import '../../../models/Chantier';
import User from '../../../models/User';
import { getChantierScope, scopeFilter } from '../../../lib/scope';

const DecaissementSchema = z.object({
  commande: z.string().min(1),
  montant: z.number().min(0),
  beneficiaire: z.string().min(1),
  motif: z.string().min(1),
  utilisateurReceptionnaire: z.string().min(1),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('decaissement', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const scope = await getChantierScope(req);
      const decaissements = await Decaissement.find(scopeFilter(scope))
        .populate('commande', 'code statut montant')
        .populate('chantier', 'code nom')
        .populate('utilisateurAutorisateur', 'firstName lastName')
        .populate('utilisateurReceptionnaire', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(decaissements);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('decaissement', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = DecaissementSchema.parse(req.body);

      const commande = await Commande.findById(data.commande);
      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
      if (commande.statut !== 'RECEPTION_RC') {
        return res.status(400).json({
          error: `Décaissement impossible : la commande doit être réceptionnée (statut actuel ${commande.statut})`,
        });
      }
      if (await Decaissement.exists({ commande: commande._id })) {
        return res.status(409).json({ error: 'Un décaissement existe déjà pour cette commande' });
      }
      if (!(await User.exists({ _id: data.utilisateurReceptionnaire, active: true }))) {
        return res.status(400).json({ error: 'Réceptionnaire introuvable ou inactif' });
      }

      let decaissement;
      try {
        decaissement = await Decaissement.create({
          code: await generateDecaissementCode(),
          montant: data.montant,
          commande: commande._id,
          chantier: commande.chantier,
          beneficiaire: data.beneficiaire,
          motif: data.motif,
          utilisateurAutorisateur: req.user!.userId,
          utilisateurReceptionnaire: data.utilisateurReceptionnaire,
          date: new Date(),
          statut: 'Autorisé',
        });
      } catch (err) {
        if ((err as { code?: number }).code === 11000) {
          return res.status(409).json({ error: 'Un décaissement existe déjà pour cette commande' });
        }
        throw err;
      }

      await logAction('Autorisation finance', 'Decaissement', {
        targetId: decaissement._id.toString(),
        targetCode: decaissement.code,
        details: {
          montant: decaissement.montant,
          commande: commande.code,
          beneficiaire: decaissement.beneficiaire,
        },
        req,
      });

      return res.status(201).json({
        id: decaissement._id.toString(),
        code: decaissement.code,
        montant: decaissement.montant,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
