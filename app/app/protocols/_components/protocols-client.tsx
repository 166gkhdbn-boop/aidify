"use client";

import * as React from "react";
import { Zap, Shield, Radio, Server } from "lucide-react";
import { setProtocolSettingAction, setProxyHostAction } from "@/actions/proxy-users";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Switch, Input, Button } from "@/components/ui";
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
  const [host, setHost] = React.useState(initial.proxy_host ?? "");
  const [hostBusy, setHostBusy] = React.useState(false);

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

  async function saveHost() {
    setHostBusy(true);
    const res = await setProxyHostAction(host);
    setHostBusy(false);
    if (!res.ok) {
      toast({ title: res.error.message, variant: "error" });
      return;
    }
    toast({ title: "Proxy server updated" });
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Server className="size-5 text-[var(--aidify-blue)]" />
            <CardTitle>Proxy server</CardTitle>
          </div>
          <CardDescription>
            Host that serves the proxy. Config links are built for this server.
            The Wasmer Edge app serves VLESS-only at /ws.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="vless-test.wasmer.app"
              className="max-w-md"
              dir="ltr"
            />
            <Button onClick={saveHost} disabled={hostBusy || !host.trim()}>
              {hostBusy ? "Saving…" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
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
    </div>
  );
}
