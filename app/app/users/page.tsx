import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProxyUsers } from "@/lib/dal/proxy-users";
import { PageHeader } from "../_components/page-header";
import { UsersClient } from "./_components/users-client";

export const metadata: Metadata = { title: "Users" };

export default async function UsersPage() {
  const res = await listProxyUsers();
  if (!res.ok) notFound();
  return (
    <div>
      <PageHeader
        title="Users"
        description="Proxy users — data limits, expiries, configs and status. Quota and expiry are enforced automatically."
      />
      <UsersClient initial={res.data} />
    </div>
  );
}
