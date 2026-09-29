import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IArticle extends Document {
  nom: string;
  unite: string;
  categorie?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ArticleSchema = new Schema<IArticle>(
  {
    nom: { type: String, required: true, unique: true, trim: true },
    unite: { type: String, required: true, trim: true },
    categorie: { type: String, trim: true },
  },
  { timestamps: true }
);

const Article: Model<IArticle> =
  mongoose.models.Article || mongoose.model<IArticle>('Article', ArticleSchema);

export default Article;
