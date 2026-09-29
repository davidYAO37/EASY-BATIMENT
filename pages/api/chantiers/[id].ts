import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import Chantier from '../../../models/Chantier';
import { getChantierScope, inScope } from '../../../lib/scope';

const UpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  client: z.string().min(1).optional(),
  localisation: z.string().min(1).optional(),
  chefChantier: z.string().min(1).optional(),
  receptionnisteBureau: z.string().min(1).optional(),
  receptionnisteChantier: z.string().min(1).optional(),
  budgetPrevisionnel: z.number().min(0).optional(),
  dateDebut: z.string().datetime().optional(),
  datePrevisionnelleFin: z.string().datetime().optional(),
  statut: z.enum(['Préparation', 'En cours', 'Suspendu', 'Terminé']).optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('chantier', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const chantier = await Chantier.findById(id)
        .populate('chefChantier', 'firstName lastName email')
        .populate('receptionnisteBureau', 'firstName lastName email')
        .populate('receptionnisteChantier', 'firstName lastName email')
        .lean();

      if (!chantier) return res.status(404).json({ error: 'Chantier introuvable' });
      if (!inScope(await getChantierScope(req), chantier._id)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      return res.status(200).json(chantier);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('chantier', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = UpdateSchema.parse(req.body);
      const update: Record<string, unknown> = { ...data };
      if (data.dateDebut) update.dateDebut = new Date(data.dateDebut);
      if (data.datePrevisionnelleFin) update.datePrevisionnelleFin = new Date(data.datePrevisionnelleFin);

      const chantier = await Chantier.findByIdAndUpdate(id, update, { new: true });
      if (!chantier) return res.status(404).json({ error: 'Chantier introuvable' });

      await logAction('Modification', 'Chantier', {
        targetId: chantier._id.toString(),
        targetCode: chantier.code,
        details: data,
        req,
      });

      return res.status(200).json(chantier);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('chantier', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const chantier = await Chantier.findByIdAndDelete(id);
      if (!chantier) return res.status(404).json({ error: 'Chantier introuvable' });

      await logAction('Suppression', 'Chantier', {
        targetId: chantier._id.toString(),
        targetCode: chantier.code,
        details: { nom: chantier.nom },
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
