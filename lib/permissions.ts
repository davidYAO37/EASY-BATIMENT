import { dbConnect } from './db';
import Role from '../models/Role';

export type PermissionScope =
  | 'chantier'
  | 'article'
  | 'fournisseur'
  | 'demandeAchat'
  | 'commande'
  | 'reception'
  | 'decaissement'
  | 'paiement'
  | 'stock'
  | 'rapport'
  | 'utilisateur'
  | 'role'
  | 'audit'
  | 'dashboard'
  | 'admin';

export type PermissionAction = 'read' | 'create' | 'update' | 'delete' | 'validate' | 'all';

export function buildPermission(scope: PermissionScope, action: PermissionAction): string {
  return `${scope}.${action}`;
}

export async function hasPermission(roleId: string, permission: string): Promise<boolean> {
  await dbConnect();
  const role = await Role.findById(roleId).lean();
  if (!role || !role.isActive) return false;
  if (role.permissions.includes('admin.all')) return true;
  return role.permissions.includes(permission);
}

export async function hasAnyPermission(roleId: string, permissions: string[]): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermission(roleId, permission)) return true;
  }
  return false;
}
