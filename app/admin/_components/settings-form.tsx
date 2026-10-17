"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  FormError,
  Input,
  Label,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { updateSystemSettingsAction } from "@/actions/admin";
import type { SystemSettingsPatch } from "@/lib/validators";

export interface SettingsValues {
  site_name: string;
  registration_open: boolean;
  maintenance_mode: boolean;
  support_email: string;
  max_configs_per_user: number;
  announcement_banner: string;
}

/**
 * Platform settings form. Every setting here actually works — each card
 * documents exactly what it affects. Changes are validated, audit-logged,
 * and take effect within ~60 seconds (settings cache TTL).
 */
export function SettingsForm({
  initial,
  adminId,
}: {
  initial: SettingsValues;
  adminId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [values, setValues] = React.useState(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    const maxConfigs = Number(values.max_configs_per_user);
    if (!Number.isInteger(maxConfigs) || maxConfigs < 1 || maxConfigs > 100000) {
      setError("Max configurations per user must be a whole number between 1 and 100000.");
      return;
    }
    if (values.site_name.trim().length === 0) {
      setError("Site name cannot be empty.");
      return;
    }

    setBusy(true);
    setError(null);
    const patch: SystemSettingsPatch = {
      site_name: values.site_name.trim(),
      registration_open: values.registration_open,
      maintenance_mode: values.maintenance_mode,
      support_email: values.support_email.trim(),
      max_configs_per_user: maxConfigs,
      announcement_banner: values.announcement_banner.trim() || null,
    };
    const result = await updateSystemSettingsAction(patch, adminId);
    setBusy(false);
    if (result.ok) {
      toast({
        title: "Settings saved",
        description: "Changes are audit-logged and take effect within a minute.",
        variant: "success",
      });
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branding</CardTitle>
          <CardDescription>
            Affects: the brand label in the admin sidebar header (live now). The
            user app shell should read the same setting — see the wiring note below.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="site-name">Site name</Label>
          <Input
            id="site-name"
            value={values.site_name}
            onChange={(e) => set("site_name", e.target.value)}
            maxLength={120}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Access control</CardTitle>
          <CardDescription>
            Enforced server-side — toggling here changes real behavior immediately (≤60s cache).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="maintenance-mode">Maintenance mode</Label>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--aidify-secondary)]">
                Affects: <span className="font-mono">proxy.ts</span> redirects every
                non-admin request to /maintenance while on. Auth pages stay reachable.
                Administrators keep full access.
              </p>
            </div>
            <Switch
              id="maintenance-mode"
              checked={values.maintenance_mode}
              onCheckedChange={(checked) => set("maintenance_mode", checked)}
            />
          </div>
          {values.maintenance_mode && (
            <Alert variant="warning" title="Maintenance mode is ON">
              Non-admin users are currently blocked from the app and register pages.
            </Alert>
          )}
          <div className="flex items-start justify-between gap-4">
            <div>
              <Label htmlFor="registration-open">Registration open</Label>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--aidify-secondary)]">
                Affects: <span className="font-mono">/register</span> — when off, the
                signup page refuses new accounts.
              </p>
            </div>
            <Switch
              id="registration-open"
              checked={values.registration_open}
              onCheckedChange={(checked) => set("registration_open", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limits</CardTitle>
          <CardDescription>
            Enforced in the data layer when a configuration is created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="max-configs">Max configurations per user</Label>
          <Input
            id="max-configs"
            type="number"
            min={1}
            max={100000}
            value={values.max_configs_per_user}
            onChange={(e) => set("max_configs_per_user", Number(e.target.value))}
            className="max-w-48"
          />
          <p className="max-w-xl text-xs leading-relaxed text-[var(--aidify-secondary)]">
            Affects: <span className="font-mono">createConfig</span> rejects new
            configurations once a user reaches this many (counts all statuses).
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Support contact</CardTitle>
          <CardDescription>
            Shown to staff on the admin support queue page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="support-email">Support email</Label>
          <Input
            id="support-email"
            type="email"
            value={values.support_email}
            onChange={(e) => set("support_email", e.target.value)}
            placeholder="support@example.com"
            maxLength={254}
            className="max-w-md"
          />
          <p className="max-w-xl text-xs leading-relaxed text-[var(--aidify-secondary)]">
            Leave empty to hide the contact line. Aidify has no email provider
            configured, so this address is display-only.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Announcement banner</CardTitle>
          <CardDescription>
            Affects: a banner displayed at the top of the app shell, above the
            page content, whenever this text is set.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="announcement-banner">Banner text</Label>
          <Textarea
            id="announcement-banner"
            value={values.announcement_banner}
            onChange={(e) => set("announcement_banner", e.target.value)}
            placeholder="Leave empty for no banner"
            rows={2}
            maxLength={500}
            className="max-w-2xl"
          />
          <p className="max-w-xl text-xs leading-relaxed text-[var(--aidify-secondary)]">
            Rendered by <span className="font-mono">components/announcement-banner.tsx</span>,
            mounted in the user app shell (<span className="font-mono">app/app/layout.tsx</span>).
            Leave empty to hide the banner.
          </p>
        </CardContent>
      </Card>

      <FormError message={error} />

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={busy} disabled={!dirty}>
          Save settings
        </Button>
        {!dirty && (
          <p className="text-xs text-[var(--aidify-secondary)]">No unsaved changes.</p>
        )}
      </div>
    </div>
  );
}
