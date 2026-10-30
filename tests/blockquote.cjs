// Optional developer regression test: node tests/blockquote.cjs (built-ins only).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const markdownit = require('../vendor/markdown-it.min.js');
const katex = require('../vendor/katex/dist/katex.min.js');
const texmath = require('../vendor/markdown-it-texmath/texmath.js');
const upstream = markdownit().use(texmath, {engine:katex, delimiters:['dollars','brackets']});
const context = {window:{markdownit}, katex, texmath};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root,'vendor/markdown-extensions/extensions.min.js'),'utf8'),context);
vm.runInContext(fs.readFileSync(path.join(root,'render.js'),'utf8')+'\nglobalThis.parser = md;',context);

function formulas(tokens) {
 return tokens.flatMap(t => t.children ? formulas(t.children) :
  t.type.startsWith('math_') ? [t.content.trim()] : []);
}
for (const md of [upstream, context.parser]) {
 for (const [open,close] of [['$$','$$'],['\\[','\\]']]) {
  for (const [prefix,prose] of [['> ',''],['> ','> explanation\n>\n'],['> > ','> > explanation\n> >\n']]) {
   const source = prose+prefix+open+'\n'+prefix+'a > b\n'+prefix+'> 0\n'+prefix+close;
   const result = formulas(md.parse(source,{}));
   assert.equal(result.length,1);
   assert.equal(result[0],'a > b\n> 0');
  }
  // A completed quote must not affect later formulas outside it.
  const result = formulas(md.parse('> explanation\n\n'+open+'\n> 0\n'+close,{}));
  assert.equal(result[0],'> 0');
 }
 assert.equal(formulas(md.parse('- item\n\n  > explanation\n  >\n  > $$\n  > a > b\n  > $$',{}))[0],'a > b');
}
console.log('Blockquote regression passed: dollars/brackets, prose, nesting, lists, and literal >.');
