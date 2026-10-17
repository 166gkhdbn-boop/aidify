"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FormError,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { replyToTicketAdminAction, setTicketStatusAction } from "@/actions/admin";
import type { TicketDetail } from "@/lib/dal/support";
import type { TicketStatus } from "@/lib/dal/types";
import { formatDateTime } from "@/app/admin/_lib/format";

const STATUSES: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

/**
 * Staff ticket detail: full reply thread, staff reply box, and status
 * transitions. Replies are marked is_staff server-side and notify the user.
 */
export function TicketDetailClient({ detail }: { detail: TicketDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const [body, setBody] = React.useState("");
  const [replyBusy, setReplyBusy] = React.useState(false);
  const [replyError, setReplyError] = React.useState<string | null>(null);
  const [statusBusy, setStatusBusy] = React.useState(false);

  async function sendReply() {
    if (body.trim().length === 0) {
      setReplyError("Write a reply first.");
      return;
    }
    setReplyBusy(true);
    setReplyError(null);
    const result = await replyToTicketAdminAction(detail.ticket.id, body.trim());
    setReplyBusy(false);
    if (result.ok) {
      setBody("");
      toast({ title: "Reply sent", description: "The user has been notified.", variant: "success" });
      router.refresh();
    } else {
      setReplyError(result.error.message);
    }
  }

  async function changeStatus(status: TicketStatus) {
    setStatusBusy(true);
    const result = await setTicketStatusAction(detail.ticket.id, status);
    setStatusBusy(false);
    if (result.ok) {
      toast({ title: "Status updated", description: `Ticket is now ${status.replace("_", " ")}.`, variant: "success" });
      router.refresh();
    } else {
      toast({ title: "Status update failed", description: result.error.message, variant: "error" });
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conversation</CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {/* The original ticket body opens the thread. */}
              <li className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-4">
                <p className="mb-1 flex items-center gap-2 text-xs text-[var(--aidify-secondary)]">
                  <Badge variant="muted">user</Badge>
                  {formatDateTime(detail.ticket.created_at)}
                </p>
                <p className="whitespace-pre-wrap text-sm text-[var(--aidify-text)]">
                  {detail.ticket.description || "No description provided."}
                </p>
              </li>
              {detail.replies.map((reply) => (
                <li
                  key={reply.id}
                  className={`rounded-xl border p-4 ${
                    reply.is_staff
                      ? "border-[var(--aidify-blue)]/30 bg-[var(--aidify-blue)]/[0.07]"
                      : "border-[var(--aidify-border)] bg-white/[0.02]"
                  }`}
                >
                  <p className="mb-1 flex items-center gap-2 text-xs text-[var(--aidify-secondary)]">
                    <Badge variant={reply.is_staff ? "info" : "muted"}>
                      {reply.is_staff ? "staff" : "user"}
                    </Badge>
                    {formatDateTime(reply.created_at)}
                  </p>
                  <p className="whitespace-pre-wrap text-sm text-[var(--aidify-text)]">
                    {reply.body}
                  </p>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Reply as staff</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="staff-reply">Your reply</Label>
              <Textarea
                id="staff-reply"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a helpful reply…"
                rows={4}
                maxLength={10000}
              />
              <FormError message={replyError} />
            </div>
            <Button onClick={sendReply} loading={replyBusy}>
              <Send aria-hidden="true" />
              Send reply
            </Button>
            <p className="text-xs text-[var(--aidify-secondary)]">
              Replying to an open ticket moves it to “in progress”. The user is notified.
            </p>
          </CardContent>
        </Card>
      </div>

      <div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ticket status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="ticket-status">Status</Label>
              <Select
                value={detail.ticket.status}
                onValueChange={(value) => void changeStatus(value as TicketStatus)}
                aria-label="Change ticket status"
              >
                <SelectTrigger id="ticket-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s === "in_progress" ? "In progress" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {statusBusy && (
              <p className="text-xs text-[var(--aidify-secondary)]">Updating…</p>
            )}
            <dl className="space-y-2 pt-1 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--aidify-secondary)]">Priority</dt>
                <dd className="font-medium text-[var(--aidify-text)]">{detail.ticket.priority}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--aidify-secondary)]">Created</dt>
                <dd className="text-[var(--aidify-secondary)]">{formatDateTime(detail.ticket.created_at)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--aidify-secondary)]">Updated</dt>
                <dd className="text-[var(--aidify-secondary)]">{formatDateTime(detail.ticket.updated_at)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
