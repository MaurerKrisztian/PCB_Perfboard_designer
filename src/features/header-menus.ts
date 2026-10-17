export {};

// Header dropdown menus (File, View, Help): a `.menu` holds a `.menu-trigger` button and a `.menu-panel`.
// One menu is open at a time; it closes on outside click, Escape, or choosing an item (checkbox items excepted).
const menus = Array.from(document.querySelectorAll<HTMLElement>('.app-header .menu'));

// A menu's `.menu-trigger` or `.menu-panel`; a menu without one is a mistake in index.html.
function menuPart(menu: HTMLElement, selector: '.menu-trigger' | '.menu-panel'): HTMLElement {
  const part = menu.querySelector<HTMLElement>(selector);
  if (!part) throw new Error(`A header menu has no ${selector}.`);
  return part;
}

function setOpen(menu: HTMLElement, open: boolean) {
  menuPart(menu, '.menu-panel').hidden = !open;
  menuPart(menu, '.menu-trigger').setAttribute('aria-expanded', String(open));
}

function closeAll() {
  menus.forEach(menu => setOpen(menu, false));
}

menus.forEach(menu => {
  menuPart(menu, '.menu-trigger').addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = !menuPart(menu, '.menu-panel').hidden;
    closeAll();
    setOpen(menu, !wasOpen);
  });
  // Choosing an item closes the menu, except checkbox items, which stay open so several can be toggled.
  menuPart(menu, '.menu-panel').addEventListener('click', e => {
    if ((e.target as HTMLElement).closest('[role="menuitemcheckbox"]')) {
      e.stopPropagation();
      return;
    }
    setOpen(menu, false);
  });
});

document.addEventListener('click', closeAll);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAll();
});
