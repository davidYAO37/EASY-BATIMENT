import type { NextApiResponse } from 'next';
import { z } from 'zod';
import mongoose from 'mongoose';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import RapportChantier, { IRapportChantier } from '../../../models/RapportChantier';
import MouvementStock from '../../../models/MouvementStock';
import Article from '../../../models/Article';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';

const PhotoSchema = z.object({
  type: z.string().min(1),
  url: z.string().min(1),
  legende: z.string().optional(),
});

const InventoryLineSchema = z.object({
  article: z.string().min(1),
  type: z.enum(['Entrée', 'Sortie', 'Transfert']),
  quantite: z.number().min(0),
  motif: z.string().min(1),
  reference: z.string().optional(),
  stockTheorique: z.number().min(0).optional(),
  stockReel: z.number().min(0).optional(),
});

const RapportSchema = z.object({
  chantier: z.string().min(1),
  date: z.string().datetime().optional(),
  activite: z.string().min(1),
  travauxRealises: z.string().min(1),
  personnelPresent: z.string().min(1),
  materielUtilise: z.string().min(1),
  difficultes: z.string().optional(),
  incidents: z.string().optional(),
  besoins: z.string().optional(),
  observations: z.string().optional(),
  photos: z.array(PhotoSchema).optional(),
  mouvements: z.array(InventoryLineSchema).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('rapport', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const { chantier, nonLu } = req.query;
      const scope = await getChantierScope(req);
      if (chantier && !Array.isArray(chantier) && !inScope(scope, chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      const query: Record<string, unknown> = scopeFilter(scope);
      if (chantier && !Array.isArray(chantier)) query.chantier = chantier;

      const rapports = await RapportChantier.find(query)
        .populate('chantier', 'code nom')
        .populate('createdBy', '_id firstName lastName')
        .populate({
          path: 'mouvements',
          populate: { path: 'article', select: 'nom unite' },
        })
        .sort({ createdAt: -1 })
        .lean();

      const result = (rapports as unknown as IRapportChantier[]).map((r) => {
        const luPar = (r.luPar || []).map((id) => id.toString());
        const createdById = (r as unknown as { createdBy?: { _id?: string } }).createdBy?._id?.toString();
        return {
          ...r,
          isRead: luPar.includes(req.user!.userId),
          modifiable: luPar.length === 0 && createdById === req.user!.userId,
        };
      });

      if (nonLu === 'true') {
        return res.status(200).json(result.filter((r) => !r.isRead));
      }

      return res.status(200).json(result);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('rapport', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    let rapport: (typeof RapportChantier)['prototype'] | null = null;
    const createdMovementIds: string[] = [];

    try {
      const data = RapportSchema.parse(req.body);
      if (!inScope(await getChantierScope(req), data.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      if (data.mouvements && data.mouvements.length > 0) {
        const canStock = await hasPermission(req.user!.role, buildPermission('stock', 'create'));
        if (!canStock) {
          return res.status(403).json({ error: 'Permission refusée pour créer des mouvements de stock' });
        }
        const articleIds = data.mouvements.map((m) => m.article);
        const existingCount = await Article.countDocuments({ _id: { $in: articleIds } });
        if (existingCount !== articleIds.length) {
          throw new Error('Un ou plusieurs articles sont invalides');
        }
      }

      const { mouvements: mouvementsInput, ...rapportData } = data;
      rapport = await new RapportChantier({
        ...rapportData,
        date: data.date ? new Date(data.date) : new Date(),
        createdBy: req.user!.userId,
      }).save();

      if (mouvementsInput && mouvementsInput.length > 0) {
        for (const m of mouvementsInput) {
          const mv = await new MouvementStock({
            chantier: data.chantier,
            article: m.article,
            type: m.type,
            quantite: m.quantite,
            motif: m.motif,
            reference: m.reference || '',
            stockTheorique: m.stockTheorique,
            stockReel: m.stockReel,
            utilisateur: req.user!.userId,
            date: new Date(),
          }).save();
          createdMovementIds.push(mv._id.toString());
        }
      }

      if (createdMovementIds.length > 0) {
        rapport.mouvements = createdMovementIds.map((id) => new mongoose.Types.ObjectId(id));
        await rapport.save();
      }

      await logAction('Création', 'RapportChantier', {
        targetId: rapport._id.toString(),
        details: { chantier: data.chantier, mouvements: createdMovementIds.length },
        req,
      });

      return res.status(201).json(rapport);
    } catch (error) {
      // Rollback manuel : base non-replica set, pas de transactions
      if (createdMovementIds.length > 0) {
        await MouvementStock.deleteMany({ _id: { $in: createdMovementIds } });
      }
      if (rapport) {
        await RapportChantier.findByIdAndDelete(rapport._id);
      }
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
