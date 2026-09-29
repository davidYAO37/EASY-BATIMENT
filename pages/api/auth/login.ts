import type { NextApiRequest, NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { signToken } from '../../../lib/auth';
import { handleError } from '../../../lib/api/middleware';
import User from '../../../models/User';
import '../../../models/Role';
import { logAction } from '../../../lib/audit';

interface IRolePopulated {
  _id: mongoose.Types.ObjectId;
  name: string;
}

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    await dbConnect();

    const data = LoginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() }).populate('role');
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const valid = await user.comparePassword(data.password);
    if (!valid) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }

    const role = user.role as unknown as IRolePopulated;
    const roleName = role?.name || '';

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: role._id.toString(),
    });

    await logAction('Connexion', 'User', {
      targetId: user._id.toString(),
      targetCode: user.email,
      req,
    });

    return res.status(200).json({
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        fullName: `${user.firstName} ${user.lastName}`,
        role: roleName,
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}
