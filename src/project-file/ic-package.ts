// Catalog parts that are really small boards on header pins rather than molded chips. They keep
// a plain box in the editor and get a board model in the 3D viewer; only the rest are DIPs.
const MODULE_NAME = /arduino|nano|pico|esp\s?-?\d|esp32|esp8266|module|breakout|board/i;

export function isModuleName(name: string): boolean {
  return MODULE_NAME.test(name);
}
