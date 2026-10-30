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
.\export.ps1 -InputFile .\a.md, .\b.md
.\export.ps1 -InputFile .\notes -OutputDirectory .\pdfs
.\export.ps1 -InputFile .\notes -Recurse -OutputDirectory .\pdfs
```

The default theme is `github`. Available themes are `github`, `newsprint`, `night`,
`pixyll`, and `whitey`; `original` remains an alias for `github`.

The default output is a PDF beside the input Markdown. Existing output files are
rejected by default. Pass `-Overwrite` to explicitly allow replacement, for example:
`./export.ps1 -InputFile ./notes.md -Overwrite`.
Replacement happens only after a successful export. Failed rendering preserves the
previous PDF. Without `-Overwrite`, even a destination created during rendering is
not replaced. A locked destination causes an error rather than deletion of the old PDF.
Output directories are created as needed. Use `-Browser` with `msedge`, `chrome`,
`firefox`, or an executable path; automatic selection prefers Edge/Chrome.
Each export uses a disposable browser profile.

`-InputFile` accepts one or more literal file/folder paths. Folder inputs select
`.md` files in that folder; add `-Recurse` to include subfolders. Each source creates
one PDF. The theme, browser, custom CSS, and overwrite flag apply to the whole batch.

`-OutputFile` is only valid with one explicit file. Use `-OutputDirectory` for a
destination folder instead: folder inputs preserve paths relative to their root,
while explicit files use their filenames. For example, `notes/sub/topic.md` becomes
`pdfs/sub/topic.pdf` when importing `notes`. Without either output option, PDFs are
written beside their source Markdown. The two output options cannot be combined.

Batch inputs are de-duplicated by full source path, keeping the first occurrence.
All jobs targeting a shared destination are rejected before those PDFs are written,
even with `-Overwrite`; there is no automatic renaming or document merging.
Existing PDFs are skipped unless `-Overwrite` is passed. Empty folders are skipped.
Other failures do not stop the remaining jobs. A final summary reports succeeded,
skipped (including duplicates/empty folders), and failed counts; any failure returns
exit code 1. Single-file mode retains its existing output format and rejects an
existing PDF unless `-Overwrite` is passed.

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
KaTeX keeps all font families/styles in WOFF2 format only; duplicate WOFF/TTF
fallbacks are omitted. This distribution change is recorded in `vendor/katex/PATCHES.txt`.

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
powershell -NoProfile -File .\tests\batch-export.ps1 -Browser msedge
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
