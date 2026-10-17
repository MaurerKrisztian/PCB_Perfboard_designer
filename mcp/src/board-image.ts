import {decodeEmbeddedProject, ProjectFile, ProjectFileError, readProjectFile, readShareFragment, renderBoardSvg} from "./editor";
import {errorMessage} from "./text";

// Pictures of a board as SVG, drawn by the editor's own board renderer (src/board-render/) with
// the part icons build.mjs baked in, so they look like the editor. The hosted server serves them
// at /render.svg, taking a share link's parameters (name=…&z=…, or json=…) in its query string,
// since a link's #fragment never reaches a server. A picture's address says everything in it, so
// it can be cached for good.

// The hosted server's, which make_share_link points images at unless told otherwise.
export const PUBLIC_IMAGE_URL = "https://mcp.perfboarddesigner.com/render.svg";

export function boardSvg(project: ProjectFile): string {
  return renderBoardSvg(project, {icons: icon => COMPONENT_ICONS[icon], view: {partLabels: true}});
}

// The picture of the board a share fragment (without its #) carries, at `base`.
export function boardImageUrl(base: string, fragment: string): string {
  return `${base}?${fragment}`;
}

function text(status: number, message: string): Response {
  return new Response(`${message}\n`, {status, headers: {"Content-Type": "text/plain; charset=utf-8"}});
}

// GET /render.svg?name=…&z=… Only boards carried in the address itself: src= links would have the
// server fetch any URL it's given.
export async function handleImageRequest(request: Request): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return text(405, "Method not allowed: GET /render.svg with a share link's z= or json= parameters.");
  }
  const share = readShareFragment(new URL(request.url).search.slice(1));
  if (!share || share.kind !== "embedded") {
    return text(400, "Give a share link's parameters after the ?, e.g. /render.svg?name=Blinker&z=… (z= or json=; src= links aren't fetched).");
  }
  try {
    const {project} = readProjectFile(await decodeEmbeddedProject(share));
    return new Response(boardSvg(project), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "public, max-age=31536000, immutable",
        // Opened on its own, it's still only a picture: nothing in it may run or load.
        "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return text(400, err instanceof ProjectFileError ? err.message : `The board couldn't be read: ${errorMessage(err)}`);
  }
}
