import type { Metadata } from "next";
import { PageHeader } from "@/app/app/_components/page-header";
import { NotificationsList } from "./_components/notifications-list";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div>
      <PageHeader
        title="Notifications"
        description="System updates and messages. Opening a notification marks it as read."
      />
      <NotificationsList />
    </div>
  );
}
