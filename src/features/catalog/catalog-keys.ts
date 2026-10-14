// The catalog item keys (see CatalogItem.key). catalog.ts builds the items under these keys and
// the placement tools record recent use under them, so both must build them the same way.
// Import-free, like catalog-events.ts, so the tools can use it without a cycle.

export function standardKey(definitionId: string): string {
  return `standard:${definitionId}`;
}

export function advancedKey(definitionId: string): string {
  return `advanced:${definitionId}`;
}

// Built-in templates are keyed by their definition, custom ones by their id.
export function icKey(ic: {id: number | string; definitionId?: string}): string {
  return `ic:${ic.definitionId ?? ic.id}`;
}
