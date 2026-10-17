import {McpServer} from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod";
import {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, ProjectFileError, readProjectFile, readShareFragment,
} from "../editor";
import {holdProject, saveHeldProject} from "../project-handles";
import {expectedNets, expectNetsInput, projectIdInput, projectInput, projectSource} from "../project-source";
import {validateProject} from "../validate";
import {failure, reply} from "../reply";
import {errorMessage} from "../text";
import {boardImageUrl} from "../board-image";
import {ProjectStorage, storedAddresses, storedIdAt} from "../stored-projects";

// Share links, in the editor's own format (src/project-file/share-link.ts): make_share_link hands
// the user a board, optionally stored too (stored-projects.ts), and read_share_link takes one they
// shared.

export const PUBLIC_EDITOR_URL = "https://perfboarddesigner.com/app/";

// DEFAULT_EDITOR_URL: the editor address links open in, PERFBOARD_EDITOR_URL from the server's
// environment (the MCP client's config, or the Worker's vars) or the public site. imageUrl: where
// a picture of the board is served (board-image.ts). storage: where stored projects are kept. Both
// are extras a server can be without (PERFBOARD_IMAGE_URL / PERFBOARD_PROJECTS_URL=off): the link
// itself needs neither, and agents aren't offered what isn't there.
export function registerShareLinkTools(server: McpServer, DEFAULT_EDITOR_URL: string, imageUrl?: string, storage?: ProjectStorage) {
  const baseInputs = {
    project: projectInput,
    projectId: projectIdInput,
    name: z.string().optional().describe("The project's name in the editor, e.g. \"555 LED blinker\". Defaults to the name it was given in new_project or came with from read_share_link."),
    expectNets: expectNetsInput,
    allowErrors: z.boolean().optional().describe("Make the link even if validation finds errors."),
    editorUrl: z.string().optional().describe(`The editor's address. Defaults to ${DEFAULT_EDITOR_URL} (set PERFBOARD_EDITOR_URL in the server's environment to change it); use e.g. http://localhost:3000/app/ for a local copy.`),
  };
  const inputs = {
    ...baseInputs,
    store: z.boolean().optional().describe(`Also store the project at ${storage?.base}, for a short link. A stored project never changes (store again for a new id) and is deleted after a year unopened.`),
    storeAs: z.string().optional().describe('The id you\'d like it stored under, e.g. "led-blinker" (made lowercase letters, digits and dashes); if another board has it, a few characters of this board\'s hash are added. Implies store. Defaults to the project\'s name.'),
  };
  server.registerTool("make_share_link", {
    title: "Make share link",
    description: [
      "Turns a project into a link that opens it in Perfboard Designer: the project travels inside the link, so it works without any server. Give the link to the user.",
      ...(imageUrl ? ["Also returns `image`, the address of an SVG picture of the board (as the editor draws it), for showing it where images can go, e.g. in Markdown."] : []),
      ...(storage ? ["With store, the project is also stored on the Perfboard Designer server under a short id, and `stored` gives a short link to it, its file and its pictures (SVG and PNG): give the user both links."] : []),
      "The project is validated first (against expectNets too, given or remembered for its projectId); a project with errors gets the list of problems instead of a link, unless allowErrors is set.",
    ].join(" "),
    // Without storage, store and storeAs aren't offered, so they never come.
    inputSchema: storage ? inputs : (baseInputs as typeof inputs),
    annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: !!storage},
  }, async ({project, projectId, name, expectNets, allowErrors, editorUrl, store, storeAs}) => {
    const from = await projectSource({project, projectId});
    if ("error" in from) return failure(from.error);
    const {ok, project: read, problems} = validateProject(from.raw, expectedNets(expectNets, from.held));
    if (!read || (!ok && !allowErrors)) {
      return failure("The project has errors, so no link was made. Fix them (or set allowErrors).", problems);
    }
    const base = editorBase(editorUrl ?? DEFAULT_EDITOR_URL);
    if (!base) return failure(`editorUrl "${editorUrl ?? DEFAULT_EDITOR_URL}" isn't an http(s) address.`);
    if (from.held && name) from.held.name = name;
    if (from.held && (name || expectNets)) await saveHeldProject(from.held);
    const linkName = name ?? from.held?.name;
    const fragment = await makeShareFragment(read, linkName);
    const link = `${base.href}#${fragment}`;
    // Storing is extra: the link above works without it, so a failure only says why it's missing.
    let stored: object | undefined, storeError: string | undefined;
    if (storage && (store || storeAs)) {
      try {
        stored = storedAddresses(storage.base, await storage.save(read, {id: storeAs, name: linkName}), base.href, linkName);
      } catch (err) {
        storeError = `It couldn't be stored (${errorMessage(err)}); \`link\` works without it.`;
      }
    }
    return reply({
      link, characters: link.length, ...(imageUrl ? {image: boardImageUrl(imageUrl, fragment)} : {}),
      ...(stored ? {stored} : {}), ...(storeError ? {storeError} : {}), ...(problems.length ? {problems} : {}),
    });
  });

  server.registerTool("read_share_link", {
    title: "Read share link",
    description: "Reads the project out of a Perfboard Designer share link (any of its forms: z=, json= or src=, which is downloaded; a stored project's short link too), so you can look at or change a board the user shared. Returns the project as a version 3 project file, kept here under the projectId it returns: change it with edit_project.",
    inputSchema: {
      link: z.string().describe("The whole link, or just the part after #."),
    },
    annotations: {readOnlyHint: false, destructiveHint: false, openWorldHint: true},
  }, async ({link}) => {
    const fragment = link.includes("#") ? link.slice(link.indexOf("#")) : link;
    const share = readShareFragment(fragment.trim());
    if (!share) return failure("That isn't a share link: it has no z=, json=, src= or p= after the #.");
    try {
      let raw: unknown;
      if (share.kind === "stored" && !storage) {
        return failure("This server doesn't use stored projects (PERFBOARD_PROJECTS_URL=off), so it can't open a short (p=) link. Ask the user for the full link.");
      }
      // A stored project, by its short link or its file's address.
      const storedId = share.kind === "stored" ? share.id : share.kind === "hosted" && storage ? storedIdAt(storage.base, share.url) : undefined;
      if (share.kind === "embedded") {
        raw = await decodeEmbeddedProject(share);
      } else if (storage && storedId !== undefined) {
        // Straight from the store: the Worker can't fetch its own addresses.
        raw = await storage.load(storedId);
        if (!raw) return failure(`There's no stored project "${storedId}" (stored projects are deleted after a year unopened).`);
      } else if (share.kind === "hosted") {
        const response = await fetch(share.url);
        if (!response.ok) return failure(`${share.url} answered with error ${response.status}.`);
        const text = await response.text();
        if (text.length > MAX_SHARED_PROJECT_BYTES) return failure("The linked project is too big.");
        raw = JSON.parse(text);
      }
      const {project, skipped} = readProjectFile(raw);
      // Named as the editor names it: a stored project without a name after its id.
      const name = share.name ?? (share.kind === "stored" ? share.id : undefined);
      const held = await holdProject(project, {...(name ? {name} : {})});
      return reply({projectId: held.id, ...(name ? {name} : {}), ...(skipped ? {skipped} : {}), project});
    } catch (err) {
      return failure(err instanceof ProjectFileError ? err.message : `It couldn't be read: ${errorMessage(err)}`);
    }
  });
}

// The editor address a link starts with, without any fragment; undefined unless it's http(s).
function editorBase(url: string): URL | undefined {
  try {
    const base = new URL(url);
    if (base.protocol !== "https:" && base.protocol !== "http:") return undefined;
    base.hash = "";
    return base;
  } catch {
    return undefined;
  }
}
