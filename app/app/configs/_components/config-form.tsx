"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Tag as TagIcon, AlertTriangle } from "lucide-react";
import {
  Button,
  Input,
  Textarea,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Checkbox,
  FormError,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Card,
  CardContent,
} from "@/components/ui";
import { JsonEditor } from "@/components/json-editor";
import { JsonView } from "@/components/json-view";
import { useToast } from "@/components/toast";
import {
  createConfigAction,
  updateConfigAction,
  getConfigAction,
} from "@/actions/configs";
import { createTagAction } from "@/actions/tags";
import {
  createConfigSchema,
  jsonDataSchema,
} from "@/lib/validators";
import type {
  ConfigType,
  ConfigEnvironment,
  ConfigStatus,
} from "@/lib/dal/types";

const TYPES: ConfigType[] = [
  "application",
  "api-endpoints",
  "feature-flags",
  "integration",
  "web-profile",
  "environment",
  "custom-json",
];
const ENVIRONMENTS: ConfigEnvironment[] = [
  "development",
  "staging",
  "production",
  "custom",
];
const STATUSES: ConfigStatus[] = ["draft", "active", "archived"];

export interface ConfigFormInitial {
  name: string;
  description: string;
  config_type: ConfigType;
  environment: ConfigEnvironment;
  project_id: string | null;
  collection_id: string | null;
  status: ConfigStatus;
  /** "YYYY-MM-DDTHH:mm" for datetime-local, or "". */
  expires_at: string;
  notes: string;
  dataText: string;
  tagIds: string[];
}

interface ConfigFormProps {
  mode: "create" | "edit";
  configId?: string;
  expectedVersion?: number;
  initial?: ConfigFormInitial;
  projects: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  onTagsChanged?: (tags: { id: string; name: string }[]) => void;
}

type CreateValues = z.infer<typeof createConfigSchema>;

/**
 * Form-level schema: the create shape plus an optional change summary.
 * Edit mode submits the same full payload through updateConfigAction, which
 * accepts partial updates — defaults keep every field populated.
 */
const formSchema = createConfigSchema.extend({
  change_summary: z
    .string()
    .trim()
    .max(500, "Change summary must be 500 characters or fewer")
    .optional(),
});
/**
 * Input type (not output): the schema has `.default()`s, and react-hook-form
 * holds pre-default values — typing the form with the input shape avoids the
 * zodResolver variance mismatch. The resolver still validates everything.
 */
type FormValues = z.input<typeof formSchema>;

function toIsoOrUndefined(local: string): string | undefined {
  const trimmed = local.trim();
  if (!trimmed) return undefined;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/**
 * Full configuration form (create + edit). Edit mode sends `expectedVersion`
 * for optimistic locking; a CONFLICT opens an honest "someone else changed
 * this" dialog with the server's current data shown for comparison.
 */
export function ConfigForm({
  mode,
  configId,
  expectedVersion,
  initial,
  projects,
  collections,
  tags,
  onTagsChanged,
}: ConfigFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const isEdit = mode === "edit";

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit && initial
      ? {
          name: initial.name,
          description: initial.description,
          config_type: initial.config_type,
          environment: initial.environment,
          project_id: initial.project_id,
          collection_id: initial.collection_id,
          status: initial.status,
          expires_at: initial.expires_at || undefined,
          notes: initial.notes,
        }
      : {
          name: "",
          description: "",
          config_type: "application",
          environment: initial?.environment ?? "development",
          project_id: null,
          collection_id: null,
          status: "draft",
          notes: "",
        },
  });

  const [dataText, setDataText] = React.useState(initial?.dataText ?? "{\n  \n}");
  const [dataParsed, setDataParsed] = React.useState<unknown | null>(null);
  const [dataValid, setDataValid] = React.useState(false);
  const [selectedTags, setSelectedTags] = React.useState<string[]>(initial?.tagIds ?? []);
  const [newTagName, setNewTagName] = React.useState("");
  const [creatingTag, setCreatingTag] = React.useState(false);
  const [conflict, setConflict] = React.useState<{
    serverUpdatedAt: string;
    serverVersion: number;
    serverData: unknown;
  } | null>(null);

  const toggleTag = (id: string) =>
    setSelectedTags((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );

  const addTag = async () => {
    const name = newTagName.trim();
    if (!name) return;
    setCreatingTag(true);
    const res = await createTagAction({ name });
    setCreatingTag(false);
    if (res.ok) {
      onTagsChanged?.([...tags, { id: res.data.id, name: res.data.name }]);
      setSelectedTags((prev) => [...prev, res.data.id]);
      setNewTagName("");
      toast({ title: "Tag created", variant: "success" });
    } else {
      toast({ title: "Could not create tag", description: res.error.message, variant: "error" });
    }
  };

  const submit = async (values: FormValues) => {
    if (!dataValid || dataParsed === null) {
      setError("root", { message: "Configuration data must be valid JSON." });
      return;
    }
    const payload = {
      ...values,
      data: dataParsed as Record<string, unknown>,
      expires_at:
        typeof values.expires_at === "string"
          ? (toIsoOrUndefined(values.expires_at) ?? null)
          : null,
      tag_ids: selectedTags,
      ...(isEdit ? { change_summary: values.change_summary } : {}),
    };

    if (isEdit) {
      const res = await updateConfigAction(configId!, payload, expectedVersion!);
      if (res.ok) {
        toast({ title: "Saved", description: `Version ${res.data.version} created.`, variant: "success" });
        router.push(`/app/configs/${configId}`);
        router.refresh();
      } else if (res.error.code === "CONFLICT") {
        // Optimistic-lock conflict: show the server's current state so the
        // user can compare instead of silently overwriting.
        const current = await getConfigAction(configId!);
        if (current.ok) {
          setConflict({
            serverUpdatedAt: current.data.updated_at,
            serverVersion: current.data.version,
            serverData: current.data.data,
          });
        } else {
          toast({ title: "Conflict", description: res.error.message, variant: "error" });
        }
      } else {
        toast({ title: "Save failed", description: res.error.message, variant: "error" });
      }
      return;
    }

    const res = await createConfigAction(payload as CreateValues);
    if (res.ok) {
      toast({ title: "Created", description: `"${res.data.name}" was created.`, variant: "success" });
      router.push(`/app/configs/${res.data.id}`);
      router.refresh();
    } else {
      toast({ title: "Create failed", description: res.error.message, variant: "error" });
    }
  };

  const selectField = (
    name: "config_type" | "environment" | "status" | "project_id" | "collection_id",
    label: string,
    options: { value: string; label: string }[],
    allowNone?: string,
  ) => {
    const fieldError = errors[name]?.message;
    return (
      <div>
        <Label htmlFor={name}>{label}</Label>
        <Controller
          control={control}
          name={name}
          render={({ field }) => (
            <Select
              value={(field.value ?? "__none") as string}
              onValueChange={(v) => field.onChange(v === "__none" ? null : v)}
            >
              <SelectTrigger id={name} className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowNone && <SelectItem value="__none">{allowNone}</SelectItem>}
                {options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {typeof fieldError === "string" && <FormError message={fieldError} />}
      </div>
    );
  };

  return (
    <>
      <form onSubmit={handleSubmit(submit)} className="space-y-6" noValidate>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="glass-panel">
            <CardContent className="space-y-4 pt-6">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="e.g. payment-service production"
                  className="mt-1.5"
                  aria-invalid={Boolean(errors.name) || undefined}
                />
                {errors.name && <FormError message={errors.name.message} />}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...register("description")}
                  placeholder="What is this configuration for?"
                  rows={3}
                  className="mt-1.5"
                />
                {errors.description && <FormError message={errors.description.message} />}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {selectField(
                  "config_type",
                  "Type",
                  TYPES.map((t) => ({ value: t, label: t })),
                )}
                {selectField(
                  "environment",
                  "Environment",
                  ENVIRONMENTS.map((e) => ({ value: e, label: e })),
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {selectField(
                  "project_id",
                  "Project",
                  projects.map((p) => ({ value: p.id, label: p.name })),
                  "No project",
                )}
                {selectField(
                  "collection_id",
                  "Collection",
                  collections.map((c) => ({ value: c.id, label: c.name })),
                  "No collection",
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {selectField(
                  "status",
                  "Status",
                  STATUSES.map((s) => ({ value: s, label: s })),
                )}
                <div>
                  <Label htmlFor="expires_at">Expires at</Label>
                  <Input
                    id="expires_at"
                    type="datetime-local"
                    {...register("expires_at")}
                    className="mt-1.5"
                  />
                  {errors.expires_at && <FormError message={errors.expires_at.message} />}
                </div>
              </div>

              {isEdit && (
                <div>
                  <Label htmlFor="change_summary">Change summary</Label>
                  <Input
                    id="change_summary"
                    {...register("change_summary")}
                    placeholder="What changed in this version?"
                    className="mt-1.5"
                  />
                </div>
              )}

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  {...register("notes")}
                  placeholder="Internal notes (not part of the JSON data)"
                  rows={3}
                  className="mt-1.5"
                />
                {errors.notes && <FormError message={errors.notes.message} />}
              </div>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="glass-panel">
              <CardContent className="pt-6">
                <JsonEditor
                  label="Configuration data"
                  name="data"
                  value={dataText}
                  onChange={setDataText}
                  schema={jsonDataSchema}
                  onValidChange={(parsed, valid) => {
                    setDataParsed(parsed);
                    setDataValid(valid);
                  }}
                />
              </CardContent>
            </Card>

            <Card className="glass-panel">
              <CardContent className="space-y-3 pt-6">
                <Label className="flex items-center gap-2">
                  <TagIcon className="size-4 text-[var(--aidify-secondary)]" aria-hidden="true" />
                  Tags
                </Label>
                {tags.length === 0 ? (
                  <p className="text-sm text-[var(--aidify-secondary)]">
                    No tags yet — create one below.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => (
                      <label
                        key={t.id}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                          selectedTags.includes(t.id)
                            ? "border-[var(--aidify-blue)] bg-[var(--aidify-blue)]/15 text-[var(--aidify-text)]"
                            : "border-[var(--aidify-border)] text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
                        }`}
                      >
                        <Checkbox
                          checked={selectedTags.includes(t.id)}
                          onCheckedChange={() => toggleTag(t.id)}
                          aria-label={`Tag ${t.name}`}
                        />
                        {t.name}
                      </label>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <Input
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    placeholder="New tag name"
                    aria-label="New tag name"
                    maxLength={60}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addTag();
                      }
                    }}
                  />
                  <Button type="button" variant="secondary" onClick={addTag} disabled={creatingTag || !newTagName.trim()}>
                    <Plus aria-hidden="true" />
                    Add
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {errors.root && <FormError message={errors.root.message} />}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create configuration"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.back()} disabled={isSubmitting}>
            Cancel
          </Button>
        </div>
      </form>

      {/* Optimistic-lock conflict */}
      <Dialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-[var(--aidify-warning)]" aria-hidden="true" />
              Someone else changed this configuration
            </DialogTitle>
            <DialogDescription>
              The configuration was modified elsewhere (now at version {conflict?.serverVersion},
              updated {conflict && new Date(conflict.serverUpdatedAt).toLocaleString()}).
              Your edits are still in the form — nothing was overwritten. Reload to get the
              latest data, then re-apply your changes.
            </DialogDescription>
          </DialogHeader>
          {conflict && (
            <div className="max-h-[40vh] overflow-y-auto">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">
                Current server data (version {conflict.serverVersion})
              </p>
              <JsonView data={conflict.serverData} maxHeight="320px" />
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConflict(null)}>
              Keep editing
            </Button>
            <Button onClick={() => router.refresh()}>Reload latest</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
