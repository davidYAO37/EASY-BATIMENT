import mongoose, { Schema, Document, Model } from 'mongoose';

export type DemandeAchatStatus =
  | 'CREATION'
  | 'SOUMIS'
  | 'RECU_RB'
  | 'EN_VALIDATION_ADMIN'
  | 'VALIDE'
  | 'REFUSE'
  | 'DEMANDE_MODIF'
  | 'COMMANDE_PARTIELLE'
  | 'FINANCE_AUTORISEE';

export interface ILigneDemande {
  article: mongoose.Types.ObjectId;
  designation?: string;
  quantite: number;
  prixEstimatif: number;
  observation?: string;
  priorite?: boolean;
  commande?: mongoose.Types.ObjectId;
}

export interface IDemandeAchat extends Document {
  code: string;
  chantier: mongoose.Types.ObjectId;
  fournisseurSouhaite?: string;
  fournisseur?: mongoose.Types.ObjectId;
  articles: ILigneDemande[];
  urgence: 'Basse' | 'Normale' | 'Haute' | 'Critique';
  dateSouhaitee?: Date;
  observation?: string;
  statut: DemandeAchatStatus;
  documents: { nom: string; url: string; type: string }[];
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LigneDemandeSchema = new Schema<ILigneDemande>(
  {
    article: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    designation: { type: String, trim: true },
    quantite: { type: Number, required: true, min: 0 },
    prixEstimatif: { type: Number, required: true, min: 0 },
    observation: { type: String, trim: true },
    priorite: { type: Boolean, default: false },
    commande: { type: Schema.Types.ObjectId, ref: 'Commande' },
  },
  { _id: false }
);

const DemandeAchatSchema = new Schema<IDemandeAchat>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    fournisseurSouhaite: { type: String, trim: true },
    fournisseur: { type: Schema.Types.ObjectId, ref: 'Fournisseur' },
    articles: [LigneDemandeSchema],
    urgence: { type: String, enum: ['Basse', 'Normale', 'Haute', 'Critique'], default: 'Normale' },
    dateSouhaitee: { type: Date },
    observation: { type: String, trim: true },
    statut: {
      type: String,
      enum: [
        'CREATION',
        'SOUMIS',
        'RECU_RB',
        'EN_VALIDATION_ADMIN',
        'VALIDE',
        'REFUSE',
        'DEMANDE_MODIF',
        'COMMANDE_PARTIELLE',
        'FINANCE_AUTORISEE',
      ],
      default: 'CREATION',
    },
    documents: [
      {
        nom: { type: String, required: true },
        url: { type: String, required: true },
        type: { type: String, required: true },
      },
    ],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const DemandeAchat: Model<IDemandeAchat> =
  mongoose.models.DemandeAchat || mongoose.model<IDemandeAchat>('DemandeAchat', DemandeAchatSchema);

export default DemandeAchat;
