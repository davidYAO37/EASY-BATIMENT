import mongoose from 'mongoose';
import type { AuthenticatedRequest } from './api/middleware';
import Chantier from '../models/Chantier';

const FULL_ACCESS_ROLES = ['ADMIN', 'SUPER_ADMIN', 'RECEPTION_BUREAU'];

/**
 * Retourne la liste des chantiers accessibles à l'utilisateur,
 * ou null s'il a accès à tous les chantiers (admin, réception bureau).
 */
export async function getChantierScope(req: AuthenticatedRequest): Promise<mongoose.Types.ObjectId[] | null> {
  const user = req.user!;
  if (user.permissions.includes('admin.all') || FULL_ACCESS_ROLES.includes(user.roleCode)) return null;
  const chantiers = await Chantier.find({
    $or: [{ chefChantier: user.userId }, { receptionnisteChantier: user.userId }, { receptionnisteBureau: user.userId }],
  })
    .select('_id')
    .lean();
  return chantiers.map((c) => c._id as mongoose.Types.ObjectId);
}

export function scopeFilter(scope: mongoose.Types.ObjectId[] | null, field = 'chantier'): Record<string, unknown> {
  return scope ? { [field]: { $in: scope } } : {};
}

export function inScope(scope: mongoose.Types.ObjectId[] | null, chantierId: unknown): boolean {
  if (!scope) return true;
  const id = String((chantierId as { _id?: unknown })?._id ?? chantierId);
  return scope.some((s) => s.toString() === id);
}
