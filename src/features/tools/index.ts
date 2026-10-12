import {ActiveTool} from "../../state/ToolState";
import {ToolBehavior} from "./tool";
import {eraserTool, noteTool, selectTool} from "./mode-tools";
import {wireTool} from "./wire-tool";
import {icTool} from "./ic-tool";
import {standardComponentTool} from "./standard-component-tool";
import {advancedComponentTool} from "./advanced-component-tool";

const BEHAVIORS: {[K in ActiveTool["kind"]]: ToolBehavior<Extract<ActiveTool, {kind: K}>>} = {
  "select": selectTool,
  "eraser": eraserTool,
  "note": noteTool,
  "wire": wireTool,
  "ic": icTool,
  "standard-component": standardComponentTool,
  "advanced-component": advancedComponentTool,
};

// The behavior for a tool's kind. The cast is safe - BEHAVIORS pairs every kind with the behavior
// for exactly that kind - but TypeScript can't follow the link between `tool.kind` and the lookup.
export function behaviorOf<T extends ActiveTool>(tool: T): ToolBehavior<T> {
  return BEHAVIORS[tool.kind] as unknown as ToolBehavior<T>;
}
