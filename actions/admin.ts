"use server";

import * as dal from "@/lib/dal/admin";
import * as adminQueries from "@/app/admin/_lib/queries";
import { getTicket as getSupportTicketDetail } from "@/lib/dal/support";
import type { TicketStatus } from "@/lib/dal/types";
import type {
  AnnouncementInput,
  UpdateAnnouncementInput,
  SystemSettingsPatch,
} from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/**
 * Admin server actions (thin wrappers over lib/dal/admin).
 * Every DAL call enforces administrator (or moderator) role server-side.
 * Mutations are rate-limited to 30/minute per IP.
 */

export async function getPlatformOverviewAction() {
  return runAction(() => dal.getPlatformOverview());
}

export async function listUsersAction(query: unknown) {
  return runAction(() => dal.listUsers(query));
}

export async function getUserDetailAction(id: string) {
  return runAction(() => dal.getUserDetail(id));
}

export async function suspendUserAction(id: string, reason?: string | null) {
  const limited = await writeLimit("admin:suspend-user");
  if (limited) return limited;
  return runAction(() => dal.suspendUser(id, reason));
}

export async function reactivateUserAction(id: string) {
  const limited = await writeLimit("admin:reactivate-user");
  if (limited) return limited;
  return runAction(() => dal.reactivateUser(id));
}

export async function setUserRolesAction(
  userId: string,
  roleIds: string[],
  reason?: string | null,
) {
  const limited = await writeLimit("admin:set-roles");
  if (limited) return limited;
  return runAction(() => dal.setUserRoles(userId, roleIds, reason));
}

export async function initiateRecoveryAction(id: string) {
  const limited = await writeLimit("admin:recovery");
  if (limited) return limited;
  return runAction(() => dal.initiateRecovery(id));
}

export async function moderateConfigsAction(query: unknown) {
  return runAction(() => dal.moderateConfigs(query));
}

export async function moderateArchiveAction(id: string, reason: string) {
  const limited = await writeLimit("admin:moderate-archive");
  if (limited) return limited;
  return runAction(() => dal.moderateArchive(id, reason));
}

export async function moderateDeleteAction(id: string, reason: string) {
  const limited = await writeLimit("admin:moderate-delete");
  if (limited) return limited;
  return runAction(() => dal.moderateDelete(id, reason));
}

export async function listAuditLogsAction(filters: unknown, query: unknown) {
  return runAction(() => dal.listAuditLogs(filters, query));
}

export async function listAnnouncementsAction() {
  return runAction(() => dal.listAnnouncements());
}

export async function createAnnouncementAction(input: AnnouncementInput) {
  const limited = await writeLimit("admin:announcement-create");
  if (limited) return limited;
  return runAction(() => dal.createAnnouncement(input));
}

export async function updateAnnouncementAction(
  id: string,
  input: UpdateAnnouncementInput,
) {
  const limited = await writeLimit("admin:announcement-update");
  if (limited) return limited;
  return runAction(() => dal.updateAnnouncement(id, input));
}

export async function deleteAnnouncementAction(id: string) {
  const limited = await writeLimit("admin:announcement-delete");
  if (limited) return limited;
  return runAction(() => dal.deleteAnnouncement(id));
}

export async function getSystemSettingsAction() {
  return runAction(() => dal.getSystemSettings());
}

export async function updateSystemSettingsAction(
  patch: SystemSettingsPatch,
  adminId: string,
) {
  const limited = await writeLimit("admin:settings-update");
  if (limited) return limited;
  return runAction(() => dal.updateSystemSettings(patch, adminId));
}

export async function listSupportTicketsAction(
  status: TicketStatus | null | undefined,
  query: unknown,
) {
  return runAction(() => dal.listSupportTickets(status, query));
}

export async function replyToTicketAdminAction(ticketId: string, body: string) {
  const limited = await writeLimit("admin:ticket-reply");
  if (limited) return limited;
  return runAction(() => dal.replyToTicketAdmin(ticketId, body));
}

export async function setTicketStatusAction(
  ticketId: string,
  status: TicketStatus,
) {
  const limited = await writeLimit("admin:ticket-status");
  if (limited) return limited;
  return runAction(() => dal.setTicketStatus(ticketId, status));
}

export async function getSystemHealthAction() {
  return runAction(() => dal.getSystemHealth());
}

/* ------------------------------------------------------------------ */
/* Admin page queries (app/admin/_lib/queries.ts).                      */
/* The shared DAL (lib/dal/*) is intentionally not modified by the      */
/* admin lane; these thin wrappers expose the page-level read model     */
/* (role/suspended filters, platform-wide collections, analytics,       */
/* permission matrix, CSV report data) to client components.            */
/* ------------------------------------------------------------------ */

export async function listUsersAdminAction(filters: unknown, query: unknown) {
  return runAction(() => adminQueries.listUsersAdmin(filters, query));
}

export async function getUserSuspensionAction(id: string) {
  return runAction(() => adminQueries.getUserSuspension(id));
}

export async function listRolesAction() {
  return runAction(() => adminQueries.listRoles());
}

export async function listRolesWithMembersAction() {
  return runAction(() => adminQueries.listRolesWithMembers());
}

export async function getPermissionMatrixAction() {
  return runAction(() => adminQueries.getPermissionMatrix());
}

export async function listCollectionsAdminAction(query: unknown) {
  return runAction(() => adminQueries.listCollectionsAdmin(query));
}

export async function getCollectionAdminDetailAction(id: string) {
  return runAction(() => adminQueries.getCollectionAdminDetail(id));
}

export async function getConfigAdminDetailAction(id: string) {
  return runAction(() => adminQueries.getConfigAdminDetail(id));
}

export async function moderateRestoreAction(id: string, reason: string) {
  const limited = await writeLimit("admin:moderate-restore");
  if (limited) return limited;
  return runAction(() => adminQueries.moderateRestore(id, reason));
}

export async function getPlatformAnalyticsAction(range: unknown) {
  return runAction(() => adminQueries.getPlatformAnalytics(range));
}

export async function listAuditLogsAdminAction(filters: unknown, query: unknown) {
  return runAction(() => adminQueries.listAuditLogsAdmin(filters, query));
}

export async function listAuditActionTypesAction() {
  return runAction(() => adminQueries.listAuditActionTypes());
}

/** Staff ticket detail (owner-or-staff read is enforced in the DAL). */
export async function getTicketDetailAction(id: string) {
  return runAction(() => getSupportTicketDetail(id));
}

export async function getPendingTicketsCountAction() {
  return runAction(() => adminQueries.getPendingTicketsCount());
}

export async function getRecentAdminActionsAction() {
  return runAction(() => adminQueries.getRecentAdminActions());
}

export async function getUsersReportAction() {
  return runAction(() => adminQueries.getUsersReport());
}

export async function getConfigsReportAction() {
  return runAction(() => adminQueries.getConfigsReport());
}

export async function getActivityReportAction() {
  return runAction(() => adminQueries.getActivityReport());
}

export async function getAuditReportAction() {
  return runAction(() => adminQueries.getAuditReport());
}
