"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  Badge,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  unreadCountAction,
  listNotificationsAction,
} from "@/actions/notifications";
import type { NotificationRow } from "@/lib/dal/types";

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Notification bell: unread badge + dropdown with the 5 latest notifications.
 * Refreshes every time the menu is opened (via the trigger click).
 */
export function NotificationBell() {
  const router = useRouter();
  const [unread, setUnread] = React.useState(0);
  const [items, setItems] = React.useState<NotificationRow[] | null>(null);

  const load = React.useCallback(async () => {
    const [countRes, listRes] = await Promise.all([
      unreadCountAction(),
      listNotificationsAction({ page: 1, pageSize: 5 }),
    ]);
    if (countRes.ok) setUnread(countRes.data.count);
    if (listRes.ok) setItems(listRes.data.items);
  }, []);

  // Initial load: all state updates happen in the async continuation, never
  // synchronously in the effect body.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [countRes, listRes] = await Promise.all([
        unreadCountAction(),
        listNotificationsAction({ page: 1, pageSize: 5 }),
      ]);
      if (cancelled) return;
      if (countRes.ok) setUnread(countRes.data.count);
      if (listRes.ok) setItems(listRes.data.items);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The trigger toggles internally; we piggyback to refresh the data.
  const handleTriggerKey = () => {
    void load();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        onClickCapture={handleTriggerKey}
        className="relative rounded-lg p-2 text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--aidify-text)] focus-visible:outline-2 focus-visible:outline-[var(--aidify-blue)]"
      >
        <Bell className="size-5" aria-hidden="true" />
        {unread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex size-4 items-center justify-center rounded-full bg-[var(--aidify-error)] text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifications
          {unread > 0 && (
            <Badge variant="error" className="text-[10px]">
              {unread} unread
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items === null ? (
          <div className="space-y-2 p-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
          </div>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-[var(--aidify-secondary)]">
            You&apos;re all caught up. No notifications yet.
          </p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem
              key={n.id}
              onClick={() =>
                router.push(
                  n.link && n.link.startsWith("/") ? n.link : "/app/notifications",
                )
              }
              className="flex-col !items-start gap-1"
            >
              <span className="flex w-full items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    n.read_at ? "bg-transparent" : "bg-[var(--aidify-blue)]",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate text-sm font-medium text-[var(--aidify-text)]">
                  {n.title}
                </span>
                <span className="ml-auto shrink-0 text-[11px] text-[var(--aidify-secondary)]">
                  {timeAgo(n.created_at)}
                </span>
              </span>
              {n.body && (
                <span className="line-clamp-2 pl-3.5 text-xs text-[var(--aidify-secondary)]">
                  {n.body}
                </span>
              )}
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/app/notifications")}
          className="justify-center font-medium"
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
