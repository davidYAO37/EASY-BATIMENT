import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import Fournisseur from '../../../models/Fournisseur';

const FournisseurSchema = z.object({
  nom: z.string().min(1),
  contact: z.string().min(1),
  adresse: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('fournisseur', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const fournisseurs = await Fournisseur.find().sort({ nom: 1 }).lean();
      return res.status(200).json(fournisseurs);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('fournisseur', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = FournisseurSchema.parse(req.body);
      const fournisseur = await Fournisseur.create({
        ...data,
        email: data.email || undefined,
      });

      await logAction('Création', 'Fournisseur', {
        targetId: fournisseur._id.toString(),
        targetCode: fournisseur.nom,
        req,
      });

      return res.status(201).json(fournisseur);
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
