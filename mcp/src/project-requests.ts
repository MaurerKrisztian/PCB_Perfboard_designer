import {ProjectFileError, readProjectFile, STORED_ID} from "./editor";
import {MAX_STORED_BYTES, ProjectStorage, storedAddresses} from "./stored-projects";
import {pngResponse, svgResponse, text} from "./image-requests";
import {errorMessage} from "./text";

// Stored projects over HTTP (stored-projects.ts), on the hosted server: POST /projects stores one,
// GET /<id>.json, .png and .svg serve it. Any web page may call them (worker.ts adds CORS).

// A stored project never changes, but an id deleted after a year unopened can be taken again.
const CACHE_A_DAY = "public, max-age=86400";

const STORED_PATH = /^\/([a-z0-9-]+)\.(json|png|svg)$/i;

export const isStoredProjectPath = (pathname: string) => STORED_PATH.test(pathname);

const HOW_TO_STORE = 'POST a project as JSON: {"project": {…}, "id": "my-board", "name": "My board"} (id and name optional).';

// POST /projects: stores the project and answers with its id, a short editor link at `editorBase`,
// its file and its pictures.
export async function handleStoreRequest(request: Request, storage: ProjectStorage, editorBase: string): Promise<Response> {
  if (request.method !== "POST") return text(405, `Method not allowed: ${HOW_TO_STORE}`);
  const tooBig = text(413, `That's too big to store (up to ${MAX_STORED_BYTES / 1_000_000} MB).`);
  if (Number(request.headers.get("Content-Length")) > MAX_STORED_BYTES) return tooBig;
  const body = await request.text();
  if (body.length > MAX_STORED_BYTES) return tooBig;
  let input: unknown;
  try {
    input = JSON.parse(body);
  } catch {
    return text(400, `That isn't JSON. ${HOW_TO_STORE}`);
  }
  if (typeof input !== "object" || input === null || !("project" in input)) return text(400, `There's no project in it. ${HOW_TO_STORE}`);
  const {project: raw, id: wantedId, name: wantedName} = input as {project: unknown; id?: unknown; name?: unknown};
  const given = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  try {
    const {project, skipped} = readProjectFile(raw);
    const name = given(wantedName);
    const id = await storage.save(project, {id: given(wantedId), name});
    return Response.json({...storedAddresses(storage.base, id, editorBase, name), ...(skipped ? {skipped} : {})});
  } catch (err) {
    if (err instanceof ProjectFileError) return text(400, err.message);
    return text(500, `It couldn't be stored: ${errorMessage(err)}`);
  }
}

// GET /<id>.json, /<id>.png or /<id>.svg: a stored project's file or picture.
export async function handleStoredProjectRequest(request: Request, storage: ProjectStorage): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") return text(405, "Method not allowed: GET a stored project's .json, .png or .svg.");
  const [, given, type] = STORED_PATH.exec(new URL(request.url).pathname) ?? [];
  const id = given?.toLowerCase() ?? "";
  const project = STORED_ID.test(id) ? await storage.load(id) : undefined;
  if (!project) return text(404, `There's no stored project "${id}". Stored projects are deleted after a year unopened.`);
  if (type === "svg") return svgResponse(project, CACHE_A_DAY);
  if (type === "png") return pngResponse(project, CACHE_A_DAY);
  return new Response(JSON.stringify(project), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": CACHE_A_DAY,
      "Content-Disposition": `inline; filename="${id}.json"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
