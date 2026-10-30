# Markdown to PDF

A small Markdown exporter with a static web editor and a Windows PowerShell CLI.
Both use the same renderer and print styles. No backend or framework is required.
Bundled JavaScript, fonts, and CSS work offline; remote document images still need
a network connection.

## Web editor

Online: **https://llleixx.github.io/MarkdownToPdf/**

Open `web/index.html` in Edge or Chrome. No installation or build is needed.

- Open or drop Markdown files and images. Import a folder to keep relative image paths.
- Switch between documents; edits are kept in memory. Close prompts before discarding unsaved edits.
- Use **Save .md** to download the edited Markdown. Changes do not overwrite the source file.
- **Sync Scroll** toggles scrolling by relative document progress. Tab / Shift+Tab indent and unindent.
- **Export PDF** opens the browser print dialog. Choose **Save as PDF**, disable headers and footers,
  and enable background graphics to preserve theme backgrounds.

Each PDF export contains the current document only. Imported documents and images
are kept for the current page session, so save edits before leaving.

For static hosting, publish the whole project with its directory structure intact
and use `/web/` as the entry point. Publishing only the `web` folder will omit the
shared renderer, themes, and libraries. Edge is the primary tested web browser;
other browsers may differ in printing and file/folder drag-and-drop behavior.

GitHub Pages deploys automatically on pushes to `main`, using
`.github/workflows/pages.yml`. Only the web editor and its runtime resources are
published to the site; CLI scripts and test documents are excluded from the site artifact.

## Command line

Requires Windows PowerShell 5.1 or newer and an installed Edge, Chrome, or Firefox.
Node.js, npm, and Python are not required for normal use.

```powershell
.\export.ps1 -InputFile .\notes.md
.\export.ps1 -InputFile .\notes.md -OutputFile .\output\notes.pdf -Theme newsprint
.\export.ps1 -InputFile .\notes.md -Browser firefox
.\export.ps1 -InputFile .\notes.md -CssFile .\custom.css
```

The default theme is `github`. Available themes are `github`, `newsprint`, `night`,
`pixyll`, and `whitey`; `original` remains an alias for `github`.

The default output is a PDF beside the input Markdown. Existing output files are
replaced after a successful export. Failed rendering preserves the previous PDF.
Output directories are created as needed. Use `-Browser` with `msedge`, `chrome`,
`firefox`, or an executable path; automatic selection prefers Edge/Chrome.
Each export uses a disposable browser profile.

Local images resolve relative to the Markdown file. Missing images, invalid TeX,
or invalid Mermaid diagrams produce an error instead of a partial PDF.

Chromium CLI exports include PDF chapter bookmarks based on headings. The web
editor uses ordinary browser printing and cannot request the same outline option.
Firefox has a separate CLI driver; its bookmark output is not guaranteed to match Chromium.
The visible `${toc}` directory and PDF viewer bookmarks are separate features.

## Supported content

- Headings, links, lists, quotes, tables, fenced code, and strikethrough.
- `${toc}`, `[toc]`, or `[[toc]]` on a separate line for a linked table of contents.
- Task lists, footnotes, definition lists, abbreviations, emoji shortcodes,
  `==highlight==`, `++insert++`, `H~2~O`, and `x^2^`.
- KaTeX formulas with dollar or bracket delimiters, and `mermaid` fenced diagrams.
- Syntax highlighting for common named languages; unknown languages remain plain text.
- Common embedded HTML layout, sanitized with DOMPurify before insertion.
- Shared table wrapping/scaling when a table would overflow the available width.

Themes control visual style; `themes/print-common.css` controls common spacing,
paper layout, table of contents, and print behavior. Theme resemblance is the goal;
pagination does not aim to exactly reproduce Typora.

## Project layout

```text
export.ps1                  CLI entry point
render.js                   Shared Markdown, HTML, math, diagram, and table rendering
web/                        Static editor and isolated preview styles
themes/                     Theme CSS/assets and print-common.css
tools/browser-common.ps1    Shared browser process and protocol transport
tools/browser-chromium.ps1  Chromium PDF export driver
tools/browser-firefox.ps1   Firefox PDF export driver
vendor/                     Bundled libraries and their license files
tests/                      Fixtures, regression scripts, and Typora reference PDFs
```

Preview CSS is isolated from the editor UI; rendering and print CSS are shared with
the CLI. Keep library and theme license/credit files when distributing the project.
`vendor/katex/dist/fonts` contains the math fonts referenced by KaTeX CSS.

## Development checks

Optional parser regression tests require Node.js, with no package installation:

```powershell
node .\tests\blockquote.cjs
node .\tests\extensions.cjs
```

Browser export smoke tests require an installed browser. They export HTML, math,
Markdown extensions, and Mermaid fixtures to a temporary folder and print its location:

```powershell
powershell -NoProfile -File .\tests\browser-export.ps1 -Browser 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
```

The PDFs named `tests/lec3_*.pdf` are original Typora references for manual comparison.
`tests/action-test.md` is a small Quicker integration sample.

The prebuilt Markdown plugin bundle is included. Only maintainers changing its
imports need npm and the optional rebuild step:

```powershell
cd .\vendor\markdown-extensions
npm ci
npm run build
```

The texmath vendor patch is documented in `vendor/markdown-it-texmath/PATCHES.txt`.
