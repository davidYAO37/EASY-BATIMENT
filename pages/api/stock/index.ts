import type { NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import MouvementStock from '../../../models/MouvementStock';
import { getChantierScope, inScope, scopeFilter } from '../../../lib/scope';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('stock', 'read'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  try {
    const { chantier } = req.query;
    const scope = await getChantierScope(req);
    if (chantier && !Array.isArray(chantier) && !inScope(scope, chantier)) {
      return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
    }
    const match = chantier && !Array.isArray(chantier) ? { chantier } : scopeFilter(scope);

    const mouvements = await MouvementStock.find(match).lean();

    const stock: Record<string, { article: string; entree: number; sortie: number; stock: number }> = {};

    for (const m of mouvements) {
      const key = m.article.toString();
      if (!stock[key]) {
        stock[key] = { article: key, entree: 0, sortie: 0, stock: 0 };
      }
      if (m.type === 'Entrée' || m.type === 'Transfert') {
        stock[key].entree += m.quantite;
      }
      if (m.type === 'Sortie' || m.type === 'Transfert') {
        stock[key].sortie += m.quantite;
      }
    }

    const result = Object.values(stock).map((s) => ({
      ...s,
      stock: s.entree - s.sortie,
    }));

    return res.status(200).json(result);
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
