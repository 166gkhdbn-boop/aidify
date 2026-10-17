import { getSessionUser, requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import { Alert } from "@/components/ui";
import { getSystemSettingsAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";
import { SettingsForm, type SettingsValues } from "../_components/settings-form";

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}
function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}
function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export default async function AdminSettingsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="change platform settings" backHref="/admin" />;
  }
  await requireRole("administrator");
  const me = await getSessionUser();

  const settingsRes = await getSystemSettingsAction();

  if (!settingsRes.ok || !me) {
    return (
      <div>
        <PageHeader title="Settings" />
        <Alert variant="error" title="Could not load settings">
          {!settingsRes.ok ? settingsRes.error.message : "Not signed in."}
        </Alert>
      </div>
    );
  }

  const raw = settingsRes.data;
  const initial: SettingsValues = {
    site_name: asString(raw.site_name, "Aidify"),
    registration_open: asBoolean(raw.registration_open, true),
    maintenance_mode: asBoolean(raw.maintenance_mode, false),
    support_email: asString(raw.support_email, ""),
    max_configs_per_user: asNumber(raw.max_configs_per_user, 500),
    announcement_banner: asString(raw.announcement_banner, ""),
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Platform settings that actually work. Every save is validated, audit-logged, and takes effect within about a minute."
      />
      <SettingsForm initial={initial} adminId={me.id} />
    </div>
  );
}
