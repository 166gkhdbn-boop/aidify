import type { Metadata } from "next";
import { PageHeader } from "@/app/app/_components/page-header";
import { SupportCenter } from "./_components/support-center";

export const metadata: Metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <div>
      <PageHeader
        title="Support"
        description="Open tickets, follow the conversation, and reply — replying to a resolved ticket reopens it."
      />
      <SupportCenter />
    </div>
  );
}
