import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IPaiement extends Document {
  code: string;
  decaissement: mongoose.Types.ObjectId;
  commande: mongoose.Types.ObjectId;
  chantier: mongoose.Types.ObjectId;
  montant: number;
  fournisseur: mongoose.Types.ObjectId;
  datePaiement: Date;
  modePaiement: string;
  recuFournisseur?: string;
  recuPhysique?: string;
  recuFournisseurDate?: Date;
  recuPhysiqueDate?: Date;
  effectuePar: mongoose.Types.ObjectId;
  statut: 'Effectué' | 'Contrôlé' | 'Anomalie';
  createdAt: Date;
  updatedAt: Date;
}

const PaiementSchema = new Schema<IPaiement>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    decaissement: { type: Schema.Types.ObjectId, ref: 'Decaissement', required: true, unique: true },
    commande: { type: Schema.Types.ObjectId, ref: 'Commande', required: true },
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    montant: { type: Number, required: true, min: 0 },
    fournisseur: { type: Schema.Types.ObjectId, ref: 'Fournisseur', required: true },
    datePaiement: { type: Date, required: true, default: Date.now },
    modePaiement: { type: String, required: true, trim: true },
    recuFournisseur: { type: String },
    recuPhysique: { type: String },
    recuFournisseurDate: { type: Date },
    recuPhysiqueDate: { type: Date },
    effectuePar: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    statut: { type: String, enum: ['Effectué', 'Contrôlé', 'Anomalie'], default: 'Effectué' },
  },
  { timestamps: true }
);

const Paiement: Model<IPaiement> =
  mongoose.models.Paiement || mongoose.model<IPaiement>('Paiement', PaiementSchema);

export default Paiement;
