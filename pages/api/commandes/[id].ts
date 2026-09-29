import type { NextApiResponse } from 'next';
import { dbConnect } from '../../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../../lib/permissions';
import { logAction } from '../../../lib/audit';
import { getChantierScope, inScope } from '../../../lib/scope';
import Commande from '../../../models/Commande';
import Paiement from '../../../models/Paiement';
import Decaissement from '../../../models/Decaissement';
import '../../../models/Chantier';
import '../../../models/Fournisseur';
import '../../../models/Article';
import '../../../models/DemandeAchat';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'Identifiant invalide' });
  }

  if (req.method === 'GET') {
    const allowed = await hasPermission(req.user!.role, buildPermission('commande', 'read'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const commande = await Commande.findById(id)
        .populate('chantier')
        .populate('fournisseur', 'nom contact phone')
        .populate('demandeAchat', 'code')
        .populate('articles.article', 'nom unite')
        .populate('createdBy', 'firstName lastName')
        .populate('recuFournisseurPar', 'firstName lastName')
        .lean();

      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });
      if (!inScope(await getChantierScope(req), commande.chantier)) {
        return res.status(403).json({ error: 'Chantier hors de votre périmètre' });
      }

      const [paiements, decaissement] = await Promise.all([
        Paiement.find({ commande: commande._id })
          .populate('effectuePar', 'firstName lastName')
          .sort({ createdAt: -1 })
          .lean(),
        Decaissement.findOne({ commande: commande._id })
          .populate('utilisateurAutorisateur', 'firstName lastName')
          .populate('utilisateurReceptionnaire', 'firstName lastName')
          .lean(),
      ]);

      return res.status(200).json({ ...commande, paiements, decaissement });
    } catch (error) {
      return handleError(res, error);
    }
  }

  if (req.method === 'DELETE') {
    const allowed = await hasPermission(req.user!.role, buildPermission('commande', 'delete'));
    if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

    try {
      const commande = await Commande.findById(id);
      if (!commande) return res.status(404).json({ error: 'Commande introuvable' });

      if (commande.statut !== 'COMMANDE_FOURNISSEUR') {
        return res.status(400).json({ error: 'Cette commande ne peut plus être supprimée' });
      }

      await Commande.findByIdAndDelete(id);

      await logAction('Suppression', 'Commande', {
        targetId: commande._id.toString(),
        targetCode: commande.code,
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
