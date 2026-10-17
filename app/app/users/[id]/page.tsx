import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  getProxyUser,
  listProtocolSettings,
  buildUserLinks,
  DEFAULT_PROXY_HOST,
  proxyUserStatus,
  formatBytes,
  usedBytes,
  daysUntilExpiry,
  type ProxyUserRow,
} from "@/lib/dal/proxy-users";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Badge,
  Button,
  Alert,
} from "@/components/ui";
import { PageHeader } from "../../_components/page-header";
import { UserLinksClient } from "./_components/user-links-client";

export const metadata: Metadata = { title: "User" };

const STATUS_META = {
  active: { variant: "success" as const, label: "Active" },
  disabled: { variant: "muted" as const, label: "Disabled" },
  expired: { variant: "error" as const, label: "Expired" },
  quota_exceeded: { variant: "warning" as const, label: "Quota used" },
};

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [userRes, protoRes] = await Promise.all([
    getProxyUser(id),
    listProtocolSettings(),
  ]);
  if (!userRes.ok) notFound();
  const user: ProxyUserRow = userRes.data;
  const protocols: Record<string, string> = {};
  if (protoRes.ok) for (const p of protoRes.data) protocols[p.key] = p.value;

  const status = proxyUserStatus(user);
  const meta = STATUS_META[status];
  const host = (protocols.proxy_host || "").trim() || DEFAULT_PROXY_HOST;
  const links = buildUserLinks(user, protocols, host);
  const used = usedBytes(user);
  const days = daysUntilExpiry(user.expires_at);

  return (
    <div>
      <Link
        href="/app/users"
        className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
      >
        <ArrowLeft className="size-4" /> Back to users
      </Link>
      <PageHeader
        title={user.name}
        description={`UUID ${user.uuid}`}
        actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
      />

      {status !== "active" && (
        <Alert
          variant={status === "disabled" ? "info" : "warning"}
          className="mb-6"
        >
          {status === "disabled" &&
            "This user is disabled — their configs and subscription are blocked."}
          {status === "expired" &&
            "This user's access has expired — their configs and subscription are blocked."}
          {status === "quota_exceeded" &&
            "This user has used up their data quota — their configs and subscription are blocked."}
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--aidify-secondary)]">
              Data used
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(used)}</div>
            <p className="mt-1 text-xs text-[var(--aidify-secondary)]">
              {user.data_limit != null
                ? `of ${formatBytes(Number(user.data_limit))}`
                : "Unlimited quota"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--aidify-secondary)]">
              Expiry
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.expires_at
                ? new Date(user.expires_at).toLocaleDateString()
                : "Never"}
            </div>
            <p className="mt-1 text-xs text-[var(--aidify-secondary)]">
              {days == null
                ? "No expiry date set"
                : days < 0
                  ? "Expired"
                  : days === 0
                    ? "Ends today"
                    : `${days} days remaining`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-[var(--aidify-secondary)]">
              Last seen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {user.last_seen
                ? new Date(user.last_seen).toLocaleDateString()
                : "—"}
            </div>
            <p className="mt-1 text-xs text-[var(--aidify-secondary)]">
              Created {new Date(user.created_at).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      </div>

      <UserLinksClient
        userName={user.name}
        links={links}
        active={status === "active"}
      />

      <div className="mt-6">
        <Link href="/app/users">
          <Button variant="ghost">Back to users</Button>
        </Link>
      </div>
    </div>
  );
}
