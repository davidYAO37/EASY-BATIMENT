import mongoose from 'mongoose';
import { dbConnect } from '../db';
import Chantier from '../../models/Chantier';
import DemandeAchat from '../../models/DemandeAchat';
import Commande from '../../models/Commande';
import Reception from '../../models/Reception';
import Decaissement from '../../models/Decaissement';
import Paiement from '../../models/Paiement';

function getYearSuffix(): string {
  return new Date().getFullYear().toString();
}

async function generateCode<M extends { code: string }>(prefix: string, model: mongoose.Model<M>): Promise<string> {
  await dbConnect();
  const year = getYearSuffix();
  const regex = new RegExp(`^${prefix}-${year}-`);

  const existing = await model
    .find({ code: { $regex: regex } })
    .sort({ code: -1 })
    .limit(1)
    .select('code')
    .lean();

  let nextNumber = 1;
  if (existing.length > 0) {
    const parts = existing[0].code.split('-');
    const last = parseInt(parts[2], 10);
    if (!isNaN(last)) nextNumber = last + 1;
  }

  if (nextNumber > 999) {
    throw new Error(`La numérotation annuelle pour ${prefix} est épuisée.`);
  }

  return `${prefix}-${year}-${nextNumber.toString().padStart(3, '0')}`;
}

export function generateChantierCode(): Promise<string> {
  return generateCode('CH', Chantier);
}

export function generateDemandeAchatCode(): Promise<string> {
  return generateCode('DA', DemandeAchat);
}

export function generateCommandeCode(): Promise<string> {
  return generateCode('CMD', Commande);
}

export function generateReceptionCode(): Promise<string> {
  return generateCode('RC', Reception);
}

export function generateDecaissementCode(): Promise<string> {
  return generateCode('DC', Decaissement);
}

export function generatePaiementCode(): Promise<string> {
  return generateCode('PAI', Paiement);
}
