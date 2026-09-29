import type { NextApiResponse } from 'next';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { ALL_PERMISSIONS } from '../../../lib/defaultRoles';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    return res.status(200).json(ALL_PERMISSIONS);
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
