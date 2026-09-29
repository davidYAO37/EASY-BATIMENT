import type { NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { hasPermission, buildPermission } from '../../../lib/permissions';
import User from '../../../models/User';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('utilisateur', 'read'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  try {
    const users = await User.find()
      .populate('role', 'name code')
      .select('-passwordHash')
      .sort({ active: -1, lastName: 1 })
      .lean();

    return res.status(200).json(users);
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
