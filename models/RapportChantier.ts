import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRapportChantier extends Document {
  chantier: mongoose.Types.ObjectId;
  date: Date;
  activite: string;
  travauxRealises: string;
  personnelPresent: string;
  materielUtilise: string;
  difficultes?: string;
  incidents?: string;
  besoins?: string;
  observations?: string;
  photos: { type: string; url: string; legende?: string }[];
  luPar?: mongoose.Types.ObjectId[];
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const RapportChantierSchema = new Schema<IRapportChantier>(
  {
    chantier: { type: Schema.Types.ObjectId, ref: 'Chantier', required: true },
    date: { type: Date, required: true, default: Date.now },
    activite: { type: String, required: true, trim: true },
    travauxRealises: { type: String, required: true, trim: true },
    personnelPresent: { type: String, required: true, trim: true },
    materielUtilise: { type: String, required: true, trim: true },
    difficultes: { type: String, trim: true },
    incidents: { type: String, trim: true },
    besoins: { type: String, trim: true },
    observations: { type: String, trim: true },
    photos: [
      {
        type: { type: String, required: true },
        url: { type: String, required: true },
        legende: { type: String, trim: true },
      },
    ],
    luPar: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

const RapportChantier: Model<IRapportChantier> =
  mongoose.models.RapportChantier ||
  mongoose.model<IRapportChantier>('RapportChantier', RapportChantierSchema);

export default RapportChantier;
