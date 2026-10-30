'use strict';

const themeLink = document.getElementById('theme');
const content = document.getElementById('write');
const themes = new Set(['github', 'newsprint', 'night', 'pixyll', 'whitey']);
let latest = 0;
let printable = 0;
let themeName = 'github';
let themeReady = Promise.resolve();
const imageUrls = new Map();

// Create URLs inside this frame: file:// pages cannot share parent blob URLs.
function localImages(assets) {
 const active = new Set(assets.map(asset => asset.id));
 for (const [id, url] of imageUrls) {
  if (!active.has(id)) {URL.revokeObjectURL(url); imageUrls.delete(id);}
 }
 return assets.map(asset => {
  if (!imageUrls.has(asset.id)) imageUrls.set(asset.id, URL.createObjectURL(asset.file));
  return {path:asset.path, url:imageUrls.get(asset.id)};
 });
}

function send(message) {
 parent.postMessage({source:'markdown-pdf-preview', ...message}, '*');
}

function normalizePath(path) {
 const parts = [];
 for (const part of path.replace(/\\/g, '/').split('/')) {
  if (!part || part === '.') continue;
  if (part === '..') parts.pop();
  else parts.push(part);
 }
 return parts.join('/');
}

function imageResolver(documentPath, assets) {
 const directory = documentPath.slice(0, documentPath.lastIndexOf('/') + 1);
 const files = assets.map(asset => ({...asset, path:normalizePath(asset.path)}));
 return source => {
  if (/^(?:https?:|data:|blob:|\/\/)/i.test(source)) return source;
  let path;
  try { path = decodeURIComponent(source.split(/[?#]/)[0]); }
  catch { path = source; }
  const candidates = [normalizePath(directory + path), normalizePath(path)];
  for (const candidate of candidates) {
   const match = files.find(file => file.path === candidate);
   if (match) return match.url;
  }
  // Individual file uploads have no directory information. Only use a basename
  // fallback when it identifies exactly one image; never guess between duplicates.
  const basename = normalizePath(path).split('/').pop();
  const matches = files.filter(file => file.path.split('/').pop() === basename);
  if (matches.length === 1) return matches[0].url;
  if (matches.length > 1) throw new Error('Ambiguous local image: ' + source + '. Import its folder to preserve relative paths.');
  throw new Error('Missing local image: ' + source + '. Import this image or its folder.');
 };
}

function setTheme(name) {
 if (name === themeName) return themeReady;
 themeName = name;
 themeReady = new Promise((resolve, reject) => {
  themeLink.onload = resolve;
  themeLink.onerror = () => reject(new Error('Failed to load theme: ' + name));
  themeLink.href = '../themes/' + name + '.css';
 });
 return themeReady;
}

window.addEventListener('message', async event => {
 if (event.source !== parent || event.data?.source !== 'markdown-pdf-app') return;
 const message = event.data;
 if (message.type === 'print') {
  if (printable !== message.id || printable !== latest) return;
  window.focus();
  window.print();
  return;
 }
 if (message.type !== 'render' || !themes.has(message.theme)) return;
 latest = message.id;
 printable = 0;
 try {
  await setTheme(message.theme);
  if (latest !== message.id) return;
  document.title = message.title;
  const result = await renderMarkdown(content, message.markdown, {
   resolveImage:imageResolver(message.path, localImages(message.assets))
  });
  if (latest !== message.id) return;
  printable = result.ok ? message.id : 0;
  // Measure content rather than the previous iframe viewport, so shorter documents shrink too.
  const height = content.getBoundingClientRect().bottom + window.scrollY + parseFloat(getComputedStyle(document.body).paddingBottom);
  send({type:'rendered', id:message.id, ...result, height});
 } catch (error) {
  if (latest === message.id) send({type:'rendered', id:message.id, ok:false, error:String(error)});
 }
});

window.addEventListener('load', () => send({type:'ready'}));

// Drag events do not bubble out of an iframe. Show the parent's drop surface.
function isExternalFileDrag(event) {
 const types = event.dataTransfer?.types || [];
 return types.includes('Files') && !types.includes('application/x-markdown-pdf-internal');
}
window.addEventListener('dragstart', event => {
 event.dataTransfer.setData('application/x-markdown-pdf-internal', '1');
 send({type:'drag-end'});
});
window.addEventListener('dragend', () => send({type:'drag-end'}));
window.addEventListener('dragenter', event => {
 if (!isExternalFileDrag(event)) return;
 event.preventDefault();
 send({type:'drag-enter'});
});
window.addEventListener('dragover', event => {
 if (isExternalFileDrag(event)) event.preventDefault();
});
window.addEventListener('drop', event => {
 send({type:'drag-end'});
 if (event.dataTransfer?.types.includes('Files')) event.preventDefault();
 if (!isExternalFileDrag(event)) return;
 send({type:'drop-files', files:[...event.dataTransfer.files]});
});
