export function getDefaultRoute(permissions: string[]): string {
  if (permissions.includes('admin.all') || permissions.includes('dashboard.read')) {
    return '/dashboard';
  }
  if (permissions.includes('chantier.read')) {
    return '/chantiers';
  }
  if (permissions.includes('demandeAchat.read')) {
    return '/demandes-achat';
  }
  if (permissions.includes('commande.read')) {
    return '/commandes';
  }
  if (permissions.includes('reception.read')) {
    return '/receptions';
  }
  if (permissions.includes('stock.read')) {
    return '/stock';
  }
  if (permissions.includes('paiement.read')) {
    return '/paiements';
  }
  if (permissions.includes('rapport.read')) {
    return '/rapports';
  }
  if (permissions.includes('fournisseur.read')) {
    return '/fournisseurs';
  }
  if (permissions.includes('article.read')) {
    return '/articles';
  }
  if (permissions.includes('utilisateur.read')) {
    return '/utilisateurs';
  }
  if (permissions.includes('audit.read')) {
    return '/audit';
  }
  return '/login';
}
