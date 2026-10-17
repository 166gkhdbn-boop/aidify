import { Check, Info, Minus } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { SetupRequired } from "@/components/setup-required";
import {
  Alert,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { getPermissionMatrixAction } from "@/actions/admin";
import { PageHeader } from "../_components/page-header";

export default async function AdminPermissionsPage() {
  if (!isSupabaseConfigured()) {
    return <SetupRequired feature="view permissions" backHref="/admin" />;
  }
  await requireRole("administrator");

  const matrixRes = await getPermissionMatrixAction();

  return (
    <div>
      <PageHeader
        title="Permissions"
        description="Which permissions each role holds, read live from role_permissions."
      />
      {!matrixRes.ok ? (
        <Alert variant="error" title="Could not load permission matrix">
          {matrixRes.error.message}
        </Alert>
      ) : matrixRes.data.permissions.length === 0 ? (
        <Alert variant="info" title="No permissions defined">
          The permissions table is empty — nothing to display.
        </Alert>
      ) : (
        <>
          <Alert variant="info" title="Read-only matrix" className="mb-4">
            <span className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              Permission grants are seeded with the platform and there is no
              grant/revoke API — this matrix is displayed, not edited. To
              change what a user can do, change their roles on the Roles page.
            </span>
          </Alert>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Permission matrix</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    {matrixRes.data.roles.map((r) => (
                      <TableHead key={r.id} className="text-center">
                        {r.name}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {matrixRes.data.permissions.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <p className="font-mono text-sm text-[var(--aidify-text)]">{p.name}</p>
                        {p.description && (
                          <p className="mt-0.5 text-xs text-[var(--aidify-secondary)]">
                            {p.description}
                          </p>
                        )}
                      </TableCell>
                      {matrixRes.data.roles.map((r) => {
                        const granted = (matrixRes.data.grants[r.id] ?? []).includes(p.name);
                        return (
                          <TableCell key={r.id} className="text-center">
                            {granted ? (
                              <Check
                                className="mx-auto size-4 text-[var(--aidify-success)]"
                                aria-label={`${r.name} has ${p.name}`}
                              />
                            ) : (
                              <Minus
                                className="mx-auto size-4 text-[var(--aidify-secondary)]/40"
                                aria-label={`${r.name} does not have ${p.name}`}
                              />
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
