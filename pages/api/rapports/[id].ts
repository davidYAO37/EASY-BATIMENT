import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import RapportChantier from '../../../models/RapportChantier';
import MouvementStock from '../../../models/MouvementStock';

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
        .populate('createdBy', '_id firstName lastName')
        .populate({
          path: 'mouvements',
          populate: { path: 'article', select: 'nom unite' },
        })
        .lean();

      if (!rapport) return res.status(404).json({ error: 'Rapport introuvable' });
      return res.status(200).json(rapport);
    } catch (error) {
      return handleError(res, error);
    }
  }

  function isCreatorAndUnread(rapport: {
    createdBy?: string | mongoose.Types.ObjectId | { _id: mongoose.Types.ObjectId | string };
    luPar?: (string | mongoose.Types.ObjectId)[];
  }) {
    let createdBy: string | undefined;
    const cb = rapport.createdBy;
    if (typeof cb === 'string') {
      createdBy = cb;
    } else if (cb instanceof mongoose.Types.ObjectId) {
      createdBy = cb.toString();
    } else if (cb) {
      createdBy = cb._id.toString();
    }
    const unread = !rapport.luPar || rapport.luPar.length === 0;
    return unread && createdBy === req.user!.userId;
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

      if (rapport.mouvements && rapport.mouvements.length > 0) {
        await MouvementStock.populate(rapport, {
          path: 'mouvements',
          populate: { path: 'article', select: 'nom unite' },
        });
      }

      await logAction('Lecture', 'RapportChantier', {
        targetId: rapport._id.toString(),
        req,
      });

      return res.status(200).json({ lu: true, mouvements: rapport.mouvements });
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const hasUpdate = await hasPermission(req.user!.role, buildPermission('rapport', 'update'));
    if (!hasUpdate) {
      // L'auteur d'un rapport non lu peut toujours le modifier
      const rapport = await RapportChantier.findById(id);
      if (!rapport || !isCreatorAndUnread(rapport)) {
        return res.status(403).json({ error: 'Permission refusée' });
      }
    }

    try {
      const rapport = await RapportChantier.findById(id);
      if (!rapport) return res.status(404).json({ error: 'Rapport introuvable' });

      if (!isCreatorAndUnread(rapport)) {
        return res.status(403).json({ error: 'Seul l\'auteur d\'un rapport non lu peut le modifier' });
      }

      const { activite, travauxRealises, personnelPresent, materielUtilise, difficultes, incidents, besoins, observations, date } = req.body;
      if (activite !== undefined) rapport.activite = activite;
      if (travauxRealises !== undefined) rapport.travauxRealises = travauxRealises;
      if (personnelPresent !== undefined) rapport.personnelPresent = personnelPresent;
      if (materielUtilise !== undefined) rapport.materielUtilise = materielUtilise;
      if (difficultes !== undefined) rapport.difficultes = difficultes || '';
      if (incidents !== undefined) rapport.incidents = incidents || '';
      if (besoins !== undefined) rapport.besoins = besoins || '';
      if (observations !== undefined) rapport.observations = observations || '';
      if (date) rapport.date = new Date(date);

      await rapport.save();

      await logAction('Modification', 'RapportChantier', {
        targetId: rapport._id.toString(),
        req,
      });

      return res.status(200).json(rapport);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const hasDelete = await hasPermission(req.user!.role, buildPermission('rapport', 'delete'));
    if (!hasDelete) {
      const rapport = await RapportChantier.findById(id);
      if (!rapport || !isCreatorAndUnread(rapport)) {
        return res.status(403).json({ error: 'Permission refusée' });
      }
    }

    try {
      const rapport = await RapportChantier.findById(id);
      if (!rapport) return res.status(404).json({ error: 'Rapport introuvable' });

      if (!isCreatorAndUnread(rapport)) {
        return res.status(403).json({ error: 'Seul l\'auteur d\'un rapport non lu peut le supprimer' });
      }

      if (rapport.mouvements && rapport.mouvements.length > 0) {
        await MouvementStock.deleteMany({ _id: { $in: rapport.mouvements } });
      }

      await RapportChantier.findByIdAndDelete(id);

      await logAction('Suppression', 'RapportChantier', {
        targetId: id,
        req,
      });

      return res.status(204).end();
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
