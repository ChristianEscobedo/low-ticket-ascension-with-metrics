/* Generate a static HTML preview of one seed article with the real stylesheet,
 * so we can eyeball the layout without running the app. */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

require.extensions['.ts'] = function (m, f) {
  const s = fs.readFileSync(f, 'utf8');
  const j = ts.transpileModule(s, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2019 },
    fileName: f,
  }).outputText;
  m._compile(j, f);
};

const { HELP_CENTER_SEED_ARTICLES } = require(path.join(
  process.cwd(),
  'src/lib/mothermode/help/seedContent.ts',
));
const { ARTICLE_BODY_STYLES } = require(path.join(
  process.cwd(),
  'src/lib/mothermode/help/articleStyles.ts',
));

const slug = process.argv[2] || 'content-generate-drawer';
const a = HELP_CENTER_SEED_ARTICLES.find((x) => x.slug === slug);
if (!a) {
  console.error('no article with slug', slug);
  process.exit(1);
}

const html =
  '<!doctype html><html><head><meta charset="utf-8" />' +
  '<style>body{background:#F5F1EB;color:#1A1816;font-family:ui-sans-serif,system-ui,sans-serif;' +
  'padding:32px;max-width:760px;margin:0 auto;}' +
  ARTICLE_BODY_STYLES +
  '</style></head><body>' +
  '<p style="text-transform:uppercase;letter-spacing:.2em;font-size:11px;color:#A88B5C;">' +
  a.category +
  '</p><h1 style="font-size:32px;font-weight:700;margin:4px 0 8px;">' +
  a.title +
  '</h1><div class="prose">' +
  a.body +
  '</div></body></html>';

fs.writeFileSync(path.join(process.cwd(), 'preview-article.html'), html);
console.log('wrote preview-article.html for slug:', slug);
