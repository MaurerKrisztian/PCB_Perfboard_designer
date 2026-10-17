import {Utils} from "../../utils/utils";
import {ProjectState} from "../../state/ProjectState";
import {ProjectFileError} from "../../project-file/read-project-file";
import {
  decodeEmbeddedProject, makeShareFragment, makeStoredShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment, ShareLink,
} from "../../project-file/share-link";
import {getSaveJson} from "./save-project";
import {afterStartup, importSharedProject} from "./current-project";
import {fetchStoredProject, SHORT_LINKS, storeProject} from "./project-storage";
import {fitToScreen} from "../view-controls";

// Share links in the editor: the Share dialog, which makes a link carrying the board as it is now
// and, when asked, a short link to a copy stored on the project storage (project-storage.ts); and
// opening a link, which adds its project to the receiver's projects as a new one. The link format
// is src/project-file/share-link.ts.

// Some chat apps and mail clients cut links off past a few thousand characters.
const LONG_LINK = 8000;

const modal = Utils.getSafeHtmlElement('shareModal');
const linkInput = Utils.getSafeHtmlElement<HTMLInputElement>('shareLinkInput');
const info = Utils.getSafeHtmlElement('shareLinkInfo');
const copyBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('copyShareLinkBtn');
const shortNameInput = Utils.getSafeHtmlElement<HTMLInputElement>('shortLinkName');
const makeShortBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('makeShortLinkBtn');
const shortRow = Utils.getSafeHtmlElement('shortLinkRow');
const shortLinkInput = Utils.getSafeHtmlElement<HTMLInputElement>('shortLinkInput');
const copyShortBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('copyShortLinkBtn');
const shortInfo = Utils.getSafeHtmlElement('shortLinkInfo');

// An editor built without short links (project-storage.ts) doesn't offer them.
Utils.getSafeHtmlElement('shareShortSection').hidden = !SHORT_LINKS;

// Making a link is async: a dialog closed (and maybe reopened) meanwhile mustn't get a stale one.
let request = 0;

async function openShareDialog() {
  const thisRequest = ++request;
  modal.style.display = 'flex';
  linkInput.value = '';
  info.textContent = 'Making the link...';
  info.classList.remove('is-warning');
  copyBtn.disabled = true;
  copyBtn.textContent = 'Copy Link';
  resetShortLink();
  let link: string;
  try {
    // Without the old fragment: the editor may have been opened from a link itself.
    link = `${location.origin}${location.pathname}#${await makeShareFragment(getSaveJson(), ProjectState.current?.name)}`;
  } catch (err) {
    console.error(err);
    if (thisRequest === request) info.textContent = "This browser can't make share links. Use File → Save Project to File instead.";
    return;
  }
  if (thisRequest !== request) return;
  linkInput.value = link;
  copyBtn.disabled = false;
  const size = `${link.length.toLocaleString()} characters.`;
  if (link.length > LONG_LINK) {
    info.textContent = `${size} That's long enough that some chat apps and mail clients may cut it off. If it doesn't open for them, send the project file instead (File → Save Project to File).`;
    info.classList.add('is-warning');
  } else {
    info.textContent = `${size} The board is in the link itself; it isn't uploaded anywhere.`;
  }
  linkInput.focus();
  linkInput.select();
  // Selecting scrolls to the link's tail; show its start, the address, instead.
  linkInput.scrollLeft = 0;
}

function resetShortLink() {
  shortNameInput.value = ProjectState.current?.name ?? '';
  makeShortBtn.disabled = false;
  shortRow.hidden = true;
  shortLinkInput.value = '';
  shortInfo.textContent = '';
  shortInfo.classList.remove('is-warning');
}

// Stores a copy of the board for a short link, under the name typed (or the project's). The full
// link stays offered: it works without the server.
async function makeShortLink() {
  const thisRequest = request;
  const name = ProjectState.current?.name;
  const wanted = shortNameInput.value.trim();
  makeShortBtn.disabled = true;
  shortInfo.classList.remove('is-warning');
  shortInfo.textContent = 'Storing a copy of the board...';
  try {
    const id = await storeProject(getSaveJson(), {...(wanted ? {id: wanted} : {}), ...(name ? {name} : {})});
    if (thisRequest !== request) return;
    shortLinkInput.value = `${location.origin}${location.pathname}#${makeStoredShareFragment(id, name)}`;
    shortRow.hidden = false;
    copyShortBtn.textContent = 'Copy';
    shortInfo.textContent = `Stored as "${id}". The stored copy never changes: after changing the board, make a new link.`;
    shortLinkInput.focus();
    shortLinkInput.select();
    shortLinkInput.scrollLeft = 0;
  } catch (err) {
    console.error(err);
    if (thisRequest !== request) return;
    shortInfo.textContent = `Couldn't make a short link: ${err instanceof Error ? err.message : String(err)} The full link above works without it.`;
    shortInfo.classList.add('is-warning');
  } finally {
    if (thisRequest === request) makeShortBtn.disabled = false;
  }
}

function closeShareDialog() {
  request++;
  modal.style.display = 'none';
}

// Copies the link in `input`, saying so on `button`, or in `note` when the browser won't.
async function copyLink(input: HTMLInputElement, button: HTMLButtonElement, note: HTMLElement) {
  input.select();
  try {
    await navigator.clipboard.writeText(input.value);
  } catch {
    // The clipboard API needs a secure context: fall back to copying the selected text.
    if (!document.execCommand('copy')) {
      note.textContent = 'Copying was blocked. Select the link and copy it yourself.';
      return;
    }
  }
  button.textContent = 'Copied ✓';
}

document.querySelectorAll('[data-share-link]').forEach(el => el.addEventListener('click', openShareDialog));
copyBtn.addEventListener('click', () => copyLink(linkInput, copyBtn, info));
copyShortBtn.addEventListener('click', () => copyLink(shortLinkInput, copyShortBtn, shortInfo));
makeShortBtn.addEventListener('click', makeShortLink);
shortNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !makeShortBtn.disabled) makeShortLink();
});
Utils.getSafeHtmlElement('closeShareModalBtn').addEventListener('click', closeShareDialog);
Utils.getSafeHtmlElement('doneShareModalBtn').addEventListener('click', closeShareDialog);
modal.addEventListener('click', e => {
  if (e.target === modal) closeShareDialog();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.style.display !== 'none') closeShareDialog();
});

// A link's `src` project, after the user agrees to it being downloaded: fetching it tells that
// site about the visit. Undefined when they decline.
async function fetchHostedProject(link: Extract<ShareLink, {kind: "hosted"}>): Promise<unknown> {
  let url: URL;
  try {
    url = new URL(link.url);
  } catch {
    throw new ProjectFileError("The link's project address isn't a web address.");
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new ProjectFileError("The link's project address isn't a web address.");
  if (!confirm(`This link opens a project file from ${url.host}:\n\n${url.href}\n\nDownload and open it?`)) return undefined;

  let response: Response;
  try {
    response = await fetch(url.href);
  } catch {
    throw new ProjectFileError(`It couldn't be downloaded from ${url.host}. The site may be down, or it may not let other websites read its files.`);
  }
  if (!response.ok) throw new ProjectFileError(`${url.host} didn't send it (error ${response.status}).`);
  const text = await response.text();
  if (text.length > MAX_SHARED_PROJECT_BYTES) throw new ProjectFileError("It's too big to open.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ProjectFileError(`The file at ${url.host} isn't a Perfboard Designer project.`);
  }
}

// A hosted project without a `name` is named after its file.
function hostedFileName(url: string): string | undefined {
  try {
    const file = decodeURIComponent(new URL(url).pathname.split('/').pop() ?? '');
    return file.replace(/\.json$/i, '').trim() || undefined;
  } catch {
    return undefined;
  }
}

// What a link's project is called: its `name`, else a hosted file's name or a stored project's id.
function linkedProjectName(link: ShareLink): string | undefined {
  if (link.name) return link.name;
  if (link.kind === 'hosted') return hostedFileName(link.url);
  return link.kind === 'stored' ? link.id : undefined;
}

// The project a link carries or points at, parsed but not yet checked; undefined when the user
// declines downloading a hosted one. A stored project comes from Perfboard Designer's own storage,
// so it's fetched without asking.
function linkedProject(link: ShareLink): Promise<unknown> {
  if (link.kind === 'hosted') return fetchHostedProject(link);
  if (link.kind === 'stored') return fetchStoredProject(link.id);
  return decodeEmbeddedProject(link);
}

// Opens the project in the address bar's fragment, if it holds a share link.
async function openLinkedProject() {
  const link = readShareFragment(location.hash);
  if (!link) return;
  // Off the address bar first, so reloading the page doesn't add the project again.
  history.replaceState(null, '', location.pathname + location.search);
  let raw: unknown;
  try {
    raw = await linkedProject(link);
  } catch (err) {
    console.error(err);
    alert(`Couldn't open the shared project. ${err instanceof ProjectFileError ? err.message : "The link is damaged."}`);
    return;
  }
  if (raw === undefined) return;
  importSharedProject(raw, linkedProjectName(link));
  // Someone else's board may not fit the view at the zoom it was left at: show all of it.
  fitToScreen(true);
}

afterStartup(openLinkedProject);
// A link pasted into the address bar of a tab already on the editor only changes the fragment.
window.addEventListener('hashchange', openLinkedProject);
