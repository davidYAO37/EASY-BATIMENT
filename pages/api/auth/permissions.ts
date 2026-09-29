import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest } from '../../../lib/api/middleware';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  return res.status(200).json({
    user: {
      id: req.user!.userId,
      email: req.user!.email,
      fullName: req.user!.fullName,
      role: req.user!.roleName,
      roleCode: req.user!.roleCode,
    },
    permissions: req.user!.permissions,
  });
}

export default withAuth(handler);
