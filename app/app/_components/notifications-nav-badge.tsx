"use client";

import * as React from "react";
import { Badge } from "@/components/ui";
import { unreadCountAction } from "@/actions/notifications";

/** Unread-count badge for the Notifications nav item (client-side fetch). */
export function NotificationsNavBadge() {
  const [unread, setUnread] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void unreadCountAction().then((res) => {
      if (!cancelled && res.ok) setUnread(res.data.count);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!unread) return null;
  return (
    <Badge variant="error" className="px-1.5 text-[10px] leading-4">
      {unread > 99 ? "99+" : unread}
    </Badge>
  );
}
