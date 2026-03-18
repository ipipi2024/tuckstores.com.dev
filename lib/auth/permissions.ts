/**
 * Role-based permission model for business operations.
 *
 * Roles are defined in the DB enum `membership_role`.
 * This TypeScript layer mirrors those roles and defines what each can do.
 * Server actions and UI guards should call `canPerform` rather than
 * comparing role strings directly.
 */

export type MembershipRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'cashier'
  | 'inventory_clerk'
  | 'staff'

export type MembershipStatus = 'invited' | 'active' | 'suspended' | 'revoked'

export type BusinessAction =
  // Billing / ownership
  | 'manage_subscription'
  | 'transfer_ownership'
  // Staff / invitations
  | 'manage_staff'
  | 'view_staff'
  // Business settings
  | 'manage_settings'
  | 'manage_locations'
  // Products / categories
  | 'manage_products'
  | 'view_products'
  // Suppliers
  | 'manage_suppliers'
  | 'view_suppliers'
  // Purchases
  | 'create_purchase'
  | 'view_purchases'
  // Sales
  | 'create_sale'
  | 'view_sales'
  // Inventory adjustments (manual, not via purchase/sale)
  | 'adjust_inventory'
  | 'view_inventory'
  // Orders
  | 'view_orders'
  | 'manage_orders'
  // Delivery settings
  | 'manage_delivery_settings'
  // Analytics
  | 'view_analytics'
  // Announcements / messaging
  | 'manage_announcements'

const ALL_ACTIONS: BusinessAction[] = [
  'manage_subscription',
  'transfer_ownership',
  'manage_staff',
  'view_staff',
  'manage_settings',
  'manage_locations',
  'manage_products',
  'view_products',
  'manage_suppliers',
  'view_suppliers',
  'create_purchase',
  'view_purchases',
  'create_sale',
  'view_sales',
  'adjust_inventory',
  'view_inventory',
  'view_orders',
  'manage_orders',
  'manage_delivery_settings',
  'view_analytics',
  'manage_announcements',
]

export const ROLE_PERMISSIONS: Record<MembershipRole, BusinessAction[]> = {
  owner: ALL_ACTIONS,

  admin: ALL_ACTIONS.filter(
    (a) => a !== 'manage_subscription' && a !== 'transfer_ownership'
  ),

  manager: [
    'view_staff',
    'manage_settings',
    'manage_products',
    'view_products',
    'manage_suppliers',
    'view_suppliers',
    'create_purchase',
    'view_purchases',
    'create_sale',
    'view_sales',
    'adjust_inventory',
    'view_inventory',
    'view_orders',
    'manage_orders',
    'view_analytics',
    'manage_announcements',
  ],

  cashier: [
    'view_products',
    'create_sale',
    'view_sales',
    'view_inventory',
    'view_orders',
    'manage_orders',
  ],

  inventory_clerk: [
    'view_products',
    'view_suppliers',
    'create_purchase',
    'view_purchases',
    'view_inventory',
  ],

  staff: [
    'view_products',
    'view_sales',
    'view_inventory',
  ],
}

/**
 * Returns true if the given role is allowed to perform the given action.
 */
export function canPerform(role: MembershipRole, action: BusinessAction): boolean {
  return ROLE_PERMISSIONS[role]?.includes(action) ?? false
}

/**
 * Throws a descriptive error if the role cannot perform the action.
 * Use in server actions after confirming membership.
 */
export function assertCanPerform(role: MembershipRole, action: BusinessAction): void {
  if (!canPerform(role, action)) {
    throw new Error(
      `Role '${role}' does not have permission to perform '${action}'`
    )
  }
}

/**
 * Returns the role hierarchy level (higher = more privileged).
 * Useful for comparisons like "must be at least manager".
 */
export const ROLE_LEVEL: Record<MembershipRole, number> = {
  owner:           100,
  admin:           80,
  manager:         60,
  cashier:         40,
  inventory_clerk: 30,
  staff:           10,
}

export function isAtLeastRole(
  userRole: MembershipRole,
  minimumRole: MembershipRole
): boolean {
  return ROLE_LEVEL[userRole] >= ROLE_LEVEL[minimumRole]
}
