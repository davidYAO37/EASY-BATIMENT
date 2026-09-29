import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import User from '../../../models/User';
import '../../../models/Role';

interface IRolePopulated {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  permissions: string[];
}

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  try {
    await dbConnect();

    const user = await User.findById(req.user!.userId).populate('role');
    if (!user) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }

    const role = user.role as unknown as IRolePopulated;

    return res.status(200).json({
      id: user._id.toString(),
      email: user.email,
      fullName: `${user.firstName} ${user.lastName}`,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: role?.name || '',
      roleId: role?._id.toString() || '',
      roleCode: role?.code || '',
      permissions: role?.permissions || [],
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
