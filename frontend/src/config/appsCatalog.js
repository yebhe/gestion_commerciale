import {
  ShoppingCart,
  Package,
  Boxes,
  Users,
  Truck,
  BarChart3,
  UserCog,
  Settings,
  Building2,
  Plus,
  Receipt,
  RotateCcw,
  Tags,
  PackagePlus,
  ArrowLeftRight,
  History,
  UserPlus,
  ShieldCheck,
  FileDown,
  TrendingUp,
  Building,
  Store,
  FolderOpen,
  ScrollText,
  Paintbrush,
} from 'lucide-react';

// Sentinelle pour les "applications" réservées au rôle plateforme
// SUPER_ADMIN (is_superuser), qui n'a pas de permission tenant en base
// (_docs/06_ROLES_ET_PERMISSIONS.txt, section 2).
export const PLATFORM_PERMISSION = 'platform';

/**
 * Catalogue central des "applications" du dashboard, une par module métier
 * du catalogue de permissions (_docs/08_SYSTEM_ PERMISSIONS_CENTRAL.txt).
 * Chaque application affiche ses sous-sections en grandes icônes avec peu
 * de texte (interface conviviale, public peu à l'aise avec l'écrit).
 * `available: false` = fonctionnalité pas encore implémentée (affichée
 * mais désactivée, avec un badge "Bientôt").
 */
export const APPS = [
  {
    key: 'sales',
    label: 'Ventes',
    icon: ShoppingCart,
    permission: 'sales.view',
    subsections: [
      { key: 'new-sale', label: 'Nouvelle vente', icon: Plus, permission: 'sales.create', available: true },
      { key: 'sales-history', label: 'Historique des ventes', icon: Receipt, permission: 'sales.view', available: true },
      { key: 'refunds', label: 'Remboursements', icon: RotateCcw, permission: 'sales.refund', available: true },
    ],
  },
  {
    key: 'products',
    label: 'Produits',
    icon: Package,
    permission: 'products.view',
    subsections: [
      { key: 'products-list', label: 'Liste des produits', icon: Package, permission: 'products.view', available: true },
      { key: 'new-product', label: 'Ajouter un produit', icon: Plus, permission: 'products.create', available: true },
      { key: 'categories', label: 'Catégories', icon: Tags, permission: 'categories.view', available: true },
    ],
  },
  {
    key: 'inventory',
    label: 'Stock',
    icon: Boxes,
    permission: 'inventory.view',
    subsections: [
      { key: 'stock-entry', label: 'Entrée de stock', icon: PackagePlus, permission: 'inventory.stock_entry', available: true },
      { key: 'stock-transfer', label: 'Transfert de stock', icon: ArrowLeftRight, permission: 'inventory.stock_transfer', available: true },
      { key: 'stock-history', label: 'Historique du stock', icon: History, permission: 'inventory.view_history', available: true },
    ],
  },
  {
    key: 'customers',
    label: 'Clients',
    icon: Users,
    permission: 'customers.view',
    subsections: [
      { key: 'customers-list', label: 'Liste des clients', icon: Users, permission: 'customers.view', available: true },
      { key: 'new-customer', label: 'Ajouter un client', icon: Plus, permission: 'customers.create', available: true },
    ],
  },
  {
    key: 'suppliers',
    label: 'Fournisseurs',
    icon: Truck,
    permission: 'suppliers.view',
    subsections: [
      { key: 'suppliers-list', label: 'Liste des fournisseurs', icon: Truck, permission: 'suppliers.view', available: true },
      { key: 'new-supplier', label: 'Ajouter un fournisseur', icon: Plus, permission: 'suppliers.create', available: true },
    ],
  },
  {
    key: 'reports',
    label: 'Rapports',
    icon: BarChart3,
    permission: 'reports.view',
    subsections: [
      { key: 'sales-report', label: 'Rapport des ventes', icon: TrendingUp, permission: 'reports.sales', available: true },
      { key: 'inventory-report', label: 'Rapport de stock', icon: Boxes, permission: 'reports.inventory', available: true },
      { key: 'export', label: 'Exporter', icon: FileDown, permission: 'reports.export', available: true },
    ],
  },
  {
    key: 'employees',
    label: 'Employés',
    icon: UserCog,
    permission: 'users.view',
    subsections: [
      { key: 'employees-list', label: 'Liste des employés', icon: UserCog, permission: 'users.view', available: true },
      { key: 'new-employee', label: 'Ajouter un employé', icon: UserPlus, permission: 'users.create', available: true },
      { key: 'roles', label: 'Rôles', icon: ShieldCheck, permission: 'roles.view', available: true },
    ],
  },
  {
    key: 'stores',
    label: 'Magasins',
    icon: Store,
    permission: 'stores.view',
  },
  {
    key: 'settings',
    label: 'Paramètres',
    icon: Settings,
    permission: 'settings.view',
    subsections: [
      { key: 'appearance', label: 'Apparence', icon: Paintbrush, permission: 'settings.view', available: true },
      { key: 'company-info', label: "Informations de l'entreprise", icon: Building, permission: 'company.view', available: true },
    ],
  },
  {
    key: 'files',
    label: 'Fichiers',
    icon: FolderOpen,
    permission: 'files.view',
    subsections: [
      { key: 'files-list', label: 'Liste des fichiers', icon: FolderOpen, permission: 'files.view', available: true },
      { key: 'upload-file', label: 'Téléverser un fichier', icon: Plus, permission: 'files.upload', available: true },
    ],
  },
  {
    key: 'audit',
    label: 'Audit',
    icon: ScrollText,
    permission: 'audit.view',
  },
  {
    key: 'companies',
    label: 'Compagnies',
    icon: Building2,
    permission: PLATFORM_PERMISSION,
    isPlatform: true,
  },
];

/** Détermine si l'application doit être visible pour l'utilisateur courant. */
export function isAppVisible(app, { hasPermission, isSuperAdmin }) {
  if (app.permission === PLATFORM_PERMISSION) return Boolean(isSuperAdmin);
  return hasPermission(app.permission);
}

export function getVisibleApps(apps, { hasPermission, isSuperAdmin }) {
  return apps.filter((app) => isAppVisible(app, { hasPermission, isSuperAdmin }));
}
