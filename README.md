# ⚡ PCB Perfboard Designer

[![Live Demo](https://img.shields.io/badge/Live-Demo%20App-brightgreen?style=for-the-badge&logo=github)](https://perfboarddesigner.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![HTML5 Canvas](https://img.shields.io/badge/HTML5-Canvas-E34F26?style=for-the-badge&logo=html5&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)

The **PCB Perfboard Designer** is an advanced, user-friendly web CAD application for designing and prototyping electronic circuits on virtual perfboard grids. It allows electronics engineers, makers, and hobbyists to visualize component placements, trace wire connections, and eliminate desoldering mistakes before assembling physical hardware.

![Perfboard Designer Screenshot](screenshot.png)

---

## ✨ Key Features

- ✏ **Interactive Wire Tracing & Gauges**: Draw custom wire paths with selectable line thickness gauges (`2px Thin`, `4px Normal`, `7px Thick`).
- 📦 **Integrated Circuits (ICs) Catalog & Editor**: Place built-in chips (`NE555 Timer`, `DIP-14 Logic`, `ATmega328P`) or open the **IC Editor** to create custom chips with dynamic pin labels.
- 🎨 **Visual 2D Color Selector & LocalStorage Palette**: Click and drag across a 2D color spectrum box with rainbow hue slider to pick active wire colors. Save custom color swatches permanently to `localStorage`.
- ⛶ **Fullscreen Focus Mode & Widescreen Auto-Fit**: Expand the canvas workspace to `100vw` × `100vh` for distraction-free designing. Includes auto-fit scale calculation (`🎯 Fit`) to display large boards (`30×20`, `40×30`, `50×50`) with zero scrollbars.
- 🖱 **Middle Mouse Button Board Panning**: Pan across large perfboard grids by holding the middle mouse wheel button and dragging.
- 🔍 **Smooth Board Zooming**: Zoom in and out smoothly from `20%` up to `300%` using `Ctrl + Mouse Wheel` or dedicated zoom buttons.
- 💾 **Full Progress & Project File Persistence**: Save your progress locally (`Save Progress`) or export/import complete circuit designs as JSON project files (`Save Project` / `Load Project`).
- 🛠 **Dedicated Tool Modes**: Toggle between `🖐 Select` (inspection only), `✏ Wire`, `🧹 Eraser`, and `📝 Note` annotation modes.
- 🖱 **Right-Click Context Menu**: Quick access to color changes, text note editing, and component deletion.

---

## 🛠 Tech Stack

- **Core**: HTML5 Canvas, Vanilla JavaScript & TypeScript (ESNext)
- **Bundler & Build Tool**: Vite v3
- **Styling**: Custom Dark Engineering Layout System (CSS3 Tokens & Glassmorphic Components)
- **Storage**: Browser LocalStorage & Native File API

---

## 🚀 Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) (v16+) installed.

### Installation & Local Development

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/maurerkrisztian/PCB_Perfboard_designer.git
   cd PCB_Perfboard_designer
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Start Development Server**:
   ```bash
   npm run start
   ```
   Open `http://localhost:5173` in your browser.

4. **Build Production Bundle**:
   ```bash
   npm run build
   ```

---

## ⌨ Keyboard Shortcuts & Controls

| Action | Shortcut / Gesture |
| :--- | :--- |
| **Pan Canvas View** | `Middle Mouse Click + Drag` |
| **Zoom In / Zoom Out** | `Mouse Wheel` or `🔍 +` / `🔍 -` |
| **Toggle Fullscreen Mode** | `f` / `F` or `⛶ Fullscreen` |
| **Unselect / Exit Fullscreen** | `Escape` |
| **Delete Selected Item** | `Delete` key or `🧹 Eraser` |
| **Undo Last Change** | `Ctrl + Z` |
| **Redo Last Action** | `Ctrl + Y` |
| **Rotate Placed IC** | `r` |
| **Add Text Note** | `d` |
| **Remove Text Note** | `D` |

---

## 🤝 Contributing

Contributions are welcome! Feel free to:
1. **Report Issues**: Submit bug reports or feature requests via GitHub Issues.
2. **Pull Requests**: Fork the repository and open pull requests for new tools or improvements.

---

## 📜 License

Distributed under the **ISC License**.
