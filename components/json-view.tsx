"use client";

import * as React from "react";
import { ChevronRight, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/toast";

/**
 * Syntax-highlighted, collapsible JSON viewer with a copy button and
 * secret masking: keys listed in `maskKeys` render as "••••••".
 */

export interface JsonViewProps {
  data: unknown;
  maskKeys?: string[];
  defaultCollapsedDepth?: number;
  className?: string;
  maxHeight?: string;
}

const MASKED = "••••••";

function isMaskedKey(key: string, maskKeys: readonly string[] | undefined): boolean {
  if (!maskKeys) return false;
  const lower = key.toLowerCase();
  return maskKeys.some((m) => m.toLowerCase() === lower);
}

function ValueNode({
  value,
  depth,
  collapsedDepth,
  maskKeys,
}: {
  value: unknown;
  depth: number;
  collapsedDepth: number;
  maskKeys: readonly string[] | undefined;
}) {
  const [collapsed, setCollapsed] = React.useState(depth >= collapsedDepth);

  if (value === null) return <span className="text-[var(--aidify-secondary)]">null</span>;
  if (value === undefined) return <span className="text-[var(--aidify-secondary)]">undefined</span>;

  const type = typeof value;
  if (type === "string")
    return <span className="text-[var(--aidify-success)]">“{(value as string).replace(/\n/g, "\\n")}”</span>;
  if (type === "number") return <span className="text-[var(--aidify-cyan)]">{String(value)}</span>;
  if (type === "boolean") return <span className="text-[var(--aidify-violet)]">{String(value)}</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-[var(--aidify-secondary)]">[]</span>;
    return (
      <Collapsible
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        summary={`Array(${value.length})`}
        depth={depth}
      >
        {value.map((item, i) => (
          <div key={i} className="flex gap-2">
            <span className="select-none text-[var(--aidify-secondary)]/60">{i}:</span>
            <ValueNode value={item} depth={depth + 1} collapsedDepth={collapsedDepth} maskKeys={maskKeys} />
          </div>
        ))}
      </Collapsible>
    );
  }

  if (type === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-[var(--aidify-secondary)]">{"{}"}</span>;
    return (
      <Collapsible
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        summary={`Object{${entries.length}}`}
        depth={depth}
      >
        {entries.map(([key, val]) => (
          <div key={key} className="flex gap-2">
            <span className="shrink-0 select-none text-[var(--aidify-blue)]">“{key}”:</span>
            {isMaskedKey(key, maskKeys) ? (
              <span className="select-none rounded bg-[var(--aidify-error)]/10 px-1.5 text-[var(--aidify-error)]" title="Masked secret">
                {MASKED}
              </span>
            ) : (
              <ValueNode value={val} depth={depth + 1} collapsedDepth={collapsedDepth} maskKeys={maskKeys} />
            )}
          </div>
        ))}
      </Collapsible>
    );
  }

  return <span className="text-[var(--aidify-secondary)]">{String(value)}</span>;
}

function Collapsible({
  collapsed,
  onToggle,
  summary,
  depth,
  children,
}: {
  collapsed: boolean;
  onToggle: () => void;
  summary: string;
  depth: number;
  children: React.ReactNode;
}) {
  return (
    <span className="inline">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${summary}` : `Collapse ${summary}`}
        className="mr-1 inline-flex cursor-pointer items-center rounded p-0.5 align-middle text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform", !collapsed && "rotate-90")}
          aria-hidden="true"
        />
      </button>
      {collapsed ? (
        <span className="select-none text-[var(--aidify-secondary)]">{summary}</span>
      ) : (
        <span className={cn("block", depth > 0 && "ml-4 border-l border-[var(--aidify-border)] pl-3")}>
          {children}
        </span>
      )}
    </span>
  );
}

export function JsonView({
  data,
  maskKeys,
  defaultCollapsedDepth = 2,
  className,
  maxHeight = "480px",
}: JsonViewProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      toast({ title: "Copied", description: "JSON copied to clipboard.", variant: "success" });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast({ title: "Copy failed", description: "Clipboard access was denied.", variant: "error" });
    }
  };

  return (
    <div className={cn("glass-panel relative overflow-hidden !rounded-xl", className)}>
      <div className="flex items-center justify-between border-b border-[var(--aidify-border)] px-4 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--aidify-secondary)]">
          JSON
        </span>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy JSON to clipboard"
          className="flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-[var(--aidify-secondary)] transition-colors hover:bg-white/[0.06] hover:text-[var(--aidify-text)]"
        >
          {copied ? (
            <Check className="size-3.5 text-[var(--aidify-success)]" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre
        className="overflow-auto p-4 font-mono text-[13px] leading-relaxed text-[var(--aidify-text)]"
        style={{ maxHeight }}
        aria-label="JSON data"
      >
        <ValueNode value={data} depth={0} collapsedDepth={defaultCollapsedDepth} maskKeys={maskKeys} />
      </pre>
    </div>
  );
}
