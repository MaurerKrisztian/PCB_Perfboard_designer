import "./contributors.css";

// Standalone page (contributors/index.html) - deliberately imports nothing from the editor.
// People are credited from the repository's merged pull requests and issues, fetched live from
// the GitHub API. That's more accurate than GitHub's commit-based contributor list, which
// misses anyone who committed with an email linked to a different account.

const OWNER = "MaurerKrisztian";
const REPO = "PCB_Perfboard_designer";
const REPO_URL = `https://github.com/${OWNER}/${REPO}`;

interface Person {
  login: string;
  mergedPrs: number;
  issues: number;
}

// Shown when the API can't be reached (offline, or the 60 requests/hour anonymous limit).
// Snapshot of the repository as of October 2026.
const SNAPSHOT: Person[] = [
  {login: "SantiagoDeIralaMut", mergedPrs: 4, issues: 0},
  {login: "gryghst72", mergedPrs: 1, issues: 2},
  {login: "chenzeyan54-commits", mergedPrs: 1, issues: 0},
  {login: "lkadar2015", mergedPrs: 0, issues: 1},
];

interface GitHubIssue {
  user: {login: string; type: string} | null;
  pull_request?: {merged_at: string | null};
}

// Each browser keeps the fetched list for a day, so a visitor asks GitHub at most once a day
// (and repeat visits render instantly). Stored per browser; failures just mean no cache.
const CACHE_KEY = "perfboard-contributors-v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedPeople {
  savedAt: number;
  people: Person[];
}

function readCache(): CachedPeople | undefined {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") as CachedPeople | null;
    if (cached && typeof cached.savedAt === "number" && Array.isArray(cached.people)) return cached;
  } catch {
    // Unavailable storage (private mode, blocked site data) or a corrupt entry: no cache.
  }
  return undefined;
}

function writeCache(people: Person[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({savedAt: Date.now(), people}));
  } catch {
    // Storage unavailable or full - the page still works, it just refetches next time.
  }
}

function updatedAgo(savedAt: number): string {
  const hours = Math.floor((Date.now() - savedAt) / (60 * 60 * 1000));
  if (hours < 1) return "less than an hour ago";
  return hours === 1 ? "an hour ago" : `${hours} hours ago`;
}

async function fetchPeople(): Promise<Person[]> {
  const people = new Map<string, Person>();
  // The issues endpoint lists pull requests too (with merged_at), so one paginated call covers both.
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}/issues?state=all&per_page=100&page=${page}`);
    if (!response.ok) throw new Error(`GitHub API responded ${response.status}`);
    const items = await response.json() as GitHubIssue[];
    for (const item of items) {
      const user = item.user;
      if (!user || user.type === "Bot" || user.login === OWNER) continue;
      const person = people.get(user.login) ?? {login: user.login, mergedPrs: 0, issues: 0};
      if (!item.pull_request) person.issues++;
      else if (item.pull_request.merged_at) person.mergedPrs++;
      else continue; // open or closed-unmerged PRs don't count (yet)
      people.set(user.login, person);
    }
    if (items.length < 100) break;
  }
  return Array.from(people.values());
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

function personCard(person: Person): HTMLElement {
  const card = document.createElement("a");
  card.className = "card";
  card.href = `https://github.com/${encodeURIComponent(person.login)}`;
  card.target = "_blank";
  card.rel = "noopener";

  const avatar = document.createElement("img");
  avatar.className = "avatar";
  avatar.src = `https://github.com/${encodeURIComponent(person.login)}.png?size=128`;
  avatar.alt = "";
  avatar.loading = "lazy";
  avatar.width = avatar.height = 64;

  const name = document.createElement("span");
  name.className = "login";
  name.textContent = `@${person.login}`;

  const stats = document.createElement("span");
  stats.className = "stats";
  const parts: string[] = [];
  if (person.mergedPrs) parts.push(plural(person.mergedPrs, "merged PR"));
  if (person.issues) parts.push(plural(person.issues, "issue"));
  stats.textContent = parts.join(" · ");

  card.append(avatar, name, stats);
  return card;
}

function render(people: Person[], note: string) {
  const byActivity = (a: Person, b: Person) =>
    (b.mergedPrs - a.mergedPrs) || (b.issues - a.issues) || a.login.localeCompare(b.login);

  const coders = people.filter(p => p.mergedPrs > 0).sort(byActivity);
  const reporters = people.filter(p => p.mergedPrs === 0 && p.issues > 0).sort(byActivity);

  for (const [id, list] of [["codeContributors", coders], ["issueReporters", reporters]] as [string, Person[]][]) {
    const container = document.getElementById(id);
    if (!container) continue;
    container.replaceChildren(...list.map(personCard));
    if (list.length === 0) container.textContent = "No one yet - you could be the first!";
  }

  const sourceNote = document.getElementById("sourceNote");
  if (sourceNote) sourceNote.textContent = note;
}

const maintainer = document.getElementById("maintainer");
if (maintainer) {
  maintainer.append("Created and maintained by ");
  const link = document.createElement("a");
  link.href = `https://github.com/${OWNER}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = `@${OWNER}`;
  maintainer.append(link, ".");
}
const repoLink = document.getElementById("repoLink") as HTMLAnchorElement | null;
if (repoLink) repoLink.href = REPO_URL;

const cached = readCache();
if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) {
  render(cached.people, `Updated from GitHub ${updatedAgo(cached.savedAt)}.`);
} else {
  // Show what we have right away (yesterday's list, or the built-in snapshot), then refresh.
  render(cached?.people ?? SNAPSHOT, "Loading from GitHub…");
  fetchPeople()
    .then(people => {
      writeCache(people);
      render(people, "Live from GitHub.");
    })
    .catch(() => render(
      cached?.people ?? SNAPSHOT,
      cached
        ? `GitHub couldn't be reached, so this list is from ${updatedAgo(cached.savedAt)}.`
        : "GitHub couldn't be reached, so this is a saved list and may be out of date.",
    ));
}
