import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generateChantierCode } from '../../../lib/utils/codes';
import { logAction } from '../../../lib/audit';
import Chantier from '../../../models/Chantier';
import User from '../../../models/User';
import { getChantierScope, scopeFilter } from '../../../lib/scope';

const ChantierSchema = z.object({
  nom: z.string().min(1),
  client: z.string().min(1),
  localisation: z.string().min(1),
  chefChantier: z.string().min(1),
  receptionnisteBureau: z.string().min(1),
  receptionnisteChantier: z.string().min(1),
  budgetPrevisionnel: z.number().min(0),
  dateDebut: z.string().datetime(),
  datePrevisionnelleFin: z.string().datetime(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('chantier', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const chantiers = await Chantier.find(scopeFilter(await getChantierScope(req), '_id'))
        .populate('chefChantier', 'firstName lastName email')
        .populate('receptionnisteBureau', 'firstName lastName email')
        .populate('receptionnisteChantier', 'firstName lastName email')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(chantiers);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('chantier', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = ChantierSchema.parse(req.body);

      const [chef, rb, rc] = await Promise.all([
        User.findById(data.chefChantier),
        User.findById(data.receptionnisteBureau),
        User.findById(data.receptionnisteChantier),
      ]);

      if (!chef || !rb || !rc) {
        return res.status(400).json({ error: 'Un ou plusieurs utilisateurs sont introuvables' });
      }

      const code = await generateChantierCode();

      const chantier = await Chantier.create({
        code,
        nom: data.nom,
        client: data.client,
        localisation: data.localisation,
        chefChantier: data.chefChantier,
        receptionnisteBureau: data.receptionnisteBureau,
        receptionnisteChantier: data.receptionnisteChantier,
        budgetPrevisionnel: data.budgetPrevisionnel,
        dateDebut: new Date(data.dateDebut),
        datePrevisionnelleFin: new Date(data.datePrevisionnelleFin),
      });

      await logAction('Création', 'Chantier', {
        targetId: chantier._id.toString(),
        targetCode: chantier.code,
        details: { nom: chantier.nom, client: chantier.client },
        req,
      });

      return res.status(201).json({
        id: chantier._id.toString(),
        code: chantier.code,
        nom: chantier.nom,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
