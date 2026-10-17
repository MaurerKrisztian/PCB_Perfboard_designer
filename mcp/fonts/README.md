# Fonts for board pictures

The PNG pictures of a board (`render_board` with `format: "png"`, drawn by resvg in
`src/board-png.ts`) can't use the system's fonts, so `build.mjs` bakes these in: Noto Sans for
the part icons' text (`Arial, sans-serif`) and Noto Sans Mono for labels, regular and bold.

They're cut down to the characters boards use (Latin, Greek for Ω and µ, a few symbols) to keep
the server small. To remake them from the full Noto fonts:

```bash
for f in NotoSans-Regular NotoSans-Bold NotoSansMono-Regular NotoSansMono-Bold; do
  pyftsubset "$f.ttf" --unicodes="U+0020-007E,U+00A0-00FF,U+0391-03A9,U+03B1-03C9,U+2010-2027,U+2030,U+2032-2033,U+2039-203A,U+2122,U+2126,U+2190-2195,U+2212,U+221E,U+2248,U+2260,U+2264-2265" \
    --layout-features='kern,liga' --no-hinting --desubroutinize --output-file="fonts/$f.ttf"
done
```

Licensed under the SIL Open Font License 1.1 (`OFL.txt`).
