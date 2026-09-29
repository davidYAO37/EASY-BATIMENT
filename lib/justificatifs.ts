import { z } from 'zod';
import type { ICommande } from '../models/Commande';
import Paiement from '../models/Paiement';
import { getNextCommandeStatus } from './workflow';

export const MAX_RECU_LENGTH = 4_000_000;

export const RecuSchema = z
  .string()
  .max(MAX_RECU_LENGTH, 'Image trop volumineuse')
  .refine((v) => /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) || /^https?:\/\//.test(v), {
    message: 'Le reçu doit être une image ou une URL valide',
  });

/**
 * Passe la commande de PAIEMENT à JUSTIFICATIFS quand les deux reçus sont présents :
 * reçu fournisseur (transmis par RB) et reçu physique (transmis par RC).
 */
export async function avancerSiJustifie(commande: ICommande): Promise<boolean> {
  if (commande.statut !== 'PAIEMENT') return false;
  const paiement = await Paiement.findOne({ commande: commande._id }).select('recuPhysiqueDate recuFournisseurDate').lean();
  const recuFournisseur = Boolean(commande.recuFournisseurDate || paiement?.recuFournisseurDate);
  if (!paiement?.recuPhysiqueDate || !recuFournisseur) return false;
  const next = getNextCommandeStatus(commande.statut, 'AJOUTER_JUSTIFICATIF');
  if (!next) return false;
  commande.statut = next as ICommande['statut'];
  await commande.save();
  return true;
}
