export class Utils {
  static getSafeHtmlElement<T extends HTMLElement = HTMLHtmlElement>(id: string): T {
    const element = document.getElementById(id);
    if (element == null){
      throw new Error(`Element: ${id} not found.`)
    }

    return element as T
  }
}
