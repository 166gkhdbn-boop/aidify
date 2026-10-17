"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Plus,
  ArrowLeft,
  Send,
  LifeBuoy,
  ShieldCheck,
  User as UserIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Badge,
  EmptyState,
  Skeleton,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Textarea,
  Label,
  FormError,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Avatar,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  listMyTicketsAction,
  getTicketAction,
  createTicketAction,
  replyToTicketAction,
} from "@/actions/support";
import { ticketSchema } from "@/lib/validators";
import type { TicketRow, TicketReplyRow } from "@/lib/dal/types";
import { timeAgo } from "@/app/app/_components/notification-bell";

const STATUS_VARIANT: Record<string, "info" | "warning" | "success" | "muted"> = {
  open: "info",
  in_progress: "warning",
  resolved: "success",
  closed: "muted",
};
const PRIORITY_VARIANT: Record<string, "muted" | "info" | "warning" | "error"> = {
  low: "muted",
  medium: "info",
  high: "warning",
  urgent: "error",
};

const PAGE_SIZE = 20;
type NewTicketValues = z.input<typeof ticketSchema>;

function NewTicketDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (ticket: TicketRow) => void;
}) {
  const { toast } = useToast();
  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<NewTicketValues>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { subject: "", description: "", priority: "medium" },
  });
  const [priority, setPriority] = React.useState<NewTicketValues["priority"]>("medium");

  const submit = async (values: NewTicketValues) => {
    const res = await createTicketAction({
      subject: values.subject,
      description: values.description,
      priority: values.priority ?? "medium",
    });
    if (res.ok) {
      toast({ title: "Ticket created", description: "We'll get back to you soon.", variant: "success" });
      reset();
      setPriority("medium");
      onOpenChange(false);
      onCreated(res.data);
    } else {
      toast({ title: "Could not create ticket", description: res.error.message, variant: "error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New support ticket</DialogTitle>
          <DialogDescription>Describe the problem — include steps to reproduce when you can.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" {...register("subject")} className="mt-1.5" maxLength={200} />
            {errors.subject && <FormError message={errors.subject.message} />}
          </div>
          <div>
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select value={priority ?? "medium"} onValueChange={(v) => { const next = v as NonNullable<NewTicketValues["priority"]>; setValue("priority", next); setPriority(next); }}>
              <SelectTrigger id="ticket-priority" className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["low", "medium", "high", "urgent"] as const).map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.priority && <FormError message={errors.priority.message} />}
          </div>
          <div>
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea id="ticket-description" {...register("description")} rows={5} className="mt-1.5" />
            {errors.description && <FormError message={errors.description.message} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating…" : "Create ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Support center: ticket list + detail with reply thread. A reply on a
 * resolved ticket reopens it (handled by the DAL).
 */
export function SupportCenter() {
  const { toast } = useToast();
  const [tickets, setTickets] = React.useState<TicketRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [newOpen, setNewOpen] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<{ ticket: TicketRow; replies: TicketReplyRow[] } | null>(null);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [reply, setReply] = React.useState("");
  const [replying, setReplying] = React.useState(false);

  const loadPage = async (p: number) => {
    setLoading(true);
    const res = await listMyTicketsAction({ page: p, pageSize: PAGE_SIZE });
    setLoading(false);
    if (res.ok) {
      setTickets(res.data.items);
      setTotal(res.data.total);
      setPage(res.data.page);
    } else {
      toast({ title: "Could not load tickets", description: res.error.message, variant: "error" });
    }
  };

  // Initial load: state updates happen in the async continuation only.
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await listMyTicketsAction({ page: 1, pageSize: PAGE_SIZE });
      if (cancelled) return;
      setLoading(false);
      if (res.ok) {
        setTickets(res.data.items);
        setTotal(res.data.total);
        setPage(res.data.page);
      } else {
        toast({ title: "Could not load tickets", description: res.error.message, variant: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTicket = async (id: string) => {
    setSelectedId(id);
    setDetailLoading(true);
    const res = await getTicketAction(id);
    setDetailLoading(false);
    if (res.ok) {
      setDetail(res.data);
    } else {
      toast({ title: "Could not open ticket", description: res.error.message, variant: "error" });
      setSelectedId(null);
    }
  };

  const sendReply = async () => {
    const body = reply.trim();
    if (!body || !selectedId) return;
    setReplying(true);
    const res = await replyToTicketAction(selectedId, body);
    setReplying(false);
    if (res.ok) {
      setReply("");
      // Reload the thread (a user reply may have reopened the ticket).
      const refreshed = await getTicketAction(selectedId);
      if (refreshed.ok) {
        setDetail(refreshed.data);
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedId ? refreshed.data.ticket : t)),
        );
      }
      toast({ title: "Reply sent", variant: "success" });
    } else {
      toast({ title: "Could not send reply", description: res.error.message, variant: "error" });
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /* ------------------------------ detail ----------------------------- */
  if (selectedId) {
    return (
      <div>
        <Button variant="ghost" size="sm" onClick={() => { setSelectedId(null); setDetail(null); }} className="mb-4">
          <ArrowLeft aria-hidden="true" />
          Back to tickets
        </Button>
        {detailLoading || !detail ? (
          <div className="space-y-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="glass-panel">
              <CardContent className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold text-[var(--aidify-text)]">{detail.ticket.subject}</h2>
                  <Badge variant={STATUS_VARIANT[detail.ticket.status] ?? "muted"}>
                    {detail.ticket.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={PRIORITY_VARIANT[detail.ticket.priority] ?? "muted"}>
                    {detail.ticket.priority}
                  </Badge>
                  <span className="ml-auto text-xs text-[var(--aidify-secondary)]">
                    {timeAgo(detail.ticket.created_at)}
                  </span>
                </div>
                {detail.ticket.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--aidify-secondary)]">
                    {detail.ticket.description}
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="space-y-3">
              {detail.replies.length === 0 ? (
                <EmptyState title="No replies yet" description="Support will reply here — you'll be notified." />
              ) : (
                detail.replies.map((r) => (
                  <div
                    key={r.id}
                    className={`flex gap-3 ${r.is_staff ? "" : "flex-row-reverse"}`}
                  >
                    <Avatar
                      fallback={r.is_staff ? "S" : "Y"}
                      size="sm"
                      className="mt-1 shrink-0"
                    />
                    <div
                      className={`max-w-[80%] rounded-2xl border p-4 ${
                        r.is_staff
                          ? "border-[var(--aidify-border)] bg-white/[0.03]"
                          : "border-[var(--aidify-blue)]/25 bg-[var(--aidify-blue)]/[0.08]"
                      }`}
                    >
                      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[var(--aidify-secondary)]">
                        {r.is_staff ? (
                          <>
                            <ShieldCheck className="size-3.5" aria-hidden="true" />
                            Support
                          </>
                        ) : (
                          <>
                            <UserIcon className="size-3.5" aria-hidden="true" />
                            You
                          </>
                        )}
                        <span className="font-normal">· {timeAgo(r.created_at)}</span>
                      </p>
                      <p className="whitespace-pre-wrap text-sm text-[var(--aidify-text)]">{r.body}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Card className="glass-panel">
              <CardContent className="p-4">
                <Label htmlFor="ticket-reply">Your reply</Label>
                {detail.ticket.status === "resolved" && (
                  <p className="mt-1 text-xs text-[var(--aidify-warning)]">
                    This ticket is resolved — replying will reopen it.
                  </p>
                )}
                <Textarea
                  id="ticket-reply"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder="Write your reply…"
                  className="mt-2"
                  maxLength={10000}
                />
                <div className="mt-3 flex justify-end">
                  <Button onClick={sendReply} disabled={replying || !reply.trim()}>
                    <Send aria-hidden="true" />
                    {replying ? "Sending…" : "Send reply"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    );
  }

  /* -------------------------------- list ----------------------------- */
  return (
    <div>
      <div className="mb-4">
        <Button onClick={() => setNewOpen(true)}>
          <Plus aria-hidden="true" />
          New ticket
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : tickets.length === 0 ? (
        <Card className="glass-panel">
          <EmptyState
            icon={LifeBuoy}
            title="No tickets yet"
            description="Something broken or unclear? Open a ticket and we'll help."
            action={{ label: "New ticket", onClick: () => setNewOpen(true), icon: Plus }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <Card key={t.id} className="glass-panel-hover">
              <button
                type="button"
                onClick={() => void openTicket(t.id)}
                className="block w-full cursor-pointer p-4 text-left"
                aria-label={`Open ticket: ${t.subject}`}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--aidify-text)]">{t.subject}</span>
                  <Badge variant={STATUS_VARIANT[t.status] ?? "muted"}>
                    {t.status.replace("_", " ")}
                  </Badge>
                  <Badge variant={PRIORITY_VARIANT[t.priority] ?? "muted"}>{t.priority}</Badge>
                  <span className="ml-auto text-xs text-[var(--aidify-secondary)]">
                    Updated {timeAgo(t.updated_at)}
                  </span>
                </span>
                {t.description && (
                  <span className="mt-1 line-clamp-2 block text-sm text-[var(--aidify-secondary)]">
                    {t.description}
                  </span>
                )}
              </button>
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

      <NewTicketDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        onCreated={(t) => {
          setTickets((prev) => [t, ...prev]);
          setTotal((n) => n + 1);
        }}
      />
    </div>
  );
}
