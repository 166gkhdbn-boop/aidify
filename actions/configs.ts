"use server";

import * as dal from "@/lib/dal/configs";
import type {
  CreateConfigInput,
  UpdateConfigInput,
  ImportConflictMode,
} from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/**
 * Config server actions (thin wrappers over lib/dal/configs).
 * Mutations are rate-limited to 30/minute per IP.
 */

export async function listConfigsAction(query: unknown) {
  return runAction(() => dal.listConfigs(query));
}

export async function getConfigAction(id: string) {
  return runAction(() => dal.getConfig(id));
}

export async function createConfigAction(input: CreateConfigInput) {
  const limited = await writeLimit("configs:create");
  if (limited) return limited;
  return runAction(() => dal.createConfig(input));
}

export async function updateConfigAction(
  id: string,
  input: UpdateConfigInput,
  expectedVersion: number,
) {
  const limited = await writeLimit("configs:update");
  if (limited) return limited;
  return runAction(() => dal.updateConfig(id, input, expectedVersion));
}

export async function duplicateConfigAction(id: string) {
  const limited = await writeLimit("configs:duplicate");
  if (limited) return limited;
  return runAction(() => dal.duplicateConfig(id));
}

export async function archiveConfigAction(id: string) {
  const limited = await writeLimit("configs:archive");
  if (limited) return limited;
  return runAction(() => dal.archiveConfig(id));
}

export async function restoreConfigAction(id: string) {
  const limited = await writeLimit("configs:restore");
  if (limited) return limited;
  return runAction(() => dal.restoreConfig(id));
}

export async function deleteConfigAction(id: string) {
  const limited = await writeLimit("configs:delete");
  if (limited) return limited;
  return runAction(() => dal.deleteConfig(id));
}

export async function bulkArchiveAction(ids: string[]) {
  const limited = await writeLimit("configs:bulk-archive");
  if (limited) return limited;
  return runAction(() => dal.bulkArchive(ids));
}

export async function bulkDeleteAction(ids: string[]) {
  const limited = await writeLimit("configs:bulk-delete");
  if (limited) return limited;
  return runAction(() => dal.bulkDelete(ids));
}

export async function bulkExportAction(ids: string[]) {
  const limited = await writeLimit("configs:bulk-export");
  if (limited) return limited;
  return runAction(() => dal.bulkExport(ids));
}

/** Validate an import payload (no writes). Reads are not rate-limited. */
export async function validateImportAction(json: unknown) {
  return runAction(() => dal.validateImport(json));
}

export async function importConfigsAction(
  items: unknown[],
  onConflict: ImportConflictMode,
) {
  const limited = await writeLimit("configs:import");
  if (limited) return limited;
  return runAction(() => dal.importConfigs(items, onConflict));
}

export async function getVersionsAction(configId: string) {
  return runAction(() => dal.getVersions(configId));
}

export async function getVersionAction(configId: string, versionNumber: number) {
  return runAction(() => dal.getVersion(configId, versionNumber));
}

export async function diffVersionsAction(
  configId: string,
  versionA: number,
  versionB: number,
) {
  return runAction(() => dal.diffVersions(configId, versionA, versionB));
}

export async function restoreVersionAction(
  configId: string,
  versionNumber: number,
  summary?: string | null,
) {
  const limited = await writeLimit("configs:restore-version");
  if (limited) return limited;
  return runAction(() => dal.restoreVersion(configId, versionNumber, summary));
}
