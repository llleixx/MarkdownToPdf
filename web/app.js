'use strict';

const editor = document.getElementById('editor');
const documentSelect = document.getElementById('document');
const theme = document.getElementById('theme');
const preview = document.getElementById('preview');
const status = document.getElementById('status');
const printButton = document.getElementById('print');
const fileInput = document.getElementById('files');
const folderInput = document.getElementById('folder');
const overlay = document.getElementById('drop-overlay');
const previewScroll = document.querySelector('.preview-scroll');
const syncButton = document.getElementById('sync-scroll');
const expectedScroll = new WeakMap();
const documents = new Map();
const assets = new Map();
let activePath = 'Example.md';
let frameReady = false;
let requestId = 0;
let readyId = 0;
let timer;
let assetId = 0;

const example = `# From Markdown to PDF

Drop your Markdown and images here, or use **Open files**. Choose **Import folder** to keep relative image paths.

\${toc}

## A simple workflow

- [x] Open a document and choose a theme
- [ ] Edit and preview your changes
- [ ] Export PDF, then choose **Save as PDF**

> Everything is processed in your browser. Remote images still need a network connection.

## Formatting

Use ==highlights==, ++inserted text++, ~~strikethrough~~, H~2~O, and x^2^.

| Feature | Syntax |
| :--- | :--- |
| Table of contents | Put \`\${toc}\` on its own line |
| Tasks | \`- [ ]\` and \`- [x]\` |
| Footnotes | \`[^note]\` |
| Emoji | :smile: :sparkles: |

Markdown
: Plain text with readable formatting.

HTML is supported too, including tables and aligned text.

*[HTML]: HyperText Markup Language

## Code and diagrams

Name a language after the opening code fence to highlight it:

\`\`\`javascript
const greet = (name) => \`Hello, \${name}!\`;
console.log(greet("World"));
\`\`\`

Use a mermaid code fence for a diagram:

\`\`\`mermaid
flowchart LR
  A[Markdown] --> B[Preview]
  B --> C[PDF]
\`\`\`

## Mathematics

Inline math: $E=mc^2$. Display math:

$$
\\sum_{i=1}^{n}i=\\frac{n(n+1)}{2}
$$

A note can provide more detail.[^note]

[^note]: Footnotes, styles, and formulas are shared with the command-line exporter.
`;

function setStatus(text, error = false) {
 status.textContent = text;
 status.dataset.error = String(error);
}

function send(message) {
 preview.contentWindow.postMessage({source:'markdown-pdf-app', ...message}, '*');
}

function updateCounts() {
 document.getElementById('asset-count').textContent = assets.size + ' local images';
 document.getElementById('character-count').textContent = editor.value.length.toLocaleString() + ' characters';
}

function render() {
 clearTimeout(timer);
 printButton.disabled = true;
 readyId = 0;
 updateCounts();
 if (!frameReady) return;
 const title = activePath.split('/').pop().replace(/\.(md|markdown|txt)$/i, '') || 'Markdown';
 document.title = title + ' · Markdown to PDF';
 setStatus('Updating preview…');
 send({type:'render', id:++requestId, markdown:editor.value, theme:theme.value,
  title, path:activePath, assets:[...assets].map(([path, asset]) => ({path, ...asset}))});
}

function selectDocument(path) {
 activePath = path;
 documentSelect.replaceChildren(...[...documents.keys()].map(key => {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = key;
  option.selected = key === path;
  return option;
 }));
 editor.value = documents.get(path).text;
 render();
}

async function importFiles(entries) {
 let firstDocument;
 let accepted = 0;
 let skipped = false;
 try {
  setStatus('Reading files…');
  for (const {file, path} of entries) {
   if (/\.(md|markdown|txt)$/i.test(file.name)) {
    const text = await file.text();
    if (documents.get(path)?.dirty && !window.confirm('Replace "' + path + '" and discard unsaved changes?')) {
     skipped = true;
     continue;
    }
    documents.set(path, {text, dirty:false});
    firstDocument ??= path;
    accepted++;
   } else if (file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)$/i.test(file.name)) {
    assets.set(path, {id:++assetId, file});
    accepted++;
   }
  }
  if (!accepted) return setStatus(skipped ? 'Import canceled. Unsaved edits were kept.' : 'No supported files found. Choose Markdown (.md) or images.', !skipped);
  selectDocument(firstDocument || activePath);
 } catch (error) {
  setStatus('Could not read files: ' + error.message, true);
 }
}

function fromFileList(files) {
 return [...files].map(file => ({file, path:(file.webkitRelativePath || file.name).replace(/\\/g, '/')}));
}

// Folder drops use the browser's entry API; ordinary files need no special API.
async function readEntry(entry, prefix = '') {
 if (entry.isFile) {
  const file = await new Promise((resolve, reject) => entry.file(resolve, reject));
  return [{file, path:prefix + file.name}];
 }
 if (!entry.isDirectory) return [];
 const reader = entry.createReader();
 const children = [];
 while (true) {
  const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
  if (!batch.length) break;
  children.push(...batch);
 }
 return (await Promise.all(children.map(child => readEntry(child, prefix + entry.name + '/')))).flat();
}

document.getElementById('open-files').onclick = () => fileInput.click();
document.getElementById('open-folder').onclick = () => folderInput.click();
for (const input of [fileInput, folderInput]) input.onchange = () => {
 const entries = fromFileList(input.files);
 input.value = '';
 if (entries.length) importFiles(entries);
};
documentSelect.onchange = () => selectDocument(documentSelect.value);
theme.onchange = render;
editor.oninput = () => {
 documents.set(activePath, {text:editor.value, dirty:true});
 printButton.disabled = true;
 readyId = 0;
 requestId++; // Ignore older replies while waiting for the debounce.
 updateCounts();
 setStatus('Editing…');
 clearTimeout(timer);
 timer = setTimeout(render, 400);
};

// Synchronize progress through the two documents without feeding scroll events back.
function syncScroll(source, target) {
 if (syncButton.getAttribute('aria-pressed') !== 'true') return;
 const expected = expectedScroll.get(source);
 expectedScroll.delete(source);
 if (expected !== undefined && Math.abs(source.scrollTop - expected) < 1) return;
 const range = source.scrollHeight - source.clientHeight;
 if (range <= 0) return;
 const top = source.scrollTop / range * Math.max(0, target.scrollHeight - target.clientHeight);
 if (Math.abs(target.scrollTop - top) > 1) {
  target.scrollTop = top;
  expectedScroll.set(target, target.scrollTop);
 }
}
editor.addEventListener('scroll', () => syncScroll(editor, previewScroll), {passive:true});
previewScroll.addEventListener('scroll', () => syncScroll(previewScroll, editor), {passive:true});
syncButton.onclick = () => {
 const enabled = syncButton.getAttribute('aria-pressed') !== 'true';
 syncButton.setAttribute('aria-pressed', String(enabled));
 syncButton.textContent = 'Sync Scroll: ' + (enabled ? 'On' : 'Off');
 expectedScroll.delete(editor);
 expectedScroll.delete(previewScroll);
 if (enabled) syncScroll(editor, previewScroll);
};

editor.addEventListener('keydown', event => {
 if (event.key !== 'Tab' || event.ctrlKey || event.metaKey || event.altKey) return;
 event.preventDefault();
 const {selectionStart:start, selectionEnd:end, value} = editor;
 if (!event.shiftKey && start === end) {
  editor.setRangeText('  ', start, end, 'end');
 } else {
  const first = start === 0 ? 0 : value.lastIndexOf('\n', start - 1) + 1;
  const last = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const lineEnd = value.indexOf('\n', last);
  const stop = lineEnd < 0 ? value.length : lineEnd;
  const lines = value.slice(first, stop).split('\n');
  const removed = lines.map(line => event.shiftKey ? (line.match(/^(?: {1,2}|\t)/)?.[0].length || 0) : 0);
  const replacement = lines.map((line, i) => event.shiftKey ? line.slice(removed[i]) : '  ' + line).join('\n');
  editor.setRangeText(replacement, first, stop, 'preserve');
  const delta = replacement.length - (stop - first);
  editor.setSelectionRange(Math.max(first, start + (event.shiftKey ? -Math.min(start-first, removed[0]) : 2)), end + delta);
 }
 editor.dispatchEvent(new Event('input', {bubbles:true}));
});
document.getElementById('new-document').onclick = () => {
 let name = 'Untitled.md';
 for (let i = 2; documents.has(name); i++) name = 'Untitled ' + i + '.md';
 documents.set(name, {text:'', dirty:false});
 selectDocument(name);
 editor.focus();
};
document.getElementById('close-document').onclick = () => {
 if (documents.get(activePath).dirty && !window.confirm('Close "' + activePath + '" and discard unsaved changes?')) return;
 const paths = [...documents.keys()];
 const index = paths.indexOf(activePath);
 documents.delete(activePath);
 if (!documents.size) documents.set('Untitled.md', {text:'', dirty:false});
 const remaining = [...documents.keys()];
 selectDocument(remaining[Math.min(index, remaining.length - 1)]);
};
document.getElementById('save-markdown').onclick = () => {
 const url = URL.createObjectURL(new Blob([editor.value], {type:'text/markdown;charset=utf-8'}));
 const link = document.createElement('a');
 link.href = url;
 link.download = activePath.split('/').pop().replace(/\.(markdown|txt)$/i, '.md');
 link.click();
 setTimeout(() => URL.revokeObjectURL(url), 1000);
 documents.get(activePath).dirty = false;
};
printButton.onclick = () => {
 if (!readyId || readyId !== requestId) return;
 send({type:'print', id:readyId});
 setStatus('Choose Save as PDF. Use A4, 100% scale, and enable background graphics.');
};

window.addEventListener('message', event => {
 if (event.source !== preview.contentWindow || event.data?.source !== 'markdown-pdf-preview') return;
 const message = event.data;
 if (message.type === 'drag-enter') overlay.hidden = false;
 if (message.type === 'drag-end') hideDropOverlay();
 if (message.type === 'drop-files') {
  hideDropOverlay();
  importFiles(fromFileList(message.files));
 }
 if (message.type === 'ready') {frameReady = true; render();}
 if (message.type !== 'rendered' || message.id !== requestId) return;
 if (!message.ok) {
  printButton.disabled = true;
  return setStatus('Preview failed: ' + message.error, true);
 }
 preview.style.height = Math.max(1124, message.height) + 'px';
 syncScroll(editor, previewScroll);
 readyId = message.id;
 printButton.disabled = !editor.value.trim();
 setStatus('Preview updated · ' + message.images + ' images · ' + message.formulas + ' formulas · ' + message.diagrams + ' diagrams');
});

function hideDropOverlay() {
 overlay.hidden = true;
}
function isExternalFileDrag(event) {
 const types = event.dataTransfer?.types || [];
 return types.includes('Files') && !types.includes('application/x-markdown-pdf-internal');
}
window.addEventListener('dragstart', event => {
 event.dataTransfer.setData('application/x-markdown-pdf-internal', '1');
 hideDropOverlay();
});
window.addEventListener('dragenter', event => {
 if (!isExternalFileDrag(event)) return;
 event.preventDefault();
 overlay.hidden = false;
});
window.addEventListener('dragover', event => {
 if (!isExternalFileDrag(event)) return;
 event.preventDefault();
 event.dataTransfer.dropEffect = 'copy';
});
window.addEventListener('dragleave', event => {
 if (!event.relatedTarget || !document.documentElement.contains(event.relatedTarget)) hideDropOverlay();
});
window.addEventListener('dragend', hideDropOverlay);
window.addEventListener('blur', hideDropOverlay);
window.addEventListener('pointerup', hideDropOverlay);
window.addEventListener('drop', async event => {
 hideDropOverlay();
 if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
 if (!isExternalFileDrag(event)) return;
 try {
  // Capture File objects during the drop event. FileSystemEntry.file() can fail
  // with EncodingError on local pages; only directories need the entry API.
  const items = [...event.dataTransfer.items].filter(item => item.kind === 'file');
  const reads = items.map(item => {
   const file = item.getAsFile();
   let entry;
   try {entry = item.webkitGetAsEntry?.();}
   catch (error) {if (!file) throw error;}
   if (entry?.isDirectory) return readEntry(entry);
   if (file) return [{file, path:file.name}];
   return entry ? readEntry(entry) : [];
  });
  const files = reads.length ? (await Promise.all(reads)).flat() : fromFileList(event.dataTransfer.files);
  await importFiles(files);
 } catch (error) {setStatus('Could not read dropped files: ' + error.message + ' Try Open files or Import folder.', true);}
});
window.addEventListener('beforeunload', event => {
 if ([...documents.values()].some(doc => doc.dirty)) {event.preventDefault(); event.returnValue = '';}
});

window.addEventListener('keydown', event => {
 if (event.key === 'Escape') hideDropOverlay();
 if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p') {
  event.preventDefault();
  printButton.click();
 }
});

documents.set(activePath, {text:example, dirty:false});
selectDocument(activePath);
