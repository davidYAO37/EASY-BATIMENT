import mongoose, { Schema, Document, Model } from 'mongoose';

export type CommandeStatus =
  | 'COMMANDE_FOURNISSEUR'
  | 'LIVRAISON'
  | 'RECEPTION_RC'
  | 'PAIEMENT'
  | 'JUSTIFICATIFS'
  | 'CONTROLE_ADMIN'
  | 'CLOTURE'
  | 'ANOMALIE';

export interface ILigneCommande {
  article: mongoose.Types.ObjectId;
  designation?: string;
  quantite: number;
  prixUnitaire: number;
  total: number;
}

export interface ICommande extends Document {
  code: string;
  demandeAchat: mongoose.Types.ObjectId;
  chantier: mongoose.Types.ObjectId;
  fournisseur: mongoose.Types.ObjectId;
  articles: ILigneCommande[];
  montant: number;
  modePaiement: string;
  dateCommande: Date;
  datePrevueLivraison?: Date;
  bonCommande?: string;
  facture?: string;
  recuFournisseur?: string;
  recuFournisseurDate?: Date;
  recuFournisseurPar?: mongoose.Types.ObjectId;
  statut: CommandeStatus;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LigneCommandeSchema = new Schema<ILigneCommande>(
  {
    article: { type: Schema.Types.ObjectId, ref: 'Article', required: true },
    designation: { type: String, trim: true },
    quantite: { type: Number, required: true, min: 0 },
    prixUnitaire: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const CommandeSchema = new Schema<ICommande>(
  {
    code: { type: String, required: true, unique: true, trim: true },
    demandeAchat: { type: Schema.Types.ObjectId, ref: 'DemandeAchat', required: true },
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    fournisseur: { type: Schema.Types.ObjectId, ref: 'Fournisseur', required: true },
    articles: [LigneCommandeSchema],
    montant: { type: Number, required: true, min: 0 },
    modePaiement: { type: String, required: true, trim: true },
    dateCommande: { type: Date, required: true },
    datePrevueLivraison: { type: Date },
    bonCommande: { type: String },
    facture: { type: String },
    recuFournisseur: { type: String },
    recuFournisseurDate: { type: Date },
    recuFournisseurPar: { type: Schema.Types.ObjectId, ref: 'User' },
    statut: {
      type: String,
      enum: [
        'COMMANDE_FOURNISSEUR',
        'LIVRAISON',
        'RECEPTION_RC',
        'PAIEMENT',
        'JUSTIFICATIFS',
        'CONTROLE_ADMIN',
        'CLOTURE',
        'ANOMALIE',
      ],
      default: 'COMMANDE_FOURNISSEUR',
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

const Commande: Model<ICommande> =
  mongoose.models.Commande || mongoose.model<ICommande>('Commande', CommandeSchema);

export default Commande;
