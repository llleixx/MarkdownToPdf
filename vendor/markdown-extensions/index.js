// Optional rebuild: npm install && npm run build. The app uses the bundled file.
import anchor from 'markdown-it-anchor';
import toc from 'markdown-it-table-of-contents';
import tasks from 'markdown-it-task-lists';
import footnote from 'markdown-it-footnote';
import deflist from 'markdown-it-deflist';
import abbr from 'markdown-it-abbr';
import mark from 'markdown-it-mark';
import ins from 'markdown-it-ins';
import sub from 'markdown-it-sub';
import sup from 'markdown-it-sup';
import {full as emoji} from 'markdown-it-emoji';
import hljs from 'highlight.js/lib/common';
import powershell from 'highlight.js/lib/languages/powershell';

hljs.registerLanguage('powershell', powershell);

export function install(md) {
 md.set({highlight:(code, language) => {
  if (!language || !hljs.getLanguage(language)) return '';
  return hljs.highlight(code, {language, ignoreIllegals:true}).value;
 }});
 md.use(tasks).use(footnote).use(deflist).use(abbr)
  .use(mark).use(ins).use(sub).use(sup).use(emoji, {shortcuts:{}})
  .use(anchor, {tabIndex:false})
  .use(toc, {
   markerPattern:/^(?:\$\{toc\}|\[toc\]|\[\[toc\]\])[ \t]*$/im,
   includeLevel:[1,2,3,4,5,6],
   listType:'ol'
  });
}
