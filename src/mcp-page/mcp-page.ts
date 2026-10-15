// MCP server page (mcp-server/index.html): a Copy button on every address and code block. The page
// reads fine without it.

const COPIED_FOR_MS = 1500;

function addCopyButton(box: HTMLElement): void {
  const code = box.querySelector("code");
  if (!code) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "copy-button";
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(code.textContent ?? "");
      button.textContent = "Copied";
      button.classList.add("copied");
    } catch {
      button.textContent = "Press Ctrl+C";
      getSelection()?.selectAllChildren(code);
    }
    setTimeout(() => {
      button.textContent = "Copy";
      button.classList.remove("copied");
    }, COPIED_FOR_MS);
  });
  box.append(button);
}

document.querySelectorAll<HTMLElement>(".code-line, .code-block").forEach(addCopyButton);

export {};
