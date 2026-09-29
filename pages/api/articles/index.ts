import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import Article from '../../../models/Article';

const ArticleSchema = z.object({
  nom: z.string().min(1),
  unite: z.string().min(1),
  categorie: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('article', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const articles = await Article.find().sort({ nom: 1 }).lean();
      return res.status(200).json(articles);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('article', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = ArticleSchema.parse(req.body);
      const article = await Article.create(data);

      await logAction('Création', 'Article', {
        targetId: article._id.toString(),
        targetCode: article.nom,
        req,
      });

      return res.status(201).json(article);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
