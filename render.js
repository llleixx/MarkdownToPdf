const md = window.markdownit({html:true, breaks:true, linkify:true}).use(texmath, {
 engine: katex,
 delimiters: ['dollars', 'brackets'],
 katexOptions: {throwOnError:true, trust:false}
});
markdownExtensions.install(md);

const codeFence = md.renderer.rules.fence;
md.renderer.rules.fence = (tokens, i, options, env, renderer) => {
 if (tokens[i].info.trim().split(/\s+/)[0].toLowerCase() === 'mermaid') {
  return '<div class="mermaid-diagram">' + md.utils.escapeHtml(tokens[i].content) + '</div>\n';
 }
 return codeFence(tokens, i, options, env, renderer);
};
let diagramId = 0;
let renderQueue = Promise.resolve();
const printContainers = new WeakSet();

function fitTables(container) {
 for (const table of container.querySelectorAll('table')) {
  table.style.zoom = '';
  table.classList.remove('table-wrap');
  const parent = table.parentElement;
  const style = parent.ownerDocument.defaultView.getComputedStyle(parent);
  const available = parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  if (available <= 0) continue;
  if (available / Math.max(table.scrollWidth, table.getBoundingClientRect().width) < 0.65) {
   table.classList.add('table-wrap');
  }
  let zoom = 1;
  for (let attempt = 0; attempt < 5; attempt++) {
   const width = Math.max(table.scrollWidth * zoom, table.getBoundingClientRect().width);
   if (width <= available + 1) break;
   zoom = Math.floor(zoom * available / width * 100) / 100;
   table.style.zoom = String(Math.max(0.01, zoom));
  }
 }
}

// Parsing belongs to texmath. Keep the existing PDF markup and fail on invalid TeX.
const formula = (tokens, i, displayMode) => katex.renderToString(tokens[i].content, {
 throwOnError:true, trust:false, displayMode
});
md.renderer.rules.math_inline = (tokens, i) => formula(tokens, i, false);
md.renderer.rules.math_block = (tokens, i) => '<div class="math-block">' + formula(tokens, i, true) + '</div>';
md.renderer.rules.math_inline_double = (tokens, i) => '<span class="math-block">' + formula(tokens, i, true) + '</span>';
md.renderer.rules.math_block_eqno = (tokens, i) => '<div class="math-block">' + formula(tokens, i, true) +
 '<div class="math-number">(' + md.utils.escapeHtml(tokens[i].info) + ')</div></div>';

// Shared by the CLI page and web preview. Only the web supplies an image resolver.
async function renderDocument(container, source, {resolveImage} = {}) {
 try {
  const document = container.ownerDocument;
  const template = document.createElement('template');
  template.innerHTML = DOMPurify.sanitize(md.render(source), {
   FORBID_TAGS:['style','link','base','meta','form'],
   ADD_ATTR:['hidden']
  });
  const imageSources = new Map();
  for (const image of template.content.querySelectorAll('img')) {
   if (resolveImage) imageSources.set(image, image.getAttribute('src'));
   if (resolveImage) image.setAttribute('src', resolveImage(image.getAttribute('src') || ''));
   image.loading = 'eager';
  }
  container.replaceChildren(template.content);
  await document.fonts.ready;
  const diagrams = [...container.querySelectorAll('.mermaid-diagram')];
  if (diagrams.length) {
   const style = document.defaultView.getComputedStyle(container);
   mermaid.initialize({startOnLoad:false, securityLevel:'strict', suppressErrorRendering:true,
    theme:style.getPropertyValue('--diagram-theme').trim() || 'neutral',
    fontFamily:style.fontFamily, htmlLabels:false, arrowMarkerAbsolute:true});
   for (const [index, diagram] of diagrams.entries()) {
    try {
     const {svg} = await mermaid.render('md-diagram-' + (++diagramId), diagram.textContent, diagram);
     diagram.innerHTML = svg;
    } catch (error) {
     throw new Error('Mermaid diagram ' + (index + 1) + ': ' + error.message);
    }
   }
   await document.fonts.ready;
  }
  const images = [...container.querySelectorAll('img')];
  await Promise.all(images.map(image => image.decode().catch(() => {
   throw new Error('Failed to load image: ' + (imageSources.get(image) || image.currentSrc || image.src || '(missing src)'));
  })));
  fitTables(container);
  if (!printContainers.has(container)) {
   printContainers.add(container);
   const view = document.defaultView;
   view.addEventListener('beforeprint', () => fitTables(container));
   view.addEventListener('afterprint', () => fitTables(container));
  }
  return {ok:true, images:images.length, formulas:container.querySelectorAll('.katex').length, diagrams:diagrams.length};
 } catch (error) {
  return {ok:false, error:String(error)};
 }
}

// Mermaid has shared configuration and temporary DOM. Keep preview updates ordered.
window.renderMarkdown = (...args) => {
 const job = renderQueue.then(() => renderDocument(...args));
 renderQueue = job.catch(() => {});
 return job;
};
