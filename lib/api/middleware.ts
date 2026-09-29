import { NextApiRequest, NextApiResponse } from 'next';
import { dbConnect } from '../db';
import { getTokenFromRequest, verifyToken, JWTPayload } from '../auth';
import User from '../../models/User';
import '../../models/Role';
import { hasPermission } from '../permissions';

export interface AuthenticatedRequest extends NextApiRequest {
  user?: {
    userId: string;
    email: string;
    role: string;
    roleCode: string;
    roleName: string;
    fullName: string;
    permissions: string[];
  };
}

type ApiHandler = (req: AuthenticatedRequest, res: NextApiResponse) =>
  | Promise<void | NextApiResponse>
  | void
  | NextApiResponse;

interface WithAuthOptions {
  permission?: string;
}

export function withAuth(handler: ApiHandler, options: WithAuthOptions = {}) {
  return async function (req: AuthenticatedRequest, res: NextApiResponse) {
    try {
      await dbConnect();

      const token = getTokenFromRequest(req as NextApiRequest);
      if (!token) {
        return res.status(401).json({ error: 'Authentification requise' });
      }

      let payload: JWTPayload;
      try {
        payload = verifyToken(token);
      } catch {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
      }

      const userDoc = await User.findById(payload.userId).populate('role');
      if (!userDoc || !userDoc.active) {
        return res.status(401).json({ error: 'Utilisateur introuvable ou inactif' });
      }

      const role = userDoc.role as unknown as IRole;
      if (!role || !role.isActive) {
        return res.status(403).json({ error: 'Rôle invalide ou inactif' });
      }

      req.user = {
        userId: payload.userId,
        email: payload.email,
        role: payload.role,
        roleCode: role.code,
        roleName: role.name,
        fullName: `${userDoc.firstName} ${userDoc.lastName}`,
        permissions: role.permissions,
      };

      if (options.permission) {
        const allowed = await hasPermission(payload.role, options.permission);
        if (!allowed) {
          return res.status(403).json({ error: 'Permission refusée' });
        }
      }

      return handler(req, res);
    } catch (error) {
      console.error('withAuth error:', error);
      return res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  };
}

export function handleError(res: NextApiResponse, error: unknown, status = 500) {
  const message = error instanceof Error ? error.message : 'Erreur inconnue';
  console.error('API error:', error);
  return res.status(status).json({ error: message });
}

interface IRole {
  code: string;
  name: string;
  description?: string;
  permissions: string[];
  isActive: boolean;
}

export function withPermission(permission: string) {
  return function (handler: ApiHandler) {
    return withAuth(handler, { permission });
  };
}

export function withAnyPermission(permissions: string[]) {
  return function (handler: ApiHandler) {
    return async function (req: AuthenticatedRequest, res: NextApiResponse) {
      const wrapper = withAuth(async (authReq, authRes) => {
        for (const permission of permissions) {
          if (await hasPermission(authReq.user!.role, permission)) {
            return handler(authReq, authRes);
          }
        }
        return authRes.status(403).json({ error: 'Permission refusée' });
      });
      return wrapper(req, res);
    };
  };
}
