import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listProtocolSettings } from "@/lib/dal/proxy-users";
import { PageHeader } from "../_components/page-header";
import { ProtocolsClient } from "./_components/protocols-client";

export const metadata: Metadata = { title: "Protocols" };

export default async function ProtocolsPage() {
  const res = await listProtocolSettings();
  if (!res.ok) notFound();
  const map: Record<string, string> = {};
  for (const p of res.data) map[p.key] = p.value;
  return (
    <div>
      <PageHeader
        title="Protocols"
        description="Which proxy protocols are served. Only protocols that work on Edge Functions can be enabled."
      />
      <ProtocolsClient initial={map} />
    </div>
  );
}
