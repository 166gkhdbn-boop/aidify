import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPreferences } from "@/lib/dal/profile";
import { PageHeader } from "@/app/app/_components/page-header";
import { SettingsForm } from "./_components/settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const res = await getPreferences();
  if (!res.ok) notFound();

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Your personal preferences, stored on your profile and applied everywhere."
      />
      <SettingsForm initial={res.data} />
    </div>
  );
}
