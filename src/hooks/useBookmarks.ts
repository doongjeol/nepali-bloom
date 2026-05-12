import { useEffect, useMemo, useState } from "react";
import { type BookmarkItem, isBookmarked, loadBookmarks, toggleBookmark } from "@/lib/bookmarks";

export function useBookmarks() {
  const [store, setStore] = useState<Record<string, BookmarkItem>>({});
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setHasLoaded(false);
    setStore(loadBookmarks());
    setHasLoaded(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasLoaded) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key !== "nepali-bloom-bookmarks-v1") return;
      setStore(loadBookmarks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [hasLoaded]);

  const list = useMemo(
    () =>
      Object.values(store).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)),
    [store],
  );

  return {
    store,
    list,
    isBookmarked: (id: string) => isBookmarked(id, store),
    toggle: (item: BookmarkItem) => setStore(toggleBookmark(item)),
  };
}

