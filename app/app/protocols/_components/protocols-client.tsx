"use client";

import * as React from "react";
import { Zap, Shield, Radio } from "lucide-react";
import { setProtocolSettingAction } from "@/actions/proxy-users";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Switch } from "@/components/ui";
import { useToast } from "@/components/toast";

const PROTOCOLS = [
  {
    key: "vless_enabled",
    name: "VLESS",
    icon: Zap,
    description: "Modern, lightweight and secure — over WebSocket + TLS. The default choice.",
  },
  {
    key: "trojan_enabled",
    name: "Trojan",
    icon: Shield,
    description: "Traffic looks like real HTTPS — resistant to detection.",
  },
  {
    key: "xhttp_enabled",
    name: "XHTTP",
    icon: Radio,
    description: "Pure HTTP transport — resistant to throttling and upload shaping.",
  },
];

export function ProtocolsClient({ initial }: { initial: Record<string, string> }) {
  const { toast } = useToast();
  const [state, setState] = React.useState<Record<string, boolean>>(() => ({
    vless_enabled: initial.vless_enabled !== "false",
    trojan_enabled: initial.trojan_enabled === "true",
    xhttp_enabled: initial.xhttp_enabled !== "false",
  }));
  const [busy, setBusy] = React.useState<string | null>(null);

  async function toggle(key: string, value: boolean) {
    setBusy(key);
    const res = await setProtocolSettingAction(key, value);
    setBusy(null);
    if (!res.ok) {
      toast({ title: res.error.message, variant: "error" });
      return;
    }
    setState((s) => ({ ...s, [key]: value }));
    toast({ title: `${key.replace("_enabled", "").toUpperCase()} ${value ? "enabled" : "disabled"}` });
  }

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PROTOCOLS.map((p) => (
        <Card key={p.key}>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <p.icon className="size-5 text-[var(--aidify-blue)]" />
              <CardTitle>{p.name}</CardTitle>
            </div>
            <Switch
              checked={state[p.key] ?? false}
              disabled={busy === p.key}
              onCheckedChange={(v) => toggle(p.key, v)}
            />
          </CardHeader>
          <CardContent>
            <CardDescription>{p.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
