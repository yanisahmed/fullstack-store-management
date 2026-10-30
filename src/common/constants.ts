export const ROLES = ['superuser', 'admin', 'manager', 'cashier', 'viewer'] as const;
export type Role = (typeof ROLES)[number];

// Modules that can be switched on/off per store via subscription
export const MODULES = ['products', 'sales', 'customers', 'notifications'] as const;
export type AppModule = (typeof MODULES)[number];
