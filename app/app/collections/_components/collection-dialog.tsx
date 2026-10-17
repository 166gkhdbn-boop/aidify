"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Textarea,
  Label,
  FormError,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import {
  createCollectionAction,
  updateCollectionAction,
} from "@/actions/collections";
import { collectionSchema } from "@/lib/validators";
import type { CollectionRow } from "@/lib/dal/types";
import { COLLECTION_ICONS, COLLECTION_COLORS } from "./collection-icons";

const DEFAULT_COLOR = COLLECTION_COLORS[0] ?? "#438BFF";

interface CollectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collection?: CollectionRow | null;
  onSaved: () => void;
}

type Values = z.infer<typeof collectionSchema>;

/** New / edit collection dialog (name, description, color, icon). */
export function CollectionDialog({
  open,
  onOpenChange,
  collection,
  onSaved,
}: CollectionDialogProps) {
  const { toast } = useToast();
  const isEdit = Boolean(collection);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(collectionSchema),
    defaultValues: {
      name: collection?.name ?? "",
      description: collection?.description ?? "",
      color: collection?.color ?? COLLECTION_COLORS[0],
      icon: collection?.icon ?? "folder",
    },
  });

  // Local mirrors for the color/icon pickers (avoids watch(), which the
  // React Compiler cannot memoize). Synced when a different collection is
  // edited via the render-adjust pattern (same as AppShell/DataTable).
  const [color, setColor] = React.useState(collection?.color ?? DEFAULT_COLOR);
  const [iconKey, setIconKey] = React.useState(collection?.icon ?? "folder");
  const [prevEditingId, setPrevEditingId] = React.useState<string | null>(
    collection?.id ?? null,
  );
  if (prevEditingId !== (collection?.id ?? null)) {
    setPrevEditingId(collection?.id ?? null);
    setColor(collection?.color ?? DEFAULT_COLOR);
    setIconKey(collection?.icon ?? "folder");
  }

  // Reset the form when a different collection is edited.
  React.useEffect(() => {
    if (open) {
      reset({
        name: collection?.name ?? "",
        description: collection?.description ?? "",
        color: collection?.color ?? DEFAULT_COLOR,
        icon: collection?.icon ?? "folder",
      });
    }
  }, [open, collection, reset]);

  const submit = async (values: Values) => {
    const res = isEdit
      ? await updateCollectionAction(collection!.id, values)
      : await createCollectionAction(values);
    if (res.ok) {
      toast({
        title: isEdit ? "Collection updated" : "Collection created",
        description: `"${res.data.name}"`,
        variant: "success",
      });
      onOpenChange(false);
      onSaved();
    } else {
      toast({ title: "Save failed", description: res.error.message, variant: "error" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit collection" : "New collection"}</DialogTitle>
          <DialogDescription>
            Collections group related configurations together.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(submit)} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="collection-name">Name</Label>
            <Input id="collection-name" {...register("name")} className="mt-1.5" maxLength={120} />
            {errors.name && <FormError message={errors.name.message} />}
          </div>
          <div>
            <Label htmlFor="collection-description">Description</Label>
            <Textarea
              id="collection-description"
              {...register("description")}
              rows={3}
              className="mt-1.5"
              placeholder="What belongs in this collection?"
            />
            {errors.description && <FormError message={errors.description.message} />}
          </div>
          <div>
            <Label>Color</Label>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Collection color">
              {COLLECTION_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={c}
                  onClick={() => { setValue("color", c, { shouldValidate: true }); setColor(c); }}
                  className={`size-8 rounded-full border-2 transition-transform ${
                    color === c ? "scale-110 border-white" : "border-transparent"
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>
            {errors.color && <FormError message={errors.color.message} />}
          </div>
          <div>
            <Label>Icon</Label>
            <div className="mt-2 grid grid-cols-4 gap-2" role="radiogroup" aria-label="Collection icon">
              {COLLECTION_ICONS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={iconKey === key}
                  aria-label={label}
                  onClick={() => { setValue("icon", key, { shouldValidate: true }); setIconKey(key); }}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs transition-colors ${
                    iconKey === key
                      ? "border-[var(--aidify-blue)] bg-[var(--aidify-blue)]/15 text-[var(--aidify-text)]"
                      : "border-[var(--aidify-border)] text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
                  }`}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {label}
                </button>
              ))}
            </div>
            {errors.icon && <FormError message={errors.icon.message} />}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create collection"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
