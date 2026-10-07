import mongoose, { Schema, Document, Model } from 'mongoose';

export type MouvementType = 'Entrée' | 'Sortie' | 'Transfert';

export interface IMouvementStock extends Document {
  chantier: mongoose.Types.ObjectId;
  article: mongoose.Types.ObjectId;
  type: MouvementType;
  quantite: number;
  motif: string;
  utilisateur: mongoose.Types.ObjectId;
  date: Date;
  reference?: string;
  stockTheorique?: number;
  stockReel?: number;
  createdAt: Date;
  updatedAt: Date;
}

const MouvementStockSchema = new Schema<IMouvementStock>(
  {
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    article: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    type: { type: String, enum: ['Entrée', 'Sortie', 'Transfert'], required: true },
    quantite: { type: Number, required: true, min: 0 },
    motif: { type: String, required: true, trim: true },
    utilisateur: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true, default: Date.now },
    reference: { type: String, trim: true },
    stockTheorique: { type: Number, min: 0 },
    stockReel: { type: Number, min: 0 },
  },
  { timestamps: true }
);

MouvementStockSchema.index({ chantier: 1, article: 1 });

const MouvementStock: Model<IMouvementStock> =
  mongoose.models.MouvementStock || mongoose.model<IMouvementStock>('MouvementStock', MouvementStockSchema);

export default MouvementStock;
