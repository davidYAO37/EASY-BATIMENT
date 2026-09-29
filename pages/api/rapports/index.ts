import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import RapportChantier, { IRapportChantier } from '../../../models/RapportChantier';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';

const PhotoSchema = z.object({
  type: z.string().min(1),
  url: z.string().min(1),
  legende: z.string().optional(),
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
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      const result = (rapports as unknown as IRapportChantier[]).map((r) => ({
        ...r,
        isRead: r.luPar?.some((id) => id.toString() === req.user!.userId),
      }));

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

    try {
      const data = RapportSchema.parse(req.body);
      if (!inScope(await getChantierScope(req), data.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      const rapport = await RapportChantier.create({
        ...data,
        date: data.date ? new Date(data.date) : new Date(),
        createdBy: req.user!.userId,
      });

      await logAction('Création', 'RapportChantier', {
        targetId: rapport._id.toString(),
        details: { chantier: data.chantier },
        req,
      });

      return res.status(201).json(rapport);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
