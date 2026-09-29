// Mise à jour des permissions chantier :
// - RECEPTION_BUREAU : + chantier.create, chantier.update
// - CHEF_CHANTIER    : - chantier.create
// Usage : node scripts/update-roles.mjs
// Après exécution : chaque utilisateur doit se déconnecter puis se reconnecter.
import { existsSync, readFileSync } from 'node:fs';
import mongoose from 'mongoose';

const envFile = ['.env.local', '.env'].find(existsSync);
if (!envFile) {
  console.error('Aucun fichier .env trouvé');
  process.exit(1);
}
const env = Object.fromEntries(
  readFileSync(envFile, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^"|"$/g, '')])
);

if (!env.MONGODB_URI) {
  console.error('MONGODB_URI introuvable dans .env.local');
  process.exit(1);
}

await mongoose.connect(env.MONGODB_URI);
const roles = mongoose.connection.db.collection('roles');

// RB : ajout create + update
const rb = await roles.updateOne(
  { code: 'RECEPTION_BUREAU' },
  { $addToSet: { permissions: { $each: ['chantier.create', 'chantier.update'] } } }
);

// CC : retrait create
const cc = await roles.updateOne(
  { code: 'CHEF_CHANTIER' },
  { $pull: { permissions: 'chantier.create' } }
);

console.log('RECEPTION_BUREAU :', rb.matchedCount ? 'mis à jour' : 'RÔLE INTROUVABLE');
console.log('CHEF_CHANTIER    :', cc.matchedCount ? 'mis à jour' : 'RÔLE INTROUVABLE');

// Vérification
for (const code of ['RECEPTION_BUREAU', 'CHEF_CHANTIER']) {
  const r = await roles.findOne({ code });
  const chantier = (r?.permissions ?? []).filter((p) => p.startsWith('chantier.'));
  console.log(`${code} → ${chantier.join(', ') || '(aucune)'}`);
}

await mongoose.disconnect();
console.log('Terminé. Les utilisateurs doivent se reconnecter pour régénérer leur token.');
