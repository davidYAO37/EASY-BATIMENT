import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IFournisseur extends Document {
  nom: string;
  contact: string;
  adresse?: string;
  phone: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

const FournisseurSchema = new Schema<IFournisseur>(
  {
    nom: { type: String, required: true, unique: true, trim: true },
    contact: { type: String, required: true, trim: true },
    adresse: { type: String, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
  },
  { timestamps: true }
);

const Fournisseur: Model<IFournisseur> =
  mongoose.models.Fournisseur || mongoose.model<IFournisseur>('Fournisseur', FournisseurSchema);

export default Fournisseur;
