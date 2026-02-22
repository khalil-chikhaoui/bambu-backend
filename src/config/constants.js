
/**
 * Global User Roles Object
 * @constant
 * @type {Object}
 */
export const ROLES = {
  /** * @description Highest authority level. 
   * Full access to all business operations, team management, and financial settings.
   */
  ADMIN: "Admin",

  /** * @description Operational lead. 
   * Can create/edit invoices and manage sales, but restricted from modifying core business settings.
   */
  MANAGER: "Manager",

  /** * @description Read-only access. 
   * Ideal for accountants or auditors who need to view data without making changes.
   */
  VIEWER: "Viewer",
};