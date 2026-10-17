import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import {
  Alert,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { getCollectionAdminDetail } from "@/app/admin/_lib/queries";
import { PageHeader } from "../../_components/page-header";
import { formatDateTime } from "../../_lib/format";

export default async function AdminCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view collection details" backHref="/admin/collections" />;
  }
  await requireRole("administrator");
  const { id } = await params;

  const result = await getCollectionAdminDetail(id);
  if (!result.ok) {
    if (result.error.code === "NOT_FOUND" || result.error.code === "VALIDATION") {
      notFound();
    }
    return (
      <div>
        <PageHeader title="Collection" />
        <Alert variant="error" title="Could not load collection">
          {result.error.message}
        </Alert>
      </div>
    );
  }
  const collection = result.data;

  return (
    <div>
      <Link
        href="/admin/collections"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-[var(--aidify-secondary)] transition-colors hover:text-[var(--aidify-text)]"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Back to collections
      </Link>
      <PageHeader
        title={collection.name}
        description={`Owned by ${collection.owner_username ? `@${collection.owner_username}` : collection.owner_id}`}
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 p-5">
          <div className="flex items-center gap-2.5">
            <span
              className="size-4 rounded-full"
              style={{ backgroundColor: collection.color ?? "var(--aidify-blue)" }}
              aria-hidden="true"
            />
            {collection.archived_at ? (
              <Badge variant="muted">Archived</Badge>
            ) : (
              <Badge variant="success">Active</Badge>
            )}
          </div>
          {collection.description && (
            <p className="text-sm text-[var(--aidify-secondary)]">{collection.description}</p>
          )}
          <p className="ml-auto text-xs text-[var(--aidify-secondary)]">
            Created {formatDateTime(collection.created_at)} · Updated{" "}
            {formatDateTime(collection.updated_at)}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Configurations inside ({collection.config_count})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {collection.configs.length === 0 ? (
            <EmptyState
              title="No configurations"
              description="This collection does not contain any configurations."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {collection.configs.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link
                        href={`/admin/configs/${c.id}`}
                        className="font-medium text-[var(--aidify-cyan)] hover:underline"
                      >
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-[var(--aidify-secondary)]">{c.config_type}</TableCell>
                    <TableCell className="text-[var(--aidify-secondary)]">{c.environment}</TableCell>
                    <TableCell>
                      <Badge
                        variant={c.status === "active" ? "success" : c.status === "archived" ? "muted" : "info"}
                      >
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[var(--aidify-secondary)]">
                      v{c.version}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-[var(--aidify-secondary)]">
                      {formatDateTime(c.updated_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
