import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import Article from '../../../models/Article';

const UpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  unite: z.string().min(1).optional(),
  categorie: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('article', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const article = await Article.findById(id).lean();
      if (!article) return res.status(404).json({ error: 'Article introuvable' });
      return res.status(200).json(article);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('article', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = UpdateSchema.parse(req.body);
      const article = await Article.findByIdAndUpdate(id, data, { new: true });
      if (!article) return res.status(404).json({ error: 'Article introuvable' });

      await logAction('Modification', 'Article', {
        targetId: article._id.toString(),
        targetCode: article.nom,
        details: data,
        req,
      });

      return res.status(200).json(article);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('article', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const article = await Article.findByIdAndDelete(id);
      if (!article) return res.status(404).json({ error: 'Article introuvable' });

      await logAction('Suppression', 'Article', {
        targetId: article._id.toString(),
        targetCode: article.nom,
        req,
      });

      return res.status(204).end();
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
