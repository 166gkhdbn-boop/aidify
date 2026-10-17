"use server";

import * as dal from "@/lib/dal/proxy-users";
import type {
  CreateProxyUserInput,
  UpdateProxyUserInput,
} from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/**
 * Proxy user server actions (thin wrappers over lib/dal/proxy-users).
 * Mutations are rate-limited to 30/minute per IP.
 */

export async function listProxyUsersAction() {
  return runAction(() => dal.listProxyUsers());
}

export async function getProxyUserAction(id: string) {
  return runAction(() => dal.getProxyUser(id));
}

export async function createProxyUserAction(input: CreateProxyUserInput) {
  const limited = await writeLimit("proxy-users:create");
  if (limited) return limited;
  return runAction(() => dal.createProxyUser(input));
}

export async function updateProxyUserAction(
  id: string,
  input: UpdateProxyUserInput,
) {
  const limited = await writeLimit("proxy-users:update");
  if (limited) return limited;
  return runAction(() => dal.updateProxyUser(id, input));
}

export async function deleteProxyUserAction(id: string) {
  const limited = await writeLimit("proxy-users:delete");
  if (limited) return limited;
  return runAction(() => dal.deleteProxyUser(id));
}

export async function resetProxyUsageAction(id: string) {
  const limited = await writeLimit("proxy-users:reset");
  if (limited) return limited;
  return runAction(() => dal.resetProxyUsage(id));
}

export async function regenerateProxyUuidAction(id: string) {
  const limited = await writeLimit("proxy-users:regenerate");
  if (limited) return limited;
  return runAction(() => dal.regenerateProxyUuid(id));
}

export async function getProxyStatsAction() {
  return runAction(() => dal.getProxyStats());
}

export async function listProtocolSettingsAction() {
  return runAction(() => dal.listProtocolSettings());
}

export async function setProtocolSettingAction(key: string, value: boolean) {
  const limited = await writeLimit("proxy-users:protocol");
  if (limited) return limited;
  return runAction(() => dal.setProtocolSetting(key, value));
}
