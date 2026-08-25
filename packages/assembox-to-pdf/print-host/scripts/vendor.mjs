/**
 * vendor 资产本地化：
 * - CDN 部分：从编辑器画布使用的同一清单下载 UMD/IIFE 包到 public/vendor/
 * - npm 部分：@antv/g2plot 从 node_modules 复制 dist（离线安全，版本随 lockfile）
 * 导出服务渲染集群不依赖外部 CDN（离线可渲染）；清单变更时重跑 `pnpm vendor`。
 */
import { mkdirSync, writeFileSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const CDN = 'https://cdn.yearrow.com/files';

const JS = [
  ['element-plus.js', `${CDN}/element-plus/2.13.7/index.full.min.js`],
  ['icons-vue.js', `${CDN}/@element-plus/icons-vue/2.3.1/global.iife.min.js`],
  ['vue-router.js', `${CDN}/vue-router/4.2.5/vue-router.global.prod.js`],
  ['axios.js', `${CDN}/axios/1.7.0/axios.min.js`],
  ['element-plus-ui.js', `${CDN}/@cs/element-plus-ui/1.1.0/element-plus-ui.iife.js`],
  ['table-pro.js', `${CDN}/@cs/table-pro/1.0.13/table-pro.iife.js`],
  ['js-web-framework.js', `${CDN}/@cs/js-web-framework/1.2.0/js-web-framework.umd.js`],
  ['vue3-biz-components-library.js', `${CDN}/@cs/vue3-biz-components-library/test-2026-8-18/vue3-biz-components-library.umd.js`],
];

const CSS = [
  ['element-plus-ui-yun-que.css', `${CDN}/@cs/element-plus-ui/1.0.8/theme/yun-que.css`],
  ['table-pro.css', `${CDN}/@cs/table-pro/1.0.13/theme/index.css`],
];

/** 从 node_modules 复制的 npm 包（[目标文件, 包内相对路径, 包名]） */
const NPM = [
  ['g2plot.js', 'dist/g2plot.min.js', '@antv/g2plot'],
];

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', 'public', 'vendor');
mkdirSync(root, { recursive: true });

function resolveFrom(from, sub) {
  // 向上逐级找 node_modules/<pkg>/<sub>
  let dir = from;
  for (let i = 0; i < 6; i++) {
    const candidate = join(dir, 'node_modules', sub);
    if (existsSync(candidate)) return candidate;
    dir = join(dir, '..');
  }
  throw new Error(`未找到 ${sub}（请先 pnpm install）`);
}

async function fetchOne(file, url) {
  const dest = join(root, file);
  if (existsSync(dest) && statSync(dest).size > 1024) {
    console.log(`skip (cached) ${file}`);
    return;
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  console.log(`ok ${file} (${(buf.length / 1024).toFixed(0)} KB)`);
}

for (const [file, url] of [...JS, ...CSS]) {
  await fetchOne(file, url);
}
for (const [file, sub, pkg] of NPM) {
  const src = resolveFrom(here, join(pkg, sub));
  copyFileSync(src, join(root, file));
  console.log(`copied ${file} <- ${pkg}/${sub}`);
}
console.log('vendor assets ready at', root);
