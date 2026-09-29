import type { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../../lib/db';
import { hashPassword, getTokenFromRequest, verifyToken } from '../../lib/auth';
import { hasPermission } from '../../lib/permissions';
import { DEFAULT_ROLES } from '../../lib/defaultRoles';
import { logAction } from '../../lib/audit';
import User from '../../models/User';
import Role from '../../models/Role';

const DEFAULT_PASSWORD = 'Admin123!';

/**
 * Initialisation des rôles et du compte super admin.
 * - Base vide : accessible sans authentification (premier démarrage).
 * - Sinon : réservé à un utilisateur ayant `admin.all`. Le mot de passe du super admin existant n'est jamais modifié.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    await dbConnect();

    let initiatorId: string | null = null;
    if ((await User.estimatedDocumentCount()) > 0) {
      const token = getTokenFromRequest(req);
      if (!token) return res.status(401).json({ error: 'Authentification requise' });
      let payload;
      try {
        payload = verifyToken(token);
      } catch {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
      }
      if (!(await hasPermission(payload.role, 'admin.all'))) {
        return res.status(403).json({ error: 'Permission refusée' });
      }
      initiatorId = payload.userId;
    }

    const created: string[] = [];
    const updated: string[] = [];

    for (const roleData of DEFAULT_ROLES) {
      const existed = await Role.exists({ code: roleData.code });
      await Role.findOneAndUpdate({ code: roleData.code }, { $set: roleData }, { upsert: true });
      (existed ? updated : created).push(roleData.name);
    }

    const superAdminRole = await Role.findOne({ code: 'SUPER_ADMIN' });
    if (!superAdminRole) {
      return res.status(500).json({ error: 'Rôle SUPER_ADMIN non trouvé' });
    }

    const adminEmail = 'admin@easy-batiment.com';
    const adminExisted = await User.exists({ email: adminEmail });
    if (!adminExisted) {
      await User.create({
        email: adminEmail,
        passwordHash: await hashPassword(DEFAULT_PASSWORD),
        firstName: 'Super',
        lastName: 'Admin',
        role: superAdminRole._id,
        active: true,
      });
    }

    await logAction('Initialisation rôles', 'Role', {
      details: { createdRoles: created, updatedRoles: updated, adminCreated: !adminExisted },
      userId: initiatorId ?? undefined,
      req,
    });

    return res.status(200).json({
      message: 'Initialisation terminée',
      createdRoles: created,
      updatedRoles: updated,
      admin: adminExisted
        ? { created: false, email: adminEmail }
        : { created: true, email: adminEmail, defaultPassword: DEFAULT_PASSWORD, warning: 'Changez ce mot de passe immédiatement' },
    });
  } catch (error) {
    console.error('Seed error:', error);
    return res.status(500).json({ error: 'Erreur interne du serveur' });
  }
}
