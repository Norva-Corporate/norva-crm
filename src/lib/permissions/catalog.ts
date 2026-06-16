// ============================================================
// Catalogue de permissions — source de vérité côté code
// ============================================================
// Les clés `module.action` doivent rester alignées avec celles seedées
// pour le rôle "admin" dans la migration 047_roles_permissions.sql.
//
// Ajouter une permission :
//   1. Compléter PERMISSION_CATALOG ci-dessous.
//   2. Ajouter la clé au seed `admin_perms` de la migration courante (ou
//      créer une migration patch qui l'INSERT pour le rôle admin).
//   3. Si applicable, appeler `assertPermission(...)` côté Server Action.
//   4. Côté UI, gater le bouton avec `<PermissionGate require="...">`.
//
// Supprimer une permission : on laisse la clé en DB (orpheline = ignorée),
// puis on la retire ici. Si une refonte de masse devient nécessaire, écrire
// une migration de nettoyage.
// ============================================================

export const PERMISSION_CATALOG = {
  companies:      ["read", "create", "update", "delete", "export", "assign"],
  contacts:       ["read", "create", "update", "delete", "export"],
  deals:          ["read", "create", "update", "delete", "assign", "mark_won", "mark_lost", "export"],
  projects:       ["read", "create", "update", "delete", "update_status"],
  invoices:       ["read", "create", "update", "delete", "update_status", "export"],
  tasks:          ["read", "create", "update", "delete", "update_status"],
  leads:          ["read", "convert", "qualify", "dismiss", "batch"],
  campaigns:      ["read", "create", "update", "validate_send", "reject"],
  briefs:         ["read", "create", "archive", "convert_to_project"],
  goals:          ["read", "create", "update", "archive", "delete"],
  reporting:      ["read"],
  task_templates: ["read", "create", "update", "delete", "apply"],
  integrations:   ["read", "connect", "disconnect"],
  settings:       ["read", "update"],
  users:          ["read", "invite", "update_role", "delete"],
  roles:          ["read", "manage"],
  tags:           ["manage"],
  activities:     ["create", "delete"],
  objections:     ["read", "create", "delete"],
  calls:          ["read", "create", "delete"],
} as const satisfies Record<string, readonly string[]>;

export type PermissionModule = keyof typeof PERMISSION_CATALOG;

// Construction du type littéral `${module}.${action}` pour l'autocomplete
// dans assertPermission, usePermission, <PermissionGate>.
type ModuleActions<M extends PermissionModule> = (typeof PERMISSION_CATALOG)[M][number];
export type PermissionKey = {
  [M in PermissionModule]: `${M}.${ModuleActions<M>}`;
}[PermissionModule];

export const ALL_PERMISSIONS: readonly PermissionKey[] = Object.entries(
  PERMISSION_CATALOG
).flatMap(([mod, actions]) =>
  actions.map((a) => `${mod}.${a}` as PermissionKey)
);

// Libellés français pour l'UI de la matrice (par défaut : capitalize l'action).
export const MODULE_LABELS: Record<PermissionModule, string> = {
  companies:      "Entreprises",
  contacts:       "Contacts",
  deals:          "Pipeline (deals)",
  projects:       "Projets",
  invoices:       "Facturation",
  tasks:          "Tâches",
  leads:          "Prospection (leads)",
  campaigns:      "Campagnes emailing",
  briefs:         "Briefs clients",
  goals:          "Objectifs",
  reporting:      "Reporting",
  task_templates: "Modèles de tâches",
  integrations:   "Intégrations",
  settings:       "Paramètres",
  users:          "Utilisateurs",
  roles:          "Rôles & permissions",
  tags:           "Étiquettes",
  activities:     "Activités / historique",
  objections:     "Objections",
  calls:          "Prospection (appels)",
};

export const ACTION_LABELS: Record<string, string> = {
  read:               "Consulter",
  create:             "Créer",
  update:             "Modifier",
  delete:             "Supprimer",
  export:             "Exporter",
  assign:             "Assigner",
  mark_won:           "Marquer gagné",
  mark_lost:          "Marquer perdu",
  update_status:      "Changer le statut",
  convert:            "Convertir en deal",
  qualify:            "Qualifier",
  dismiss:            "Ignorer",
  batch:              "Opérations en lot",
  validate_send:      "Valider & envoyer",
  reject:             "Rejeter",
  archive:            "Archiver",
  convert_to_project: "Convertir en projet",
  apply:              "Appliquer",
  connect:            "Connecter",
  disconnect:         "Déconnecter",
  invite:             "Inviter",
  update_role:        "Changer le rôle",
  manage:             "Gérer",
};

export function permissionLabel(key: PermissionKey): string {
  const [mod, action] = key.split(".") as [PermissionModule, string];
  return `${MODULE_LABELS[mod]} — ${ACTION_LABELS[action] ?? action}`;
}
