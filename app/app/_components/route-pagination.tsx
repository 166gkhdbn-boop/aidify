"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Pagination } from "@/components/ui";

/**
 * Pagination that drives ?page=&pageSize= URL params (server-rendered lists).
 */
export function RoutePagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (nextPage: number, nextSize: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextSize));
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      total={total}
      onPageChange={(p) => go(p, pageSize)}
      onPageSizeChange={(s) => go(1, s)}
    />
  );
}
