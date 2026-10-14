// The stored project the board is, and is autosaved into (see features/project/current-project.ts).
// Undefined while the board isn't being kept anywhere: browser storage is turned off or full.
export class ProjectState {
  static current?: {id: string; name: string};
}
