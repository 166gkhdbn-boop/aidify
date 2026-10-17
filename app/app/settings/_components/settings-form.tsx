"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Switch,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { updatePreferencesAction } from "@/actions/profile";
import type { UserPreferences } from "@/lib/validators";
import type { ConfigEnvironment } from "@/lib/dal/types";

const ENVIRONMENTS: ConfigEnvironment[] = ["development", "staging", "production", "custom"];

/**
 * Persisted user preferences — every control writes to
 * `profiles.preferences` via the DAL. No fake toggles.
 */
export function SettingsForm({ initial }: { initial: UserPreferences }) {
  const { toast } = useToast();
  const router = useRouter();
  const [prefs, setPrefs] = React.useState<UserPreferences>(initial);
  const [saving, setSaving] = React.useState(false);
  const dirty = JSON.stringify(prefs) !== JSON.stringify(initial);

  const save = async () => {
    setSaving(true);
    const res = await updatePreferencesAction({
      emailNotifications: prefs.emailNotifications,
      defaultPageSize: prefs.defaultPageSize,
      defaultEnvironment: prefs.defaultEnvironment,
      maskSecrets: prefs.maskSecrets,
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: "Settings saved", variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Could not save settings", description: res.error.message, variant: "error" });
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Notifications</CardTitle>
          <CardDescription>Control which emails Aidify sends you.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="email-notifications" className="font-medium">Email notifications</Label>
              <p className="mt-0.5 text-sm text-[var(--aidify-secondary)]">
                Ticket replies, mentions and important account updates.
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={prefs.emailNotifications}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, emailNotifications: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Tables</CardTitle>
          <CardDescription>Defaults for paginated lists.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs">
            <Label htmlFor="default-page-size">Default rows per page</Label>
            <Select
              value={String(prefs.defaultPageSize)}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, defaultPageSize: Number(v) as 10 | 20 | 50 }))
              }
            >
              <SelectTrigger id="default-page-size" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n} per page
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle className="text-base">Configurations</CardTitle>
          <CardDescription>Sensible defaults when creating configurations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="max-w-xs">
            <Label htmlFor="default-environment">Default environment</Label>
            <Select
              value={prefs.defaultEnvironment}
              onValueChange={(v) =>
                setPrefs((p) => ({ ...p, defaultEnvironment: v as ConfigEnvironment }))
              }
            >
              <SelectTrigger id="default-environment" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENVIRONMENTS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="mask-secrets" className="font-medium">Mask secrets by default</Label>
              <p className="mt-0.5 text-sm text-[var(--aidify-secondary)]">
                Values under keys like password, token or secret render as ••••••
                in the JSON viewer until you toggle them visible.
              </p>
            </div>
            <Switch
              id="mask-secrets"
              checked={prefs.maskSecrets}
              onCheckedChange={(v) => setPrefs((p) => ({ ...p, maskSecrets: v }))}
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving || !dirty}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
