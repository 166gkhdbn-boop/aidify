"use client";

import * as React from "react";
import { Copy, Check, QrCode } from "lucide-react";
import type { UserLinks } from "@/lib/dal/proxy-users";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Button,
  Alert,
  EmptyState,
} from "@/components/ui";

function LinkRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [showQr, setShowQr] = React.useState(false);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(value)}`;
  return (
    <div className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{label}</span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(value).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowQr(!showQr)}>
            <QrCode className="size-4" /> QR
          </Button>
        </div>
      </div>
      <div className="break-all font-mono text-xs text-[var(--aidify-secondary)]">
        {value}
      </div>
      {showQr && (
        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrUrl}
            alt={`${label} QR code`}
            className="rounded-xl border-4 border-white"
            width={220}
            height={220}
          />
        </div>
      )}
    </div>
  );
}

export function UserLinksClient({
  userName,
  links,
  active,
}: {
  userName: string;
  links: UserLinks;
  active: boolean;
}) {
  const [copiedSub, setCopiedSub] = React.useState(false);
  const [showSubQr, setShowSubQr] = React.useState(false);
  const entries = [
    { label: "VLESS", value: links.vless },
    { label: "Trojan", value: links.trojan },
    { label: "VLESS (XHTTP)", value: links.xhttp },
  ].filter((e) => e.value) as { label: string; value: string }[];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Config links</CardTitle>
        <CardDescription>
          Share these with {userName} — import into v2rayNG or any client.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {!active && (
          <Alert variant="warning">
            This user is not active — these links are blocked server-side until
            re-enabled.
          </Alert>
        )}
        {entries.length === 0 ? (
          <EmptyState
            title="No protocols enabled"
            description="Enable VLESS, Trojan or XHTTP in Settings to generate links."
          />
        ) : (
          entries.map((e) => (
            <LinkRow key={e.label} label={e.label} value={e.value} />
          ))
        )}
        <div className="rounded-xl border border-dashed border-[var(--aidify-border)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold">
              Subscription (base64)
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(links.subscription).then(() => {
                    setCopiedSub(true);
                    setTimeout(() => setCopiedSub(false), 1500);
                  });
                }}
              >
                {copiedSub ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
                {copiedSub ? "Copied" : "Copy"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSubQr(!showSubQr)}
              >
                <QrCode className="size-4" /> QR
              </Button>
            </div>
          </div>
          <div className="max-h-24 overflow-auto break-all font-mono text-[11px] text-[var(--aidify-cyan)]">
            {links.subscription || "—"}
          </div>
          {showSubQr && links.subscription && (
            <div className="mt-3 flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(links.subscription)}`}
                alt="Subscription QR code"
                className="rounded-xl border-4 border-white"
                width={220}
                height={220}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
