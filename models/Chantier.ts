import mongoose, { Schema, Document, Model } from 'mongoose';

export type ChantierStatus = 'Préparation' | 'En cours' | 'Suspendu' | 'Terminé';

export interface IChantier extends Document {
  code: string;
  nom: string;
  client: string;
  localisation: string;
  chefChantier: mongoose.Types.ObjectId;
  receptionnisteBureau: mongoose.Types.ObjectId;
  receptionnisteChantier: mongoose.Types.ObjectId;
  budgetPrevisionnel: number;
  dateDebut: Date;
  datePrevisionnelleFin: Date;
  statut: ChantierStatus;
  createdAt: Date;
  updatedAt: Date;
}

const ChantierSchema = new Schema<IChantier>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    nom: { type: String, required: true, trim: true },
    client: { type: String, required: true, trim: true },
    localisation: { type: String, required: true, trim: true },
    chefChantier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receptionnisteBureau: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    receptionnisteChantier: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    budgetPrevisionnel: { type: Number, required: true, min: 0 },
    dateDebut: { type: Date, required: true },
    datePrevisionnelleFin: { type: Date, required: true },
    statut: {
      type: String,
      enum: ['Préparation', 'En cours', 'Suspendu', 'Terminé'],
      default: 'Préparation',
    },
  },
  { timestamps: true }
);

const Chantier: Model<IChantier> =
  mongoose.models.Chantier || mongoose.model<IChantier>('Chantier', ChantierSchema);

export default Chantier;
