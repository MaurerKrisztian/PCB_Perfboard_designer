export {};

// Header dropdown menus (File, View): a `.menu` holds a `.menu-trigger` button and a `.menu-panel`.
// One menu is open at a time; it closes on outside click, Escape, or choosing an item (checkbox items excepted).
const menus = Array.from(document.querySelectorAll<HTMLElement>('.app-header .menu'));

function setOpen(menu: HTMLElement, open: boolean) {
  menu.querySelector<HTMLElement>('.menu-panel')!.hidden = !open;
  menu.querySelector('.menu-trigger')!.setAttribute('aria-expanded', String(open));
}

function closeAll() {
  menus.forEach(menu => setOpen(menu, false));
}

menus.forEach(menu => {
  menu.querySelector('.menu-trigger')!.addEventListener('click', e => {
    e.stopPropagation();
    const wasOpen = !menu.querySelector<HTMLElement>('.menu-panel')!.hidden;
    closeAll();
    setOpen(menu, !wasOpen);
  });
  // Choosing an item closes the menu, except checkbox items, which stay open so several can be toggled.
  menu.querySelector('.menu-panel')!.addEventListener('click', e => {
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
