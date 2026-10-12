"use client";

import { useMemo, useState } from "react";

/** Search + paginate a derived (non-service) array, e.g. specifications flattened across products. */
export function useLocalList<T>(items: T[], searchText: (item: T) => string, pageSize = 10) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? items.filter((i) => searchText(i).toLowerCase().includes(term)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pageCount);
  return {
    search,
    setSearch: (v: string) => { setSearch(v); setPage(1); },
    page: current,
    setPage,
    pageCount,
    total: filtered.length,
    pageSize,
    rows: filtered.slice((current - 1) * pageSize, current * pageSize),
    reset: () => { setSearch(""); setPage(1); },
  };
}
