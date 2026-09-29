import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import RapportChantier from '../../../models/RapportChantier';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('rapport', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const rapport = await RapportChantier.findById(id)
        .populate('chantier')
        .populate('createdBy', 'firstName lastName')
        .lean();

      if (!rapport) return res.status(404).json({ error: 'Rapport introuvable' });
      return res.status(200).json(rapport);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('rapport', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const rapport = await RapportChantier.findById(id);
      if (!rapport) return res.status(404).json({ error: 'Rapport introuvable' });

      const luPar = new Set((rapport.luPar || []).map((u) => u.toString()));
      luPar.add(req.user!.userId);
      rapport.luPar = Array.from(luPar).map((u) => new mongoose.Types.ObjectId(u));
      await rapport.save();

      await logAction('Lecture', 'RapportChantier', {
        targetId: rapport._id.toString(),
        req,
      });

      return res.status(200).json({ lu: true });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
