import type {Ic} from "../features/ic";

export class IcState {
  // Catalog IC armed for placement (a clone, so rotating it leaves the catalog entry alone).
  // Placed ICs live in PartState.
  static selectedIc?: Ic;
}
