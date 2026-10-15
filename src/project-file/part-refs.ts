import {getComponentDefinition} from "../features/standard-components/component-definitions";
import {getAdvancedComponentDefinition} from "../features/advanced-components/advanced-component-definitions";

// Reference designators ("refs"): the R1 / C2 / U1 names parts go by on schematics and
// silkscreens. Every placed part has one, unique on its board ignoring case, so a person or a
// program can name a part in a way that survives other parts being added or removed. Pure, like
// the rest of this folder: the editor and the project file reader share it.

export type PartKind = "ic" | "standard-component" | "advanced-component";

const IC_REF_PREFIX = "U";
// For a part whose definition this version doesn't know (a stale or hand-edited file).
const UNKNOWN_PART_REF_PREFIX = "X";
// A letter, then letters, digits, "_" or "-": R1, RV2, J_PWR. Short enough to print on the board.
const REF_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,15}$/;

export function isValidRef(ref: string): boolean {
  return REF_PATTERN.test(ref);
}

export function refPrefixFor(part: {kind: PartKind; definitionId?: string}): string {
  if (part.kind === "ic") return IC_REF_PREFIX;
  const definition = part.kind === "standard-component"
    ? getComponentDefinition(part.definitionId ?? "")
    : getAdvancedComponentDefinition(part.definitionId ?? "");
  return definition?.refPrefix ?? UNKNOWN_PART_REF_PREFIX;
}

// The refs in use on one board, compared ignoring case (R1 and r1 would read as the same part).
export class BoardRefs {
  private readonly taken = new Set<string>();

  constructor(refs: Iterable<string> = []) {
    for (const ref of refs) this.taken.add(ref.toUpperCase());
  }

  // Takes `ref` if it's well-formed and still free. Returns whether it did.
  claim(ref: string): boolean {
    if (!isValidRef(ref) || this.taken.has(ref.toUpperCase())) return false;
    this.taken.add(ref.toUpperCase());
    return true;
  }

  // Takes and returns the lowest-numbered free ref with this prefix: R1, then R2...
  claimNext(prefix: string): string {
    let n = 1;
    while (this.taken.has(`${prefix}${n}`.toUpperCase())) n++;
    const ref = `${prefix}${n}`;
    this.taken.add(ref.toUpperCase());
    return ref;
  }
}
