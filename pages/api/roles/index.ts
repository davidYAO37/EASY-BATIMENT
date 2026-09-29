import type { NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import Role from '../../../models/Role';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('role', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const roles = await Role.find().sort({ name: 1 }).lean();
      return res.status(200).json(roles);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('role', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const { name, code, description, permissions } = req.body;
      if (!name || !code) {
        return res.status(400).json({ error: 'Nom et code requis' });
      }

      const existing = await Role.findOne({ $or: [{ code: code.toUpperCase() }, { name }] });
      if (existing) {
        return res.status(400).json({ error: 'Code ou nom déjà utilisé' });
      }

      const role = await Role.create({
        name,
        code: code.toUpperCase(),
        description: description || '',
        permissions: permissions || [],
        isActive: true,
      });

      return res.status(201).json(role);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
