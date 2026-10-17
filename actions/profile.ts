"use server";

import * as dal from "@/lib/dal/profile";
import type {
  ProfileUpdateInput,
  UserPreferencesPatch,
} from "@/lib/validators";
import { runAction, writeLimit } from "./_shared";

/** Profile server actions (thin wrappers over lib/dal/profile). */

export async function getProfileAction() {
  return runAction(() => dal.getProfile());
}

export async function updateProfileAction(input: ProfileUpdateInput) {
  const limited = await writeLimit("profile:update");
  if (limited) return limited;
  return runAction(() => dal.updateProfile(input));
}

/** Permanently delete the account and all of its data. No undo. */
export async function deleteAccountAction() {
  const limited = await writeLimit("profile:delete-account");
  if (limited) return limited;
  return runAction(() => dal.deleteAccount());
}

export async function getPreferencesAction() {
  return runAction(() => dal.getPreferences());
}

export async function updatePreferencesAction(patch: UserPreferencesPatch) {
  const limited = await writeLimit("profile:update-preferences");
  if (limited) return limited;
  return runAction(() => dal.updatePreferences(patch));
}

export async function listMySecurityEventsAction(query: unknown) {
  return runAction(() => dal.listMySecurityEvents(query));
}
