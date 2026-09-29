import { buildPermission } from './permissions';

export type WorkflowAction =
  | 'SOUMETTRE'
  | 'RECEVOIR'
  | 'TRANSMETTRE_ADMIN'
  | 'VALIDER'
  | 'COMMANDER'
  | 'REFUSER'
  | 'DEMANDER_MODIFICATION'
  | 'AUTORISER_FINANCE'
  | 'COMMANDER'
  | 'LIVRER'
  | 'RECEVOIR_LIVRAISON'
  | 'EFFECTUER_PAIEMENT'
  | 'AJOUTER_JUSTIFICATIF'
  | 'CONTROLER'
  | 'CLOTURER';

type Transition = {
  from: string;
  action: WorkflowAction;
  to: string;
  permission: string;
};

const allTransitions: Transition[] = [
  { from: 'CREATION', action: 'SOUMETTRE', to: 'SOUMIS', permission: buildPermission('demandeAchat', 'create') },
  { from: 'SOUMIS', action: 'RECEVOIR', to: 'RECU_RB', permission: buildPermission('demandeAchat', 'update') },
  { from: 'RECU_RB', action: 'TRANSMETTRE_ADMIN', to: 'EN_VALIDATION_ADMIN', permission: buildPermission('demandeAchat', 'update') },
  { from: 'RECU_RB', action: 'COMMANDER', to: 'COMMANDE_PARTIELLE', permission: buildPermission('commande', 'create') },
  { from: 'COMMANDE_PARTIELLE', action: 'COMMANDER', to: 'COMMANDE_PARTIELLE', permission: buildPermission('commande', 'create') },
  { from: 'EN_VALIDATION_ADMIN', action: 'COMMANDER', to: 'COMMANDE_PARTIELLE', permission: buildPermission('commande', 'create') },
  { from: 'EN_VALIDATION_ADMIN', action: 'VALIDER', to: 'FINANCE_AUTORISEE', permission: buildPermission('demandeAchat', 'validate') },
  { from: 'COMMANDE_PARTIELLE', action: 'VALIDER', to: 'FINANCE_AUTORISEE', permission: buildPermission('demandeAchat', 'validate') },
  { from: 'EN_VALIDATION_ADMIN', action: 'REFUSER', to: 'REFUSE', permission: buildPermission('demandeAchat', 'validate') },
  { from: 'EN_VALIDATION_ADMIN', action: 'DEMANDER_MODIFICATION', to: 'DEMANDE_MODIF', permission: buildPermission('demandeAchat', 'validate') },
  { from: 'DEMANDE_MODIF', action: 'SOUMETTRE', to: 'SOUMIS', permission: buildPermission('demandeAchat', 'create') },

  { from: 'COMMANDE_FOURNISSEUR', action: 'LIVRER', to: 'LIVRAISON', permission: buildPermission('reception', 'create') },
  { from: 'COMMANDE_FOURNISSEUR', action: 'RECEVOIR_LIVRAISON', to: 'RECEPTION_RC', permission: buildPermission('reception', 'create') },
  { from: 'LIVRAISON', action: 'RECEVOIR_LIVRAISON', to: 'RECEPTION_RC', permission: buildPermission('reception', 'create') },
  { from: 'RECEPTION_RC', action: 'EFFECTUER_PAIEMENT', to: 'PAIEMENT', permission: buildPermission('paiement', 'create') },
  { from: 'PAIEMENT', action: 'AJOUTER_JUSTIFICATIF', to: 'JUSTIFICATIFS', permission: buildPermission('paiement', 'create') },
  { from: 'JUSTIFICATIFS', action: 'CONTROLER', to: 'CONTROLE_ADMIN', permission: buildPermission('admin', 'all') },
  { from: 'CONTROLE_ADMIN', action: 'CLOTURER', to: 'CLOTURE', permission: buildPermission('admin', 'all') },
  { from: 'CONTROLE_ADMIN', action: 'CLOTURER', to: 'ANOMALIE', permission: buildPermission('admin', 'all') },
];

export const demandeAchatTransitions: Transition[] = allTransitions.filter((t) =>
  ['CREATION', 'SOUMIS', 'RECU_RB', 'EN_VALIDATION_ADMIN', 'VALIDE', 'REFUSE', 'DEMANDE_MODIF', 'COMMANDE_PARTIELLE', 'FINANCE_AUTORISEE'].includes(t.from)
);

export const commandeTransitions: Transition[] = allTransitions.filter((t) =>
  ['COMMANDE_FOURNISSEUR', 'LIVRAISON', 'RECEPTION_RC', 'PAIEMENT', 'JUSTIFICATIFS', 'CONTROLE_ADMIN'].includes(t.from)
);

export function getNextStatus(current: string, action: WorkflowAction, transitions = allTransitions): string | null {
  const transition = transitions.find((t) => t.from === current && t.action === action);
  return transition ? transition.to : null;
}

export function getRequiredPermissionForTransition(
  current: string,
  action: WorkflowAction,
  transitions = allTransitions
): string | null {
  const transition = transitions.find((t) => t.from === current && t.action === action);
  return transition ? transition.permission : null;
}

// Backward compatibility
export function getNextDemandeAchatStatus(current: string, action: WorkflowAction): string | null {
  return getNextStatus(current, action, demandeAchatTransitions);
}

export function getRequiredPermission(current: string, action: WorkflowAction): string | null {
  return getRequiredPermissionForTransition(current, action, demandeAchatTransitions);
}

export function getNextCommandeStatus(current: string, action: WorkflowAction): string | null {
  return getNextStatus(current, action, commandeTransitions);
}

export function getRequiredPermissionCommande(current: string, action: WorkflowAction): string | null {
  return getRequiredPermissionForTransition(current, action, commandeTransitions);
}
