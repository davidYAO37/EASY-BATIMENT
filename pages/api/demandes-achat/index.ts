import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { generateDemandeAchatCode } from '../../../lib/utils/codes';
import { getNextDemandeAchatStatus } from '../../../lib/workflow';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope } from '../../../lib/scope';
import DemandeAchat, { DemandeAchatStatus } from '../../../models/DemandeAchat';
import Chantier from '../../../models/Chantier';
import Article from '../../../models/Article';
import '../../../models/Fournisseur';
import User from '../../../models/User';

const LigneSchema = z.object({
  article: z.string().min(1),
  designation: z.string().optional(),
  quantite: z.number().min(1),
  prixEstimatif: z.number().min(0),
  observation: z.string().optional(),
});

const DemandeAchatSchema = z.object({
  chantier: z.string().min(1),
  fournisseurSouhaite: z.string().optional(),
  fournisseur: z.string().optional(),
  articles: z.array(LigneSchema).min(1),
  urgence: z.enum(['Basse', 'Normale', 'Haute', 'Critique']).default('Normale'),
  dateSouhaitee: z.string().datetime().optional(),
  observation: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const user = await User.findById(req.user!.userId).lean();
      const isFullAccess =
        (await hasPermission(req.user!.role, buildPermission('admin', 'all'))) ||
        req.user!.roleCode === 'RECEPTION_BUREAU';

      let query: Record<string, unknown> = {};
      if (!isFullAccess && user) {
        query = {
          $or: [
            { createdBy: user._id },
            { 'chantier': { $in: await Chantier.find({ chefChantier: user._id }).select('_id').then((c) => c.map((x) => x._id)) } },
          ],
        };
      }

      const demandes = await DemandeAchat.find(query)
        .populate('chantier', 'code nom')
        .populate('fournisseur', 'nom')
        .populate('articles.article', 'nom unite')
        .populate('createdBy', 'firstName lastName')
        .sort({ createdAt: -1 })
        .lean();

      return res.status(200).json(demandes);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'POST') {
    const allowed = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'create'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const data = DemandeAchatSchema.parse(req.body);

      const chantier = await Chantier.findById(data.chantier);
      if (!chantier) {
        return res.status(400).json({ error: 'Chantier introuvable' });
      }
      if (!inScope(await getChantierScope(req), chantier._id)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      for (const ligne of data.articles) {
        const article = await Article.findById(ligne.article);
        if (!article) {
          return res.status(400).json({ error: `Article ${ligne.article} introuvable` });
        }
      }

      const code = await generateDemandeAchatCode();
      const nextStatus = getNextDemandeAchatStatus('CREATION', 'SOUMETTRE') as DemandeAchatStatus;

      const demande = await DemandeAchat.create({
        code,
        chantier: data.chantier,
        fournisseurSouhaite: data.fournisseurSouhaite,
        fournisseur: data.fournisseur,
        articles: data.articles,
        urgence: data.urgence,
        dateSouhaitee: data.dateSouhaitee ? new Date(data.dateSouhaitee) : undefined,
        observation: data.observation,
        statut: nextStatus || 'SOUMIS',
        createdBy: req.user!.userId,
      });

      await logAction('Création', 'DemandeAchat', {
        targetId: demande._id.toString(),
        targetCode: demande.code,
        details: {
          chantier: chantier.code,
          urgence: demande.urgence,
          statut: demande.statut,
        },
        req,
      });

      return res.status(201).json({
        id: demande._id.toString(),
        code: demande.code,
        statut: demande.statut,
      });
    } catch (error) {
      return handleError(res, error);
    }
  }

  return res.status(405).json({ error: 'Méthode non autorisée' });
}

export default withAuth(handler);
