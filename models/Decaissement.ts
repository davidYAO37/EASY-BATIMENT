import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IDecaissement extends Document {
  code: string;
  montant: number;
  commande: mongoose.Types.ObjectId;
  chantier: mongoose.Types.ObjectId;
  beneficiaire: string;
  motif: string;
  utilisateurAutorisateur: mongoose.Types.ObjectId;
  utilisateurReceptionnaire?: mongoose.Types.ObjectId;
  date: Date;
  statut: 'Autorisé' | 'Remis' | 'Payé';
  createdAt: Date;
  updatedAt: Date;
}

const DecaissementSchema = new Schema<IDecaissement>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    montant: { type: Number, required: true, min: 0 },
    commande: { type: Schema.Types.ObjectId, ref: 'Commande', required: true, unique: true },
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    beneficiaire: { type: String, required: true, trim: true },
    motif: { type: String, required: true, trim: true },
    utilisateurAutorisateur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    utilisateurReceptionnaire: { type: Schema.Types.ObjectId, ref: 'User' },
    date: { type: Date, required: true, default: Date.now },
    statut: { type: String, enum: ['Autorisé', 'Remis', 'Payé'], default: 'Autorisé' },
  },
  { timestamps: true }
);

const Decaissement: Model<IDecaissement> =
  mongoose.models.Decaissement || mongoose.model<IDecaissement>('Decaissement', DecaissementSchema);

export default Decaissement;
