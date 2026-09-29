import type { NextApiResponse } from 'next';
import mongoose from 'mongoose';
import { dbConnect } from '../../lib/db';
import { withAuth, AuthenticatedRequest, handleError } from '../../lib/api/middleware';
import { buildPermission, hasPermission } from '../../lib/permissions';
import Chantier from '../../models/Chantier';
import DemandeAchat from '../../models/DemandeAchat';
import Commande from '../../models/Commande';
import Paiement from '../../models/Paiement';
import Decaissement from '../../models/Decaissement';
import '../../models/Fournisseur';
import RapportChantier from '../../models/RapportChantier';
import Reception from '../../models/Reception';

const COMMANDE_FIELDS = 'code montant statut chantier fournisseur recuFournisseurDate updatedAt';

async function handler(req: AuthenticatedRequest, res: NextApiResponse) {
  await dbConnect();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  const allowed = await hasPermission(req.user!.role, buildPermission('admin', 'all'));
  if (!allowed) return res.status(403).json({ error: 'Permission refusée' });

  try {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      chantiersActifs,
      commandesEnAttente,
      commandesValidees,
      livraisonsAttendues,
      paiementsDuMois,
      anomalies,
      rapportsNonLus,
      livraisonsPartielles,
      demandesAValider,
      commandesReceptionnees,
      commandesDecaissees,
      commandesAControler,
      justificatifsManquants,
    ] = await Promise.all([
      Chantier.countDocuments({ statut: { $in: ['Préparation', 'En cours'] } }),
      DemandeAchat.countDocuments({ statut: { $in: ['SOUMIS', 'RECU_RB', 'EN_VALIDATION_ADMIN'] } }),
      Commande.countDocuments({ statut: { $nin: ['CLOTURE', 'ANOMALIE'] } }),
      Commande.countDocuments({ statut: { $in: ['COMMANDE_FOURNISSEUR', 'LIVRAISON'] } }),
      Paiement.find({ datePaiement: { $gte: start, $lte: end } }).select('montant').lean(),
      Commande.countDocuments({ statut: 'ANOMALIE' }),
      RapportChantier.countDocuments({ luPar: { $ne: req.user!.userId } }),
      Reception.countDocuments({
        'lignes.etat': { $in: ['Manquant', 'Endommagé', 'Non conforme', 'Livraison partielle'] },
      }),
      DemandeAchat.find({ statut: 'EN_VALIDATION_ADMIN' })
        .select('code urgence articles.quantite articles.prixEstimatif chantier updatedAt')
        .populate('chantier', 'code nom')
        .sort({ updatedAt: 1 })
        .lean(),
      Commande.find({ statut: 'RECEPTION_RC' }).select(COMMANDE_FIELDS).populate('chantier', 'code').populate('fournisseur', 'nom').lean(),
      Decaissement.distinct('commande'),
      Commande.find({ statut: { $in: ['JUSTIFICATIFS', 'CONTROLE_ADMIN'] } })
        .select(COMMANDE_FIELDS)
        .populate('chantier', 'code')
        .populate('fournisseur', 'nom')
        .sort({ updatedAt: 1 })
        .lean(),
      Commande.find({ statut: 'PAIEMENT' }).select(COMMANDE_FIELDS).populate('chantier', 'code').populate('fournisseur', 'nom').lean(),
    ]);

    const decaissees = new Set(commandesDecaissees.map((id) => id.toString()));
    const commandesADecaisser = commandesReceptionnees.filter((c) => !decaissees.has(c._id.toString()));

    const paiementsAControler = await Paiement.find({ commande: { $in: commandesAControler.map((c) => c._id) } })
      .select('commande montant')
      .lean();
    const montantPaye = new Map(paiementsAControler.map((p) => [p.commande.toString(), p.montant]));
    const aControler = commandesAControler.map((c) => {
      const paye = montantPaye.get(c._id.toString());
      return { ...c, montantPaye: paye, ecart: paye === undefined ? null : paye - c.montant };
    });

    const paiementsManquants = await Paiement.find({ commande: { $in: justificatifsManquants.map((c) => c._id) } })
      .select('commande recuPhysiqueDate')
      .lean();
    const recuPhysique = new Map(paiementsManquants.map((p) => [p.commande.toString(), Boolean(p.recuPhysiqueDate)]));

    const depensesDuMois = paiementsDuMois.reduce(
      (acc: number, p: { montant: number }) => acc + p.montant,
      0
    );

    return res.status(200).json({
      chantiersActifs,
      commandesEnAttente,
      commandesValidees,
      livraisonsAttendues,
      depensesDuMois,
      anomalies,
      rapportsNonLus,
      alertes: {
        validationRequise: demandesAValider.length,
        livraisonsPartielles,
        justificatifsEcarts: aControler.filter((c) => c.ecart !== 0).length,
        rapportsNonLus,
      },
      files: {
        demandesAValider: demandesAValider.map((d: {
          _id: mongoose.Types.ObjectId;
          code: string;
          urgence?: string;
          chantier?: unknown;
          articles?: { quantite?: number; prixEstimatif?: number }[];
          updatedAt?: Date;
        }) => ({
          _id: d._id,
          code: d.code,
          urgence: d.urgence,
          chantier: d.chantier,
          montant: (d.articles || []).reduce(
            (acc: number, l: { quantite?: number; prixEstimatif?: number }) =>
              acc + (l.quantite || 0) * (l.prixEstimatif || 0),
            0
          ),
          updatedAt: d.updatedAt,
        })),
        commandesADecaisser,
        commandesAControler: aControler,
        justificatifsManquants: justificatifsManquants.map((c) => ({
          ...c,
          recuFournisseur: Boolean(c.recuFournisseurDate),
          recuPhysique: recuPhysique.get(c._id.toString()) ?? false,
        })),
      },
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export default withAuth(handler);
