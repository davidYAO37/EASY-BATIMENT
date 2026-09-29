import type { NextApiRequest, NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { hashPassword, signToken } from '../../../lib/auth';
import { withAuth, handleError } from '../../../lib/api/middleware';
import User from '../../../models/User';
import Role from '../../../models/Role';
import { logAction } from '../../../lib/audit';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  roleName: z.string().min(1),
});

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    await dbConnect();

    const data = RegisterSchema.parse(req.body);

    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ error: 'Cet email est déjà utilisé' });
    }

    const role = await Role.findOne({ name: data.roleName });
    if (!role) {
      return res.status(400).json({ error: 'Rôle introuvable' });
    }

    const passwordHash = await hashPassword(data.password);

    const user = await User.create({
      email: data.email.toLowerCase(),
      passwordHash,
      firstName: data.firstName,
      lastName: data.lastName,
      phone: data.phone,
      role: role._id,
    });

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: role._id.toString(),
    });

    await logAction('Création utilisateur', 'User', {
      targetId: user._id.toString(),
      targetCode: user.email,
      details: { role: role.name },
      req,
    });

    return res.status(201).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        role: role.name,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler, { permission: 'utilisateur.create' });
