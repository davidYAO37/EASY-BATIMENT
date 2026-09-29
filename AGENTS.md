# AGENTS.md — easy-batiment

Application de gestion de chantiers pour une entreprise du bâtiment. Elle couvre les demandes d'achat, les commandes, les réceptions, les décaissements, les paiements, le stock, les rapports et l'audit.
L'utilisateur communique en **français** : les réponses et les libellés UI sont en français.

## Stack
- Next.js 16 (Pages Router, Turbopack), React 19, TypeScript
- React-Bootstrap + Bootstrap 5, react-icons
- MongoDB via Mongoose 9, validation Zod 4
- Auth JWT (bcryptjs, jsonwebtoken) ; token client stocké dans `localStorage` sous `easy_batiment_token`

## Commandes (Windows / PowerShell)
- Dev : `npm run dev` (http://localhost:3000)
- Build + typecheck : `npm run build` — **à lancer après chaque modification**
- Lint : `npm run lint`
- Seed rôles + admin : `Invoke-RestMethod -Uri "http://localhost:3000/api/seed" -Method POST`
  - Après un changement dans `lib/defaultRoles.ts` : re-seeder puis se déconnecter et se reconnecter (les permissions sont dans le token/contexte).
- Pas de suite de tests automatisés.

## Variables d'environnement (`.env`)
- `MONGODB_URI`, `JWT_SECRET` — ne jamais afficher ni committer leurs valeurs.

## Structure
- `pages/` — écrans ; `pages/api/` — routes API
- `models/` — schémas Mongoose (Commande, DemandeAchat, Decaissement, Paiement, Reception, Article, Fournisseur, Chantier, MouvementStock, RapportChantier, AuditLog, Role, User)
- `lib/api/middleware.ts` — `withAuth(handler)`, `handleError(res, err)`
- `lib/permissions.ts` — `buildPermission(resource, action)`, `hasPermission(role, perm)` (`admin.all` = accès universel)
- `lib/defaultRoles.ts` — rôles ADMIN, SUPER_ADMIN, CHEF_CHANTIER, RECEPTION_BUREAU, RECEPTION_CHANTIER
- `lib/workflow.ts` — transitions de statut (demandes d'achat + commandes)
- `lib/audit.ts` — `logAction(action, resource, { targetId, targetCode, details, req })`
- `lib/utils/codes.ts` — génération des codes métier
- `components/Navbar.tsx` — menus filtrés par permissions ; `pages/dashboard.tsx` — dashboard par rôle

## Conventions
- Toute route API : `withAuth` + vérification `hasPermission` côté serveur (ne jamais se fier au seul masquage UI).
- Chaque action métier est tracée via `logAction`.
- Avant un `.populate('x')`, importer le modèle référencé dans la route API, sinon on obtient `MissingSchemaError`.
- Champs optionnels Zod envoyés vides par les formulaires : accepter `''` (pas `.min(1).optional()`).

## Workflow métier
1. CC crée et soumet la demande (`CREATION → SOUMIS`)
2. RB réceptionne (`RECU_RB`) puis transmet à l'admin (`EN_VALIDATION_ADMIN`)
3. La RB (ou l'admin) peut modifier la demande et **cocher des priorités par ligne**, puis générer une commande partielle avec `COMMANDER` (`commande.create`). Statuts : `COMMANDE_PARTIELLE` tant qu'il reste des lignes non commandées, puis `FINANCE_AUTORISEE` quand tout est commandé. `VALIDER` (admin, `demandeAchat.validate`) commande toutes les lignes restantes. Chaque ligne commandée porte `commande` (réf. `Commande`) — plusieurs commandes par demande sont possibles.
4. La commande fournisseur est passée physiquement (téléphone ou document imprimé), hors application
5. RC réceptionne la livraison (`RECEPTION_RC`)
6. RC paie avec un décaissement autorisé (`PAIEMENT`). **Un décaissement = un seul paiement** : il passe à `Payé` et sort de la liste.
7. Justificatifs : reçu fournisseur (via RB) + reçu physique (RC) → `JUSTIFICATIFS`
8. L'admin compare les deux reçus et clôture (`CLOTURE`) ou signale une anomalie (`ANOMALIE`)

## État actuel et points techniques
- `lib/scope.ts` — filtrage des listes par chantier pour CC/RC.
- `components/Receipt.tsx` — upload/apercu des reçus (fournisseur et physique).
- `Paiement.decaissement` et `Decaissement.commande` ont un index unique pour garantir un décaissement/paiement unique.
- `/api/seed` est protégé : seul un admin/Super Admin authentifié peut l'appeler, et le mot de passe par défaut n'est plus renvoyé.
- Build et lint passent (`npm run build`, `npm run lint`).
- Avant chaque déploiement ou test complet : re-seeder si les rôles ont changé, puis se reconnecter pour régénérer le token.
