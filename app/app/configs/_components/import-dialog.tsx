"use client";

import * as React from "react";
import { Upload, FileJson, AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Badge,
  EmptyState,
  Alert,
} from "@/components/ui";
import { useToast } from "@/components/toast";
import { validateImportAction, importConfigsAction } from "@/actions/configs";
import type { ImportConflictMode } from "@/lib/validators";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ConflictChoice {
  index: number;
  name: string;
  existingId: string;
  mode: ImportConflictMode;
}

/**
 * Import flow: pick a JSON file → server validates → errors shown, name
 * conflicts get per-item resolution (rename / skip / replace) → import.
 * Nothing is ever silently overwritten.
 */
export function ImportDialog({ open, onOpenChange, onImported }: ImportDialogProps) {
  const { toast } = useToast();
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = React.useState("");
  const [items, setItems] = React.useState<unknown[]>([]);
  const [errors, setErrors] = React.useState<{ index: number; message: string }[]>([]);
  const [conflicts, setConflicts] = React.useState<ConflictChoice[]>([]);
  const [validCount, setValidCount] = React.useState(0);
  const [phase, setPhase] = React.useState<"pick" | "review" | "importing">("pick");
  const [parseError, setParseError] = React.useState<string | null>(null);

  const reset = () => {
    setFileName("");
    setItems([]);
    setErrors([]);
    setConflicts([]);
    setValidCount(0);
    setPhase("pick");
    setParseError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    setFileName(file.name);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setParseError("This file is not valid JSON.");
      return;
    }

    const res = await validateImportAction(json);
    if (!res.ok) {
      setParseError(res.error.message);
      return;
    }

    const rawItems = Array.isArray(json)
      ? (json as unknown[])
      : ((json as { configs?: unknown }).configs as unknown[]);
    setItems(Array.isArray(rawItems) ? rawItems : []);
    setErrors(res.data.errors);
    setConflicts(
      res.data.conflicts.map((c) => ({ ...c, mode: "rename" as ImportConflictMode })),
    );
    setValidCount(
      Math.max(
        0,
        (Array.isArray(rawItems) ? rawItems.length : 0) - res.data.errors.length,
      ),
    );
    setPhase("review");
  };

  const setConflictMode = (index: number, mode: ImportConflictMode) => {
    setConflicts((prev) =>
      prev.map((c) => (c.index === index ? { ...c, mode } : c)),
    );
  };

  const doImport = async () => {
    setPhase("importing");
    const skipped = new Set(
      conflicts.filter((c) => c.mode === "skip").map((c) => c.index),
    );
    const replaceIdx = new Set(
      conflicts.filter((c) => c.mode === "replace").map((c) => c.index),
    );
    const errorIdx = new Set(errors.map((e) => e.index));

    // Batch 1: clean items + "rename" choices (rename only touches conflicts).
    const batchRename = items.filter(
      (_, i) => !skipped.has(i) && !replaceIdx.has(i) && !errorIdx.has(i),
    );
    // Batch 2: explicit "replace" choices.
    const batchReplace = items.filter(
      (_, i) => replaceIdx.has(i) && !errorIdx.has(i),
    );

    let imported = 0;
    let renamed = 0;
    let replaced = 0;
    const failed: string[] = [];

    const run = async (batch: unknown[], mode: ImportConflictMode) => {
      if (batch.length === 0) return;
      const res = await importConfigsAction(batch, mode);
      if (res.ok) {
        imported += res.data.imported;
        renamed += res.data.renamed;
        replaced += res.data.replaced;
        for (const e of res.data.errors) failed.push(`Item ${e.index + 1}: ${e.message}`);
      } else {
        failed.push(res.error.message);
      }
    };

    await run(batchRename, "rename");
    await run(batchReplace, "replace");

    const parts = [
      `${imported} imported`,
      renamed > 0 ? `${renamed} renamed` : null,
      replaced > 0 ? `${replaced} replaced` : null,
      skipped.size > 0 ? `${skipped.size} skipped` : null,
    ].filter(Boolean);

    if (failed.length > 0) {
      toast({
        title: "Import finished with errors",
        description: `${parts.join(", ")}. ${failed[0]}`,
        variant: "warning",
      });
    } else {
      toast({
        title: "Import complete",
        description: parts.join(", ") + ".",
        variant: "success",
      });
    }
    onImported();
    onOpenChange(false);
    reset();
  };

  const canImport = phase === "review" && validCount > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import configurations</DialogTitle>
          <DialogDescription>
            Upload a JSON file (an Aidify export or a plain array of configurations).
            Existing configurations are never overwritten without your choice.
          </DialogDescription>
        </DialogHeader>

        {phase === "pick" && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              aria-label="Choose a JSON file to import"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--aidify-border-strong)] bg-white/[0.02] px-6 py-12 transition-colors hover:border-[var(--aidify-blue)]/50 hover:bg-[var(--aidify-blue)]/[0.04]"
            >
              <Upload className="size-8 text-[var(--aidify-secondary)]" aria-hidden="true" />
              <span className="text-sm font-medium text-[var(--aidify-text)]">
                Choose a JSON file
              </span>
              <span className="text-xs text-[var(--aidify-secondary)]">
                Validated before anything is written
              </span>
            </button>
            {parseError && (
              <div className="mt-3">
                <Alert variant="error">{parseError}</Alert>
              </div>
            )}
          </div>
        )}

        {phase !== "pick" && (
          <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
            <div className="flex items-center gap-2 text-sm">
              <FileJson className="size-4 text-[var(--aidify-secondary)]" aria-hidden="true" />
              <span className="font-medium text-[var(--aidify-text)]">{fileName}</span>
              <Badge variant={errors.length > 0 ? "warning" : "success"}>
                {validCount} valid · {errors.length} invalid
              </Badge>
            </div>

            {errors.length > 0 && (
              <div className="rounded-xl border border-[var(--aidify-error)]/30 bg-[var(--aidify-error)]/[0.06] p-4">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--aidify-error)]">
                  <AlertTriangle className="size-4" aria-hidden="true" />
                  {errors.length} item{errors.length === 1 ? "" : "s"} cannot be imported
                </p>
                <ul className="space-y-1 text-sm text-[var(--aidify-secondary)]">
                  {errors.map((e) => (
                    <li key={e.index}>
                      Item {e.index + 1}: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {conflicts.length > 0 ? (
              <div>
                <p className="mb-2 text-sm font-semibold text-[var(--aidify-text)]">
                  {conflicts.length} name conflict{conflicts.length === 1 ? "" : "s"} — choose what to do for each:
                </p>
                <ul className="space-y-3">
                  {conflicts.map((c) => (
                    <li
                      key={c.index}
                      className="rounded-xl border border-[var(--aidify-border)] bg-white/[0.02] p-3"
                    >
                      <p className="mb-2 truncate text-sm font-medium text-[var(--aidify-text)]">
                        “{c.name}”
                        <span className="ml-2 text-xs font-normal text-[var(--aidify-secondary)]">
                          a configuration with this name already exists
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`Resolve conflict for ${c.name}`}>
                        {(
                          [
                            ["rename", "Rename (keep both)"],
                            ["skip", "Skip"],
                            ["replace", "Replace existing"],
                          ] as const
                        ).map(([mode, label]) => (
                          <button
                            key={mode}
                            type="button"
                            role="radio"
                            aria-checked={c.mode === mode}
                            onClick={() => setConflictMode(c.index, mode)}
                            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                              c.mode === mode
                                ? "border-[var(--aidify-blue)] bg-[var(--aidify-blue)]/15 text-[var(--aidify-text)]"
                                : "border-[var(--aidify-border)] text-[var(--aidify-secondary)] hover:text-[var(--aidify-text)]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              errors.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-[var(--aidify-success)]">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  No conflicts — all items will be imported as new configurations.
                </div>
              )
            )}

            {validCount === 0 && (
              <EmptyState
                title="Nothing to import"
                description="All items in this file failed validation."
              />
            )}
          </div>
        )}

        <DialogFooter>
          {phase !== "pick" && (
            <Button variant="ghost" onClick={reset} disabled={phase === "importing"}>
              Choose another file
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={phase === "importing"}>
            Cancel
          </Button>
          {phase === "review" && (
            <Button onClick={doImport} disabled={!canImport}>
              Import {validCount} configuration{validCount === 1 ? "" : "s"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
