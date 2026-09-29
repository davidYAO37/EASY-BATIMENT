import { NextApiRequest } from 'next';
import AuditLog from '../models/AuditLog';
import { AuthenticatedRequest } from './api/middleware';

export async function logAction(
  action: string,
  targetType: string,
  options: {
    targetId?: string;
    targetCode?: string;
    details?: Record<string, unknown>;
    req?: AuthenticatedRequest | NextApiRequest;
    userId?: string;
  } = {}
) {
  try {
    const { targetId, targetCode, details = {}, req, userId } = options;
    const authReq = req as AuthenticatedRequest;

    const ip =
      req?.headers?.['x-forwarded-for']?.toString().split(',')[0].trim() ||
      req?.socket?.remoteAddress;

    await AuditLog.create({
      user: userId || authReq?.user?.userId,
      action,
      targetType,
      targetId: targetId ? targetId : undefined,
      targetCode,
      details,
      ip,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Audit log failed:', error);
  }
}
