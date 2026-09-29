import type { NextApiResponse } from 'next';
import { z } from 'zod';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope } from '../../../lib/scope';
import DemandeAchat from '../../../models/DemandeAchat';
import Article from '../../../models/Article';
import '../../../models/Chantier';
import '../../../models/Fournisseur';
import '../../../models/Commande';

const LigneSchema = z.object({
  article: z.string().min(1),
  designation: z.string().optional(),
  quantite: z.number().min(1),
  prixEstimatif: z.number().min(0),
  observation: z.string().optional(),
  priorite: z.boolean().optional(),
});

const UpdateSchema = z.object({
  fournisseurSouhaite: z.string().min(1).optional(),
  fournisseur: z.string().min(1).optional(),
  articles: z.array(LigneSchema).min(1).optional(),
  urgence: z.enum(['Basse', 'Normale', 'Haute', 'Critique']).optional(),
  dateSouhaitee: z.string().datetime().optional(),
  observation: z.string().optional(),
});

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const demande = await DemandeAchat.findById(id)
        .populate('chantier')
        .populate('fournisseur', 'nom')
        .populate('articles.article', 'nom unite')
        .populate('articles.commande', 'code')
        .populate('createdBy', 'firstName lastName')
        .lean();

      if (!demande) return res.status(404).json({ error: 'Demande introuvable' });
      if (!inScope(await getChantierScope(req), demande.chantier) && String(demande.createdBy?._id) !== req.user!.userId) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }
      return res.status(200).json(demande);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'PUT') {
    const allowed = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'update'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const existing = await DemandeAchat.findById(id);
      if (!existing) return res.status(404).json({ error: 'Demande introuvable' });

      const isAdmin = await hasPermission(req.user!.role, buildPermission('admin', 'all'));
      const isOwner = String(existing.createdBy) === req.user!.userId;
      const canEditInValidation = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'validate'));
      const canUpdate = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'update'));
      const editableByOwner = ['CREATION', 'SOUMIS', 'DEMANDE_MODIF'].includes(existing.statut) && (isOwner || isAdmin);
      const editableByAdmin = existing.statut === 'EN_VALIDATION_ADMIN' && (canEditInValidation || isAdmin);
      const editableEnCoursCommande = ['RECU_RB', 'COMMANDE_PARTIELLE'].includes(existing.statut) && (canUpdate || isAdmin);
      if (!editableByOwner && !editableByAdmin && !editableEnCoursCommande) {
        return res.status(400).json({ error: 'Cette demande ne peut plus être modifiée' });
      }

      const data = UpdateSchema.parse(req.body);

      if (data.articles) {
        const existantes = existing.articles || [];
        for (let i = 0; i < existantes.length; i++) {
          if (!existantes[i].commande) continue;
          const sent = data.articles[i];
          if (
            !sent ||
            String(sent.article) !== String(existantes[i].article) ||
            sent.quantite !== existantes[i].quantite ||
            sent.prixEstimatif !== existantes[i].prixEstimatif
          ) {
            return res.status(400).json({
              error: 'Une ligne déjà commandée ne peut pas être modifiée',
            });
          }
        }
      }

      if (data.articles) {
        for (const ligne of data.articles) {
          const article = await Article.findById(ligne.article);
          if (!article) {
            return res.status(400).json({ error: `Article ${ligne.article} introuvable` });
          }
        }
      }

      const update: Record<string, unknown> = { ...data, updatedBy: req.user!.userId };
      if (data.dateSouhaitee) update.dateSouhaitee = new Date(data.dateSouhaitee);
      if (data.articles) {
        update.articles = data.articles.map((l, i) => ({
          ...l,
          commande: existing.articles?.[i]?.commande || undefined,
        }));
      }

      const demande = await DemandeAchat.findByIdAndUpdate(id, update, { new: true });

      await logAction('Modification', 'DemandeAchat', {
        targetId: demande!._id.toString(),
        targetCode: demande!.code,
        details: data,
        req,
      });

      return res.status(200).json(demande);
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('demandeAchat', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const demande = await DemandeAchat.findById(id);
      if (!demande) return res.status(404).json({ error: 'Demande introuvable' });
      const isAdmin = await hasPermission(req.user!.role, buildPermission('admin', 'all'));
      const isOwner = String(demande.createdBy) === req.user!.userId;
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Vous ne pouvez supprimer que vos propres demandes' });
      }
      if (!['CREATION', 'SOUMIS', 'DEMANDE_MODIF'].includes(demande.statut)) {
        return res.status(400).json({ error: 'Cette demande ne peut plus être supprimée' });
      }

      await DemandeAchat.findByIdAndDelete(id);

      await logAction('Suppression', 'DemandeAchat', {
        targetId: demande._id.toString(),
        targetCode: demande.code,
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
