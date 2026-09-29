import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import MouvementStock, { IMouvementStock } from '../../../models/MouvementStock';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';

const MouvementSchema = z.object({
  chantier: z.string().min(1),
  article: z.string().min(1),
  type: z.enum(['Entrée', 'Sortie', 'Transfert']),
  quantite: z.number().min(0),
  motif: z.string().min(1),
  reference: z.string().optional(),
  date: z.string().datetime().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('stock', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const { chantier } = req.query;
      const scope = await getChantierScope(req);
      if (chantier && !Array.isArray(chantier) && !inScope(scope, chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      const query = chantier && !Array.isArray(chantier) ? { chantier } : scopeFilter(scope);
      const mouvements = await MouvementStock.find(query)
        .populate('article', 'nom unite')
        .populate('utilisateur', 'firstName lastName')
        .sort({ date: -1 })
        .lean();

      return res.status(200).json(mouvements);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('stock', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = MouvementSchema.parse(req.body);
      if (!inScope(await getChantierScope(req), data.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      if (data.type === 'Sortie') {
        const entrees = await MouvementStock.find({
          chantier: data.chantier,
          article: data.article,
          type: 'Entrée',
        }).lean<IMouvementStock[]>();
        const sorties = await MouvementStock.find({
          chantier: data.chantier,
          article: data.article,
          type: 'Sortie',
        }).lean<IMouvementStock[]>();

        const totalEntree = entrees.reduce((acc: number, m) => acc + m.quantite, 0);
        const totalSortie = sorties.reduce((acc: number, m) => acc + m.quantite, 0);

        if (data.quantite > totalEntree - totalSortie) {
          return res.status(400).json({ error: 'Stock insuffisant pour cette sortie' });
        }
      }

      const mouvement = await MouvementStock.create({
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        utilisateur: req.user!.userId,
      });

      await logAction(data.type, 'MouvementStock', {
        targetId: mouvement._id.toString(),
        details: {
          chantier: data.chantier,
          article: data.article,
          quantite: data.quantite,
          type: data.type,
        },
        req,
      });

      return res.status(201).json(mouvement);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
