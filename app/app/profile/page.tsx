import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getProfile } from "@/lib/dal/profile";
import { PageHeader } from "@/app/app/_components/page-header";
import { ProfileForm } from "./_components/profile-form";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const user = await requireUser("/app/profile");
  const res = await getProfile();
  if (!res.ok) notFound();

  return (
    <div>
      <PageHeader
        title="Profile"
        description="How you appear in Aidify. Your email address cannot be changed here."
      />
      <ProfileForm profile={res.data} email={user.email ?? null} />
    </div>
  );
}
