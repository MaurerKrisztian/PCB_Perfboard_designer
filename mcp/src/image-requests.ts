import {decodeEmbeddedProject, ProjectFile, ProjectFileError, readProjectFile, readShareFragment} from "./editor";
import {boardSvg} from "./board-image";
import {boardPng, MAX_PNG_HOLES} from "./board-png";
import {errorMessage} from "./text";

// The hosted server's pictures of a board: GET /render.svg (board-image.ts), and /render.png
// (board-png.ts) for places that don't show SVG, such as chat apps and link previews. Each takes a
// share link's parameters (name=…&z=…, or json=…) in its query string, since a link's #fragment
// never reaches a server, and only boards carried in the address itself: src= links would have the
// server fetch any URL it's given. A picture's address says everything in it, so it can be cached
// for good.

export type ImageFormat = "svg" | "png";

const CACHE_FOR_GOOD = "public, max-age=31536000, immutable";

export function text(status: number, message: string): Response {
  return new Response(`${message}\n`, {status, headers: {"Content-Type": "text/plain; charset=utf-8"}});
}

export async function handleImageRequest(request: Request, format: ImageFormat): Promise<Response> {
  const path = `/render.${format}`;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return text(405, `Method not allowed: GET ${path} with a share link's z= or json= parameters.`);
  }
  const share = readShareFragment(new URL(request.url).search.slice(1));
  if (!share || share.kind !== "embedded") {
    return text(400, `Give a share link's parameters after the ?, e.g. ${path}?name=Blinker&z=… (z= or json=; src= links aren't fetched).`);
  }
  try {
    const {project} = readProjectFile(await decodeEmbeddedProject(share));
    return format === "svg" ? svgResponse(project) : await pngResponse(project);
  } catch (err) {
    return text(400, err instanceof ProjectFileError ? err.message : `The board couldn't be read: ${errorMessage(err)}`);
  }
}

// Also serves stored projects' pictures (project-requests.ts), cached for less.
export function svgResponse(project: ProjectFile, cache = CACHE_FOR_GOOD): Response {
  return new Response(boardSvg(project), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": cache,
      // Opened on its own, it's still only a picture: nothing in it may run or load.
      "Content-Security-Policy": "default-src 'none'; img-src data:; style-src 'unsafe-inline'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function pngResponse(project: ProjectFile, cache = CACHE_FOR_GOOD): Promise<Response> {
  const {cols, rows} = project.board;
  if (cols * rows > MAX_PNG_HOLES) {
    return text(413, `A ${cols}×${rows} board is too big to draw as a PNG (up to ${MAX_PNG_HOLES} holes): ask for its SVG instead.`);
  }
  try {
    const {png} = await boardPng(project);
    return new Response(png, {headers: {"Content-Type": "image/png", "Cache-Control": cache, "X-Content-Type-Options": "nosniff"}});
  } catch (err) {
    return text(500, `The picture couldn't be drawn: ${errorMessage(err)}`);
  }
}
