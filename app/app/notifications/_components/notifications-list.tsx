"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, BellOff, Trash2, ExternalLink } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  EmptyState,
  Skeleton,
  Badge,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  listNotificationsAction,
  markReadAction,
  markAllReadAction,
  deleteNotificationAction,
} from "@/actions/notifications";
import type { NotificationRow } from "@/lib/dal/types";
import { ConfirmDialog } from "@/app/app/_components/confirm-dialog";
import { timeAgo } from "@/app/app/_components/notification-bell";

const PAGE_SIZE = 20;

/**
 * Notifications list: read/unread states, mark-read on open (clicking a
 * notification marks it read, then follows its link), mark-all-read, delete.
 */
export function NotificationsList() {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState<NotificationRow | null>(null);

  const loadPage = async (p: number) => {
    setLoading(true);
    const res = await listNotificationsAction({ page: p, pageSize: PAGE_SIZE });
    setLoading(false);
    if (res.ok) {
      setItems(res.data.items);
      setTotal(res.data.total);
      setPage(res.data.page);
    } else {
      toast({ title: "Could not load notifications", description: res.error.message, variant: "error" });
    }
  };

  // Initial load: state updates happen in the async continuation only.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listNotificationsAction({ page: 1, pageSize: PAGE_SIZE });
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setTotal(res.data.total);
        setPage(res.data.page);
      } else {
        toast({ title: "Could not load notifications", description: res.error.message, variant: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openNotification = async (n: NotificationRow) => {
    if (!n.read_at) {
      const res = await markReadAction(n.id);
      if (res.ok) {
        setItems((prev) => prev.map((i) => (i.id === n.id ? res.data : i)));
      }
    }
    if (n.link && n.link.startsWith("/")) router.push(n.link);
  };

  const markAllRead = async () => {
    const res = await markAllReadAction();
    if (res.ok) {
      toast({
        title: "All caught up",
        description: `${res.data.marked} notification${res.data.marked === 1 ? "" : "s"} marked as read.`,
        variant: "success",
      });
      void loadPage(page);
    } else {
      toast({ title: "Action failed", description: res.error.message, variant: "error" });
    }
  };

  const doDelete = async () => {
    if (!deleting) return;
    const res = await deleteNotificationAction(deleting.id);
    setDeleting(null);
    if (res.ok) {
      toast({ title: "Deleted", variant: "success" });
      void loadPage(page);
    } else {
      toast({ title: "Delete failed", description: res.error.message, variant: "error" });
    }
  };

  const unreadCount = items.filter((i) => !i.read_at).length;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={markAllRead} disabled={unreadCount === 0}>
          <CheckCheck aria-hidden="true" />
          Mark all as read
        </Button>
        {unreadCount > 0 && (
          <Badge variant="error">{unreadCount} unread on this page</Badge>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card className="glass-panel">
          <EmptyState
            icon={BellOff}
            title="No notifications"
            description="System updates, ticket replies and announcements will appear here."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((n) => (
            <Card
              key={n.id}
              className={`glass-panel-hover ${n.read_at ? "opacity-70" : ""}`}
            >
              <CardContent className="flex items-start gap-3 p-4">
                <span
                  className={`mt-2 size-2 shrink-0 rounded-full ${n.read_at ? "bg-[var(--aidify-border-strong)]" : "bg-[var(--aidify-blue)]"}`}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={() => void openNotification(n)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                  aria-label={`${n.read_at ? "Open" : "Mark as read and open"}: ${n.title}`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-[var(--aidify-text)]">{n.title}</span>
                    {!n.read_at && <Badge variant="info">New</Badge>}
                    <span className="ml-auto shrink-0 text-xs text-[var(--aidify-secondary)]">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                  {n.body && (
                    <span className="mt-1 line-clamp-2 block text-sm text-[var(--aidify-secondary)]">
                      {n.body}
                    </span>
                  )}
                  {n.link && (
                    <span className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--aidify-cyan)]">
                      <ExternalLink className="size-3" aria-hidden="true" />
                      Open link
                    </span>
                  )}
                </button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setDeleting(n)}
                  aria-label={`Delete notification: ${n.title}`}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          ))}

          {pageCount > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => void loadPage(page - 1)}>
                Previous
              </Button>
              <span className="text-sm text-[var(--aidify-secondary)]">
                Page {page} of {pageCount}
              </span>
              <Button variant="secondary" size="sm" disabled={page >= pageCount} onClick={() => void loadPage(page + 1)}>
                Next
              </Button>
            </div>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete notification"
        description={deleting && <>Delete “{deleting.title}”?</>}
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
      />
    </div>
  );
}
