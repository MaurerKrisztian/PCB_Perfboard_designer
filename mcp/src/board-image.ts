import {ProjectFile, renderBoardSvg} from "./editor";

// Pictures of a board as SVG, drawn by the editor's own board renderer (src/board-render/) with
// the part icons build.mjs baked in, so they look like the editor. The hosted server serves them
// at /render.svg (image-requests.ts).

// The hosted server's, which make_share_link points images at unless told otherwise.
export const PUBLIC_IMAGE_URL = "https://mcp.perfboarddesigner.com/render.svg";

export function boardSvg(project: ProjectFile): string {
  return renderBoardSvg(project, {icons: icon => COMPONENT_ICONS[icon], view: {partLabels: true}});
}

// The picture of the board a share fragment (without its #) carries, at `base`.
export function boardImageUrl(base: string, fragment: string): string {
  return `${base}?${fragment}`;
}
