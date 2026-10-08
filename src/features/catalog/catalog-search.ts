import {CatalogItem} from "./catalog";
import {CATALOG_CATEGORIES, CatalogCategory, getCategoryPath} from "./catalog-categories";

export type CatalogSearchResult =
  | {type: "item"; item: CatalogItem; score: number}
  | {type: "category"; category: CatalogCategory; score: number};

// A keyword hit is worth slightly less than the same kind of hit on the name, so "pot" finds
// the Potentiometer but an item actually *named* like the query still wins.
const KEYWORD_PENALTY = 5;
// Below this length, subsequence matching hits nearly everything and just adds noise.
const MIN_FUZZY_QUERY_LENGTH = 3;

function isSubsequence(query: string, text: string): boolean {
  let q = 0;
  for (let t = 0; t < text.length && q < query.length; t++) {
    if (text[t] === query[q]) q++;
  }
  return q === query.length;
}

// How well `query` matches `text` (both lowercased): exact > prefix > word prefix > substring >
// fuzzy subsequence. 0 = no match.
function matchScore(query: string, text: string, allowFuzzy: boolean): number {
  if (text === query) return 100;
  if (text.indexOf(query) === 0) return 80;
  if (text.split(/[\s\-_()/.,]+/).some(word => word.indexOf(query) === 0)) return 60;
  if (text.indexOf(query) > -1) return 40;
  if (allowFuzzy && query.length >= MIN_FUZZY_QUERY_LENGTH && isSubsequence(query, text)) return 20;
  return 0;
}

// Keywords only match properly (no fuzzy): there are many of them, and fuzzy hits on them are
// mostly noise ("pot" inside "dupont").
function bestScore(query: string, name: string, keywords: readonly string[] = []): number {
  let best = matchScore(query, name.toLowerCase(), true);
  for (const keyword of keywords) {
    const score = matchScore(query, keyword.toLowerCase(), false);
    if (score > 0) best = Math.max(best, score - KEYWORD_PENALTY);
  }
  return best;
}

// Breaks score ties: components first, then subcategories, then top-level categories.
function kindRank(result: CatalogSearchResult): number {
  if (result.type === "item") return 0;
  return result.category.parentId ? 1 : 2;
}

function resultName(result: CatalogSearchResult): string {
  return result.type === "item" ? result.item.name : result.category.name;
}

// Ranks items and categories together by match quality; kind only decides ties, so a search for
// "Passives" puts the Passives category ahead of weaker component hits.
export function searchCatalog(rawQuery: string, items: CatalogItem[]): CatalogSearchResult[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const results: CatalogSearchResult[] = [];
  for (const item of items) {
    const score = bestScore(query, item.name, item.keywords);
    if (score > 0) results.push({type: "item", item, score});
  }
  // Empty categories are hidden from the tree, so don't offer them here either
  const nonEmptyCategoryIds = new Set<string>();
  for (const item of items) {
    getCategoryPath(item.categoryId).forEach(c => nonEmptyCategoryIds.add(c.id));
  }
  for (const category of CATALOG_CATEGORIES) {
    if (!nonEmptyCategoryIds.has(category.id)) continue;
    const score = bestScore(query, category.name, category.keywords);
    if (score > 0) results.push({type: "category", category, score});
  }

  return results.sort((a, b) =>
    b.score - a.score
    || kindRank(a) - kindRank(b)
    || resultName(a).length - resultName(b).length
    || resultName(a).localeCompare(resultName(b))
  );
}
