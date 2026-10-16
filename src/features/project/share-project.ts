import {Utils} from "../../utils/utils";
import {ProjectState} from "../../state/ProjectState";
import {ProjectFileError} from "../../project-file/read-project-file";
import {
  decodeEmbeddedProject, makeShareFragment, MAX_SHARED_PROJECT_BYTES, readShareFragment, ShareLink,
} from "../../project-file/share-link";
import {getSaveJson} from "./save-project";
import {afterStartup, importSharedProject} from "./current-project";
import {fitToScreen} from "../view-controls";

// Share links in the editor: the Share dialog, which makes a link carrying the board as it is now,
// and opening a link, which adds its project to the receiver's projects as a new one. The link
// format is src/project-file/share-link.ts.

// Some chat apps and mail clients cut links off past a few thousand characters.
const LONG_LINK = 8000;

const modal = Utils.getSafeHtmlElement('shareModal');
const linkInput = Utils.getSafeHtmlElement<HTMLInputElement>('shareLinkInput');
const info = Utils.getSafeHtmlElement('shareLinkInfo');
const copyBtn = Utils.getSafeHtmlElement<HTMLButtonElement>('copyShareLinkBtn');

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

function closeShareDialog() {
  request++;
  modal.style.display = 'none';
}

async function copyLink() {
  linkInput.select();
  try {
    await navigator.clipboard.writeText(linkInput.value);
  } catch {
    // The clipboard API needs a secure context: fall back to copying the selected text.
    if (!document.execCommand('copy')) {
      info.textContent = 'Copying was blocked. Select the link and copy it yourself.';
      return;
    }
  }
  copyBtn.textContent = 'Copied ✓';
}

document.querySelectorAll('[data-share-link]').forEach(el => el.addEventListener('click', openShareDialog));
copyBtn.addEventListener('click', copyLink);
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

// Opens the project in the address bar's fragment, if it holds a share link.
async function openLinkedProject() {
  const link = readShareFragment(location.hash);
  if (!link) return;
  // Off the address bar first, so reloading the page doesn't add the project again.
  history.replaceState(null, '', location.pathname + location.search);
  let raw: unknown;
  try {
    raw = link.kind === 'hosted' ? await fetchHostedProject(link) : await decodeEmbeddedProject(link);
  } catch (err) {
    console.error(err);
    alert(`Couldn't open the shared project. ${err instanceof ProjectFileError ? err.message : "The link is damaged."}`);
    return;
  }
  if (raw === undefined) return;
  importSharedProject(raw, link.name ?? (link.kind === 'hosted' ? hostedFileName(link.url) : undefined));
  // Someone else's board may not fit the view at the zoom it was left at: show all of it.
  fitToScreen(true);
}

afterStartup(openLinkedProject);
// A link pasted into the address bar of a tab already on the editor only changes the fragment.
window.addEventListener('hashchange', openLinkedProject);
