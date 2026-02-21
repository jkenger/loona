import { db, auditLogs } from "@/lib/db"

type AuditAction =
  // Contacts
  | "contact.create"
  | "contact.update"
  | "contact.delete"
  | "contact.view"
  // Loans
  | "loan.create"
  | "loan.delete"
  | "loan.assign_agent"
  | "loan.view"
  | "loan.approve"
  | "loan.reject"
  | "loan.updateClauses"
  | "loan.regenerate_schedule"
  // Payments
  | "payment.record"
  | "payment.reverse"
  | "payment.edit_date"
  | "payment.view"
  // Agents
  | "agent.create"
  | "agent.update"
  | "agent.suspend"
  | "agent.activate"
  | "agent.terminate"
  | "agent.reset_password"
  // Commissions
  | "commission.pay"
  | "commission.updateSettings"
  // Penalties
  | "penalty.apply"
  | "penalty.pay"
  | "penalty.waive"
  | "penalty.revert"
  | "penalty.updateSettings"
  // Lender settings
  | "lender.updateSettings"
  // Auth
  | "auth.login"
  | "auth.logout"
  // Admin
  | "admin.ban_user"
  | "admin.unban_user"
  | "admin.set_role"
  | "admin.create_user"
  | "admin.approve_waitlist"
  | "admin.delete_waitlist"
  // Blog
  | "blog.create"
  | "blog.update"
  | "blog.publish"
  | "blog.unpublish"
  | "blog.delete"
  // Playbook
  | "playbook.updateSection"

type EntityType = "contact" | "loan" | "payment" | "agent" | "commission" | "commission_settings" | "penalty" | "penalty_settings" | "lender_settings" | "user" | "waitlist" | "blog_post" | "blog_category" | "blog_tag" | "playbook_section"

interface AuditLogParams {
  userId: string
  userEmail: string
  action: AuditAction
  entityType: EntityType
  entityId?: string
  metadata?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

/**
 * Log an audit event. Non-blocking - errors are caught and logged.
 */
export async function logAudit(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      userEmail: params.userEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    })
  } catch (error) {
    // Don't throw - audit logging should never break the main operation
    console.error("[AUDIT] Failed to log:", error, { action: params.action, entityType: params.entityType })
  }
}

/**
 * Helper to create audit logger with pre-filled user info
 */
export function createAuditLogger(user: { id: string; email: string }) {
  return (
    action: AuditAction,
    entityType: EntityType,
    entityId?: string,
    metadata?: Record<string, unknown>
  ) => {
    // Fire and forget - don't await
    logAudit({
      userId: user.id,
      userEmail: user.email,
      action,
      entityType,
      entityId,
      metadata,
    })
  }
}
