import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { hasPermission, buildPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import User from '../../../models/User';

const UpdateSchema = z.object({
  active: z.boolean().optional(),
  role: z.string().min(1).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('utilisateur', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const user = await User.findById(id).populate('role', 'name').select('-passwordHash').lean();
      if (!user) return res.status(404).json({ error: 'Utilisateur introuvable' });

      return res.status(200).json(user);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('utilisateur', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = UpdateSchema.parse(req.body);
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });

      if (target._id.toString() === req.user!.userId && data.active === false) {
        return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte' });
      }

      if (data.active !== undefined) target.active = data.active;
      if (data.role) target.role = data.role as unknown as typeof target.role;
      await target.save();

      await logAction(data.active === false ? 'Désactivation' : data.active === true ? 'Activation' : 'Modification', 'User', {
        targetId: target._id.toString(),
        targetCode: target.email,
        req,
      });

      return res.status(200).json({ id: target._id.toString(), active: target.active });
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('utilisateur', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const target = await User.findById(id);
      if (!target) return res.status(404).json({ error: 'Utilisateur introuvable' });
      if (target._id.toString() === req.user!.userId) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
      }

      await User.findByIdAndDelete(id);

      await logAction('Suppression', 'User', {
        targetId: target._id.toString(),
        targetCode: target.email,
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
