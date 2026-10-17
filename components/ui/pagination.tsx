"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className,
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), pageCount);
  const start = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  // Compact page-number window: 1 … current-1 current current+1 … last
  const pages = React.useMemo(() => {
    const result: (number | "…")[] = [];
    const push = (v: number | "…") => {
      if (result[result.length - 1] !== v) result.push(v);
    };
    for (let p = 1; p <= pageCount; p += 1) {
      if (p === 1 || p === pageCount || Math.abs(p - safePage) <= 1) push(p);
      else push("…");
    }
    return result;
  }, [pageCount, safePage]);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 px-1 py-3",
        className,
      )}
    >
      <p className="text-sm text-[var(--aidify-secondary)]" aria-live="polite">
        Showing <span className="font-medium text-[var(--aidify-text)]">{start}–{end}</span>{" "}
        of <span className="font-medium text-[var(--aidify-text)]">{total}</span>
      </p>

      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(1)}
          disabled={safePage <= 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(safePage - 1)}
          disabled={safePage <= 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft />
        </Button>

        {pages.map((p, i) =>
          p === "…" ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1 text-sm text-[var(--aidify-secondary)]"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === safePage ? "default" : "ghost"}
              size="icon-sm"
              onClick={() => onPageChange(p)}
              aria-label={`Go to page ${p}`}
              aria-current={p === safePage ? "page" : undefined}
            >
              {p}
            </Button>
          ),
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(safePage + 1)}
          disabled={safePage >= pageCount}
          aria-label="Go to next page"
        >
          <ChevronRight />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onPageChange(pageCount)}
          disabled={safePage >= pageCount}
          aria-label="Go to last page"
        >
          <ChevronsRight />
        </Button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-2 text-sm text-[var(--aidify-secondary)]">
          <label htmlFor="pagination-page-size">Rows per page</label>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger id="pagination-page-size" className="w-[76px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </nav>
  );
}
