export type BookmarkKind = "vocab" | "dialogue";

export type BookmarkItem = {
  id: string;
  kind: BookmarkKind;
  lessonId: number | string;
  createdAt: number;
  updatedAt: number;
  nepali: string;
  korean: string;
  romanized?: string;
  speaker?: string;
  dIdx?: number;
  lIdx?: number;
};

const STORAGE_KEY = "nepali-bloom-bookmarks-v1";

function safeParse(raw: string | null): Record<string, BookmarkItem> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as Record<string, BookmarkItem>;
  } catch {
    return {};
  }
}

export function loadBookmarks(): Record<string, BookmarkItem> {
  if (typeof window === "undefined") return {};
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

export function saveBookmarks(next: Record<string, BookmarkItem>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function toggleBookmark(item: BookmarkItem): Record<string, BookmarkItem> {
  const current = loadBookmarks();
  const exists = Boolean(current[item.id]);
  if (exists) {
    const { [item.id]: _removed, ...rest } = current;
    saveBookmarks(rest);
    return rest;
  }
  const now = Date.now();
  const next: Record<string, BookmarkItem> = {
    ...current,
    [item.id]: {
      ...item,
      createdAt: item.createdAt || now,
      updatedAt: now,
    },
  };
  saveBookmarks(next);
  return next;
}

export function isBookmarked(id: string, store: Record<string, BookmarkItem>) {
  return Boolean(store[id]);
}

