import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import Fournisseur from '../../../models/Fournisseur';

const UpdateSchema = z.object({
  nom: z.string().min(1).optional(),
  contact: z.string().min(1).optional(),
  adresse: z.string().optional(),
  phone: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal('')),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('fournisseur', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const fournisseur = await Fournisseur.findById(id).lean();
      if (!fournisseur) return res.status(404).json({ error: 'Fournisseur introuvable' });
      return res.status(200).json(fournisseur);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('fournisseur', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = UpdateSchema.parse(req.body);
      const payload = { ...data, email: data.email || undefined };
      const fournisseur = await Fournisseur.findByIdAndUpdate(id, payload, { new: true });
      if (!fournisseur) return res.status(404).json({ error: 'Fournisseur introuvable' });

      await logAction('Modification', 'Fournisseur', {
        targetId: fournisseur._id.toString(),
        targetCode: fournisseur.nom,
        details: data,
        req,
      });

      return res.status(200).json(fournisseur);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('fournisseur', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const fournisseur = await Fournisseur.findByIdAndDelete(id);
      if (!fournisseur) return res.status(404).json({ error: 'Fournisseur introuvable' });

      await logAction('Suppression', 'Fournisseur', {
        targetId: fournisseur._id.toString(),
        targetCode: fournisseur.nom,
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
