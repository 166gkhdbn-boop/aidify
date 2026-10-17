"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormError,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  createAnnouncementAction,
  deleteAnnouncementAction,
  updateAnnouncementAction,
} from "@/actions/admin";
import type { AnnouncementRow } from "@/lib/dal/types";
import type { AnnouncementInput, UpdateAnnouncementInput } from "@/lib/validators";
import { formatDateTime } from "@/app/admin/_lib/format";
import { ConfirmDialog } from "./confirm-dialog";

type Audience = "all" | "users" | "admins";

function AudienceBadge({ audience }: { audience: Audience }) {
  const variant = audience === "all" ? "info" : audience === "users" ? "cyan" : "violet";
  return <Badge variant={variant}>{audience}</Badge>;
}

interface EditorState {
  mode: "create" | "edit";
  id?: string;
  title: string;
  body: string;
  audience: Audience;
  published: boolean;
}

const EMPTY_EDITOR: EditorState = {
  mode: "create",
  title: "",
  body: "",
  audience: "all",
  published: false,
};

/**
 * Announcement CRUD. Published announcements appear on user dashboards
 * (read from the announcements table by the dashboard DAL). Every change is
 * audit-logged server-side.
 */
export function AnnouncementsClient({
  initial,
}: {
  initial: AnnouncementRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [items, setItems] = React.useState(initial);
  const [editor, setEditor] = React.useState<EditorState | null>(null);
  const [deleting, setDeleting] = React.useState<AnnouncementRow | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function refresh() {
    router.refresh();
  }

  async function saveEditor() {
    if (!editor) return;
    if (editor.title.trim().length === 0 || editor.body.trim().length === 0) {
      setError("Title and body are required.");
      return;
    }
    setBusy(true);
    setError(null);
    const payload: AnnouncementInput | UpdateAnnouncementInput = {
      title: editor.title.trim(),
      body: editor.body.trim(),
      audience: editor.audience,
      published: editor.published,
    };
    const result =
      editor.mode === "create"
        ? await createAnnouncementAction(payload as AnnouncementInput)
        : await updateAnnouncementAction(editor.id!, payload);
    setBusy(false);
    if (result.ok) {
      setEditor(null);
      toast({
        title: editor.mode === "create" ? "Announcement created" : "Announcement updated",
        description: result.data.published
          ? "It is now visible on user dashboards."
          : "It is saved as a draft.",
        variant: "success",
      });
      // Optimistic local update; router.refresh() revalidates the server list.
      if (editor.mode === "create") setItems((prev) => [result.data, ...prev]);
      else setItems((prev) => prev.map((a) => (a.id === result.data.id ? result.data : a)));
      refresh();
    } else {
      setError(result.error.message);
    }
  }

  async function togglePublished(item: AnnouncementRow) {
    const result = await updateAnnouncementAction(item.id, {
      published: !item.published,
    });
    if (result.ok) {
      setItems((prev) => prev.map((a) => (a.id === item.id ? result.data : a)));
      toast({
        title: result.data.published ? "Published" : "Unpublished",
        description: result.data.published
          ? "Visible on user dashboards now."
          : "Hidden from user dashboards.",
        variant: "success",
      });
      refresh();
    } else {
      toast({ title: "Update failed", description: result.error.message, variant: "error" });
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setError(null);
    const result = await deleteAnnouncementAction(deleting.id);
    setBusy(false);
    if (result.ok) {
      setDeleting(null);
      setItems((prev) => prev.filter((a) => a.id !== deleting.id));
      toast({ title: "Announcement deleted", variant: "success" });
      refresh();
    } else {
      setError(result.error.message);
    }
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button onClick={() => { setError(null); setEditor({ ...EMPTY_EDITOR }); }}>
          <Plus aria-hidden="true" />
          New announcement
        </Button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No announcements"
          description="Create one to broadcast a message to user dashboards."
          action={{ label: "New announcement", onClick: () => setEditor({ ...EMPTY_EDITOR }), icon: Plus }}
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <CardTitle className="text-base">{item.title}</CardTitle>
                  <AudienceBadge audience={item.audience} />
                  <Badge variant={item.published ? "success" : "muted"}>
                    {item.published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <CardDescription>
                  Updated {formatDateTime(item.updated_at)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm text-[var(--aidify-secondary)]">
                  {item.body}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={item.published}
                      onCheckedChange={() => void togglePublished(item)}
                      aria-label={item.published ? `Unpublish ${item.title}` : `Publish ${item.title}`}
                    />
                    <span className="text-xs text-[var(--aidify-secondary)]">
                      {item.published ? "Visible on dashboards" : "Hidden"}
                    </span>
                  </div>
                  <div className="ml-auto flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setEditor({
                          mode: "edit",
                          id: item.id,
                          title: item.title,
                          body: item.body,
                          audience: item.audience,
                          published: item.published,
                        })
                      }
                    >
                      <Pencil aria-hidden="true" />
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setError(null); setDeleting(item); }}>
                      <Trash2 aria-hidden="true" />
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create / edit dialog */}
      <Dialog open={editor !== null} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.mode === "edit" ? "Edit announcement" : "New announcement"}</DialogTitle>
            <DialogDescription>
              Published announcements appear on user dashboards for the selected audience.
            </DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="ann-title">Title</Label>
                <Input
                  id="ann-title"
                  value={editor.title}
                  onChange={(e) => setEditor({ ...editor, title: e.target.value })}
                  placeholder="Scheduled maintenance on Friday"
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ann-body">Body</Label>
                <Textarea
                  id="ann-body"
                  value={editor.body}
                  onChange={(e) => setEditor({ ...editor, body: e.target.value })}
                  placeholder="What should users know?"
                  rows={5}
                  maxLength={10000}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="ann-audience">Audience</Label>
                  <Select
                    value={editor.audience}
                    onValueChange={(v) => setEditor({ ...editor, audience: v as Audience })}
                  >
                    <SelectTrigger id="ann-audience">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Everyone</SelectItem>
                      <SelectItem value="users">Users</SelectItem>
                      <SelectItem value="admins">Admins only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ann-published">Visibility</Label>
                  <div className="flex h-10 items-center gap-2">
                    <Switch
                      id="ann-published"
                      checked={editor.published}
                      onCheckedChange={(checked) => setEditor({ ...editor, published: checked })}
                    />
                    <span className="text-sm text-[var(--aidify-secondary)]">
                      {editor.published ? "Published" : "Draft"}
                    </span>
                  </div>
                </div>
              </div>
              <FormError message={error} />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditor(null)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={saveEditor} loading={busy}>
              {editor?.mode === "edit" ? "Save changes" : "Create announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              setDeleting(null);
              setError(null);
            }
          }}
          title={`Delete "${deleting.title}"?`}
          description="Published announcements disappear from user dashboards immediately."
          confirmLabel="Delete announcement"
          destructive
          requireReason={false}
          reasonLabel="Note"
          busy={busy}
          error={error}
          onConfirm={() => void confirmDelete()}
        />
      )}

      <Alert variant="info" title="Where announcements surface" className="mt-6">
        Announcements with audience “all” or “users” and published=true are read
        by the user dashboard data layer and shown to signed-in users.
      </Alert>
    </div>
  );
}
