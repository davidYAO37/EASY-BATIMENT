// Test de connexion MongoDB — n'affiche jamais l'URI.
// Usage : node scripts/test-db.mjs
import { existsSync, readFileSync } from 'node:fs';
import mongoose from 'mongoose';

const envFile = ['.env.local', '.env'].find(existsSync);
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    })
);

const uri = env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI absente de', envFile);
  process.exit(1);
}

const kind = uri.startsWith('mongodb+srv') ? 'MongoDB Atlas (en ligne)' : 'MongoDB local/autre';
console.log(`URI trouvée dans ${envFile} → ${kind}`);

try {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  const db = mongoose.connection.db;
  console.log('✅ Connexion réussie — base :', db.databaseName);
  const cols = await db.listCollections().toArray();
  console.log('Collections :', cols.map((c) => c.name).join(', ') || '(aucune)');
  const users = await db.collection('users').estimatedDocumentCount().catch(() => null);
  if (users !== null) console.log('Utilisateurs en base :', users);
} catch (e) {
  console.error('❌ Échec de connexion :', e.message);
  process.exit(1);
} finally {
  await mongoose.disconnect();
}
