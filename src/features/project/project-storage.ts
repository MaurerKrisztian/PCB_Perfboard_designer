import {ProjectFile} from "../../project-file/project-file";
import {ProjectFileError} from "../../project-file/read-project-file";
import {MAX_SHARED_PROJECT_BYTES, STORED_ID, STORED_PROJECTS_URL} from "../../project-file/share-link";

// Perfboard Designer's project storage, behind short links (docs/share-links.md, "Stored
// projects"): the Share dialog stores a copy of the board there, and a p= link opens one. An extra:
// everything else works without it, and it's contacted only when a user makes a short link or opens
// one.

// Where it is: the public service, unless the editor was built or run with PERFBOARD_PROJECTS_URL
// (vite.config.ts): another copy, e.g. a local one, or "off" for an editor without short links.
const configured = __PERFBOARD_PROJECTS_URL__.trim();
const PROJECTS_URL = configured === 'off' ? undefined : (configured || STORED_PROJECTS_URL).replace(/\/+$/, '');
const HOST = PROJECTS_URL && new URL(PROJECTS_URL).host;

// Whether this editor offers short links at all.
export const SHORT_LINKS = PROJECTS_URL !== undefined;

const TURNED_OFF = "Short links are turned off in this copy of Perfboard Designer.";

// Stores a copy of `project` under the wanted id or name, cleaned up (lowercase, dashes) and with a
// few characters added when another board has it; resolves to the id it got. The error says why not.
export async function storeProject(project: ProjectFile, wanted: {id?: string; name?: string}): Promise<string> {
  if (!PROJECTS_URL) throw new Error(TURNED_OFF);
  let response: Response;
  try {
    response = await fetch(`${PROJECTS_URL}/projects`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({project, ...wanted}),
    });
  } catch {
    throw new Error(`${HOST} couldn't be reached.`);
  }
  const text = (await response.text()).trim();
  if (!response.ok) throw new Error(text || `${HOST} answered with error ${response.status}.`);
  return (JSON.parse(text) as {id: string}).id;
}

// The project a short link names, parsed but not yet checked: pass it to readProjectFile. Throws
// ProjectFileError when it can't be had.
export async function fetchStoredProject(id: string): Promise<unknown> {
  if (!PROJECTS_URL) throw new ProjectFileError(`${TURNED_OFF} Ask for the full link instead.`);
  if (!STORED_ID.test(id)) throw new ProjectFileError("This short link is damaged. It may have been cut off when the link was copied.");
  let response: Response;
  try {
    response = await fetch(`${PROJECTS_URL}/${id}.json`);
  } catch {
    throw new ProjectFileError(`${HOST} couldn't be reached, so the board couldn't be downloaded. Try again later, or ask for the full link.`);
  }
  if (response.status === 404) throw new ProjectFileError(`There's no board "${id}" on ${HOST}. Stored boards are deleted after a year unopened.`);
  if (!response.ok) throw new ProjectFileError(`${HOST} didn't send it (error ${response.status}).`);
  const text = await response.text();
  if (text.length > MAX_SHARED_PROJECT_BYTES) throw new ProjectFileError("It's too big to open.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProjectFileError(`${HOST} didn't send a Perfboard Designer project.`);
  }
}
