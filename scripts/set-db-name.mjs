// Ajoute le nom de base /easy-batiment à MONGODB_URI dans .env (sans l'afficher).
import { readFileSync, writeFileSync } from 'node:fs';

const DB_NAME = 'easy-batiment';
const content = readFileSync('.env', 'utf8');

const updated = content.replace(/^(MONGODB_URI\s*=\s*)(.+)$/m, (m, key, raw) => {
  const v = raw.trim().replace(/^["']|["']$/g, '');
  const i = v.indexOf('.mongodb.net');
  if (i < 0) return m; // URI non-Atlas : on ne touche pas
  const after = v.slice(i + '.mongodb.net'.length);
  const q = after.indexOf('?');
  const path = q >= 0 ? after.slice(0, q) : after;
  if (path === `/${DB_NAME}`) return m; // déjà correct
  const suffix = q >= 0 ? after.slice(q) : '';
  return `${key}${v.slice(0, i + '.mongodb.net'.length)}/${DB_NAME}${suffix}`;
});

if (updated === content) {
  console.log('Aucun changement (URI déjà correcte ou non-Atlas).');
} else {
  writeFileSync('.env', updated);
  console.log(`MONGODB_URI mise à jour → base "${DB_NAME}"`);
}
