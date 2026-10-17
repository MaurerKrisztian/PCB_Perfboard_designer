// Catalog parts that are really small boards on header pins rather than molded chips. They get
// the dev-board look in the editor and a board model in the 3D viewer; only the rest are DIPs.
// A part is a module when its catalog category is under "modules".
const MODULE_NAME = /arduino|nano|pico|esp\s?-?\d|esp32|esp8266|module|breakout|board/i;

export function isModuleCategory(category: string): boolean {
  return category === "modules" || category.startsWith("modules.");
}

// Files saved before placed chips recorded a category only have the name to go by.
export function isModuleName(name: string): boolean {
  return MODULE_NAME.test(name);
}

export function isModulePart(category: string | undefined, name: string): boolean {
  return category !== undefined ? isModuleCategory(category) : isModuleName(name);
}
