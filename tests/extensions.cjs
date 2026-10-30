// Run with Node; no package installation needed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const context = {
 window:{markdownit:require('../vendor/markdown-it.min.js')},
 katex:require('../vendor/katex/dist/katex.min.js'),
 texmath:require('../vendor/markdown-it-texmath/texmath.js')
};
vm.createContext(context);
for (const file of ['vendor/markdown-extensions/extensions.min.js','render.js']) {
 vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
}
const render = source => vm.runInContext('md.render('+JSON.stringify(source)+')',context);
const html = render(fs.readFileSync(path.join(__dirname,'extensions.md'),'utf8'));
for (const element of ['table-of-contents','task-list-item-checkbox','footnote-ref','<dl>','<abbr','<mark>','<ins>','<sub>','<sup>','katex']) assert(html.includes(element),element);
assert(html.includes('😄'));
assert.equal((html.match(/type="checkbox"/g)||[]).length,3);
assert.equal((html.match(/checked=""/g)||[]).length,2);
const source = '${toc}\n\n# Same\n\n## Same\n\n# 中文标题\n\n# *Style* `code`';
const headings = render(source);
for (const match of headings.matchAll(/href="#([^"]+)"/g)) assert(headings.includes('id="'+match[1]+'"'),match[1]);
assert.equal(render(source),headings,'IDs must reset on each render');
assert(!render('`${toc}`\n\n```\n${toc}\n- [x] code\n==literal==\n```').includes('table-of-contents'));
for (const marker of ['${toc}','[toc]','[[toc]]']) assert(render(marker+'\n\n# Heading').includes('table-of-contents'));
assert(render('$x^2 + a_1$').includes('katex'));
assert(render('```js\nconst value = "text";\n```').includes('hljs-keyword'));
assert(render('```python\ndef square(x): return x*x\n```').includes('hljs-keyword'));
assert(render('```powershell\nGet-Item -LiteralPath "file.txt"\n```').includes('hljs-'));
for (const language of ['', 'unknown-language']) {
 const code = render('```'+language+'\n<script>literal</script>\n```');
 assert(code.includes('&lt;script&gt;literal&lt;/script&gt;'));
 assert(!code.includes('hljs-'));
}
assert(render('```mermaid\nflowchart LR\nA-->B\n```').includes('class="mermaid-diagram"'));
console.log('Extensions passed: TOC links, duplicate/Unicode headings, tasks, footnotes, formatting, code literals, repeat renders and math.');
