import type { NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import AuditLog from '../../../models/AuditLog';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('audit', 'read'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  try {
    const { targetType, user, targetCode, limit = '50' } = req.query;
    const query: Record<string, unknown> = {};

    if (targetType && !Array.isArray(targetType)) query.targetType = targetType;
    if (user && !Array.isArray(user)) query.user = user;
    if (targetCode && !Array.isArray(targetCode)) query.targetCode = targetCode;

    const logs = await AuditLog.find(query)
      .populate('user', 'firstName lastName email')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit as string, 10))
      .lean();

    return res.status(200).json(logs);
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
