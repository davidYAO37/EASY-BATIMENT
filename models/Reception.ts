import mongoose, { Schema, Document, Model } from 'mongoose';

export type ReceptionEtat =
  | 'Conforme'
  | 'Manquant'
  | 'Endommagé'
  | 'Non conforme'
  | 'Livraison partielle'
  | 'Autre';

export interface ILigneReception {
  article: mongoose.Types.ObjectId;
  designation?: string;
  commande: number;
  recu: number;
  etat: ReceptionEtat;
  commentaire?: string;
  photos?: string[];
}

export interface IReception extends Document {
  code: string;
  commande: mongoose.Types.ObjectId;
  chantier: mongoose.Types.ObjectId;
  fournisseur: mongoose.Types.ObjectId;
  lignes: ILigneReception[];
  dateReception: Date;
  recuPar: mongoose.Types.ObjectId;
  observation?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LigneReceptionSchema = new Schema<ILigneReception>(
  {
    article: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    designation: { type: String, trim: true },
    commande: { type: Number, required: true, min: 0 },
    recu: { type: Number, required: true, min: 0 },
    etat: {
      type: String,
      enum: ['Conforme', 'Manquant', 'Endommagé', 'Non conforme', 'Livraison partielle', 'Autre'],
      default: 'Conforme',
      required: true,
    },
    commentaire: { type: String, trim: true },
    photos: [{ type: String }],
  },
  { _id: false }
);

const ReceptionSchema = new Schema<IReception>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    commande: { type: Schema.Types.ObjectId, ref: 'Commande', required: true },
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    fournisseur: { type: Schema.Types.ObjectId, ref: 'Fournisseur', required: true },
    lignes: [LigneReceptionSchema],
    dateReception: { type: Date, required: true, default: Date.now },
    recuPar: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    observation: { type: String, trim: true },
  },
  { timestamps: true }
);

const Reception: Model<IReception> =
  mongoose.models.Reception || mongoose.model<IReception>('Reception', ReceptionSchema);

export default Reception;
