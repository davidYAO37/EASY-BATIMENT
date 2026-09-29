export const ALL_PERMISSIONS = [
  'chantier.read',
  'chantier.create',
  'chantier.update',
  'chantier.delete',

  'article.read',
  'article.create',
  'article.update',
  'article.delete',

  'fournisseur.read',
  'fournisseur.create',
  'fournisseur.update',
  'fournisseur.delete',

  'demandeAchat.read',
  'demandeAchat.create',
  'demandeAchat.update',
  'demandeAchat.delete',
  'demandeAchat.validate',

  'commande.read',
  'commande.create',
  'commande.update',
  'commande.delete',
  'commande.validate',

  'reception.read',
  'reception.create',
  'reception.update',
  'reception.delete',

  'decaissement.read',
  'decaissement.create',
  'decaissement.update',
  'decaissement.delete',

  'paiement.read',
  'paiement.create',
  'paiement.update',
  'paiement.delete',

  'stock.read',
  'stock.create',
  'stock.update',
  'stock.delete',

  'rapport.read',
  'rapport.create',
  'rapport.update',
  'rapport.delete',

  'utilisateur.read',
  'utilisateur.create',
  'utilisateur.update',
  'utilisateur.delete',

  'role.read',
  'role.create',
  'role.update',
  'role.delete',

  'audit.read',

  'dashboard.read',

  'admin.all',
] as const;

export type Permission = (typeof ALL_PERMISSIONS)[number];

export interface DefaultRole {
  code: string;
  name: string;
  description: string;
  permissions: Permission[];
  isActive: boolean;
}

export const DEFAULT_ROLES: DefaultRole[] = [
  {
    code: 'ADMIN',
    name: 'Administrateur',
    description: 'Validation, finances, contrôle des justificatifs et supervision',
    permissions: [...ALL_PERMISSIONS],
    isActive: true,
  },
  {
    code: 'SUPER_ADMIN',
    name: 'Super Administrateur',
    description: 'Utilisateurs, rôles, permissions, paramètres et sécurité',
    permissions: [...ALL_PERMISSIONS],
    isActive: true,
  },
  {
    code: 'CHEF_CHANTIER',
    name: 'Chef Chantier',
    description: 'Émet le bon de commande, suit le chantier et transmet les rapports',
    permissions: [
      'dashboard.read',
      'chantier.read',
      'article.read',
      'fournisseur.read',
      'demandeAchat.read',
      'demandeAchat.create',
      'demandeAchat.update',
      'demandeAchat.delete',
      'commande.read',
      'rapport.read',
      'rapport.create',
    ],
    isActive: true,
  },
  {
    code: 'RECEPTION_BUREAU',
    name: 'Réceptionniste Bureau',
    description: 'Reçoit les bons, transmet à l\'administrateur et passe les commandes fournisseurs',
    permissions: [
      'dashboard.read',
      'chantier.read',
      'chantier.create',
      'chantier.update',
      'article.read',
      'fournisseur.read',
      'fournisseur.create',
      'fournisseur.update',
      'demandeAchat.read',
      'demandeAchat.update',
      'commande.read',
      'commande.create',
      'commande.update',
    ],
    isActive: true,
  },
  {
    code: 'RECEPTION_CHANTIER',
    name: 'Réceptionniste Chantier',
    description: 'Réceptionne et valide la livraison, effectue le paiement, suit le stock et le chantier',
    permissions: [
      'dashboard.read',
      'chantier.read',
      'commande.read',
      'commande.update',
      'article.read',
      'reception.read',
      'reception.create',
      'stock.read',
      'stock.create',
      'stock.update',
      'decaissement.read',
      'paiement.read',
      'paiement.create',
      'rapport.read',
      'rapport.create',
    ],
    isActive: true,
  },
];
