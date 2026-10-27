import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const errors = [];
const requireFile = (name, source) => {
  const file = name.split(/[?#]/)[0];
  if (!file || /^(https?:|mailto:|data:)/.test(file)) return;
  const full = path.resolve(root, file.replace(/^\//, ''));
  if (!full.startsWith(root + path.sep) || !fs.existsSync(full)) errors.push(`${source}: missing file ${file}`);
};
for (const [, name] of html.matchAll(/(?:src|href)="([^"]+)"/g)) requireFile(name, 'index.html');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/data/content.js'), 'utf8'), context);
const content = context.window.GGHF_CONTENT;
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
if (ids.length !== new Set(ids).size) errors.push('Duplicate HTML IDs');
const anchors = new Set([...ids, ...content.projects.map(p => `project-${p.id}`)]);
for (const [, anchor] of html.matchAll(/href="#([^"]+)"/g)) if (!anchors.has(anchor)) errors.push(`Broken anchor #${anchor}`);
for (const project of content.projects) {
  for (const key of ['title', 'status', 'description', 'image', 'imageAlt', 'url', 'action']) if (!project[key]) errors.push(`${project.id}: missing ${key}`);
  requireFile(project.image, project.id);
  if (project.url.startsWith('#') && !anchors.has(project.url.slice(1))) errors.push(`${project.id}: broken anchor ${project.url}`);
}
const shareImage = html.match(/property="og:image" content="([^"]+)"/)?.[1];
if (!shareImage) errors.push('Missing Open Graph image');
else requireFile(new URL(shareImage).pathname, 'og:image');
if (!html.includes('width=device-width, initial-scale=1') || /user-scalable=no|maximum-scale=1/.test(html)) errors.push('Page zoom must be allowed');
if (!html.includes('<h1') || !html.includes('name="description"') || !html.includes('rel="canonical"')) errors.push('Missing page identity metadata');
if (html.includes('https://js.puter.com/v2/')) errors.push('AI SDK must load on request, not on the homepage');
for (const filename of fs.readdirSync(path.join(root, 'assets/js'))) {
  const source = fs.readFileSync(path.join(root, 'assets/js', filename), 'utf8');
  if (source.includes('data/quests.json')) errors.push(`${filename}: obsolete roadmap request`);
  if (source.includes('https://emptypizza.github.io/vibecoders/')) errors.push(`${filename}: obsolete study target`);
}
requireFile('vibecoders/index.html', 'legacy study link');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Site check passed: ${ids.length} unique IDs, ${content.projects.length} projects, local assets and anchors, zoom and sharing metadata.`);
