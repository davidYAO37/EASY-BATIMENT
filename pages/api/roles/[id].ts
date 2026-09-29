import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import Role from '../../../models/Role';

async function handler(req: AuthenticatedRequest & NextApiRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('role', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const role = await Role.findById(id).lean();
      if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
      return res.status(200).json(role);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('role', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const { name, description, permissions, isActive } = req.body;

      const role = await Role.findByIdAndUpdate(
        id,
        {
          $set: {
            name,
            description: description || '',
            permissions: permissions || [],
            isActive: isActive !== undefined ? isActive : true,
          },
        },
        { new: true }
      );

      if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
      return res.status(200).json(role);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('role', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const role = await Role.findByIdAndDelete(id);
      if (!role) return res.status(404).json({ error: 'Rôle introuvable' });
      return res.status(204).end();
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
