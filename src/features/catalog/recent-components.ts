import {notifyRecentChanged} from "./catalog-events";

// The keys (see CatalogItem.key) of the components most recently placed on the board, most recent
// first. Kept in localStorage so it survives reloads, like the collapsed categories.

const STORAGE_KEY = "catalog_recent";
export const RECENT_LIMIT = 5;

function loadRecentKeys(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is string => typeof key === "string").slice(0, RECENT_LIMIT);
  } catch (e) {
    console.error("Failed to load recently used components from localStorage", e);
    return [];
  }
}

let recentKeys = loadRecentKeys();

export function getRecentKeys(): readonly string[] {
  return recentKeys;
}

// Moves the key to the front, dropping its older entry and anything past the limit.
export function recordRecentKey(key: string) {
  recentKeys = [key, ...recentKeys.filter(k => k !== key)].slice(0, RECENT_LIMIT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recentKeys));
  } catch (e) {
    console.error("Failed to save recently used components to localStorage", e);
  }
  notifyRecentChanged();
}
