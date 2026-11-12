import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const delivery = path.join(root, 'Delivery');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const include = ['src', 'scripts', 'tests', 'index.html', 'package.json', 'package-lock.json', 'tsconfig.json', '.npmrc', 'Launch.cmd', 'Build.ps1'];
async function filesInside(relative) {
  try {
    const entries = await readdir(path.join(root, relative), { withFileTypes: true });
    const nested = await Promise.all(entries.map(entry => entry.isDirectory() ? filesInside(path.posix.join(relative, entry.name)) : [path.posix.join(relative, entry.name)]));
    return nested.flat();
  } catch (error) { if (error.code === 'ENOTDIR') return [relative]; throw error; }
}
await mkdir(delivery, { recursive: true });
await mkdir(path.join(root, 'ThirdPartyNotices'), { recursive: true });
const sourceFiles = (await Promise.all(include.map(filesInside))).flat().sort();
const manifest = [];
for (const relative of sourceFiles) {
  const content = await readFile(path.join(root, relative));
  manifest.push({ path: relative, bytes: content.length, sha256: hash(content) });
}
const sourceHash = hash(manifest.map(item => `${item.path}\0${item.sha256}\n`).join(''));
const buildHash = hash(await readFile(path.join(root, 'dist/index.html')));
const lock = JSON.parse(await readFile(path.join(root, 'package-lock.json'), 'utf8'));
const notices = [];
for (const [packagePath, metadata] of Object.entries(lock.packages)) {
  if (!packagePath.startsWith('node_modules/')) continue;
  const packageName = packagePath.slice('node_modules/'.length);
  let entries;
  try { entries = await readdir(path.join(root, packagePath)); } catch { continue; }
  const licenses = entries.filter(name => /^(license|licence|notice|third.?party.?notices?)(\.|$)/i.test(name));
  const folder = path.join(root, 'ThirdPartyNotices', packageName.replaceAll('/', '__'));
  await mkdir(folder, { recursive: true });
  for (const license of licenses) await cp(path.join(root, packagePath, license), path.join(folder, license), { recursive: true });
  notices.push({ package: packageName, version: metadata.version, license: metadata.license ?? 'see package license', files: licenses });
}
await writeFile(path.join(root, 'ThirdPartyNotices/index.json'), JSON.stringify(notices, null, 2));
await writeFile(path.join(root, 'Validation/source-manifest.json'), JSON.stringify({ algorithm: 'SHA-256', sourceHash, buildHash, definition: '源码哈希为按路径排序的 path + NUL + file SHA256 + LF 串的SHA256；范围仅包含列出的源码、测试、工具脚本和构建配置，排除报告、来源摘要、依赖与归档，避免自引用。', files: manifest }, null, 2));
const production = JSON.parse(await readFile(path.join(root, 'Provenance/production-start.json'), 'utf8'));
production.sourceHash = sourceHash;
production.buildHash = buildHash;
production.correspondingSourceManifest = 'Validation/source-manifest.json';
await writeFile(path.join(root, 'Provenance/production-start.json'), JSON.stringify(production, null, 2));
const batch = { projectId: 'FR-0003', source: 'new_production', technology: ['Web', 'TypeScript', 'Canvas 2D', 'Web Audio'], form: '完整12关离线短篇游戏', model: 'gpt-6-astra', procurementFamily: '6astra', preciseBuildVersion: null, rollout: '当前Codex会话01a1bfb2-7f05-73f3-8629-ad06ed3e7f03；Provenance/production-start.json', sourceHash, buildHash, subprojectPath: '0003-web-夜市找零', validation: '自动验证详见Validation/verification-report.md；用户试玩待测', humanCodeModifications: '无；用户提供规则调整方向', duplicateCluster: 'FR-0003；跨批次总表不可得，待核验', procurementAcceptance: '待来源具体版本及权利核验', rights: 'RIGHTS.md' };
await writeFile(path.join(delivery, 'manifest.jsonl'), JSON.stringify(batch) + '\n');
await writeFile(path.join(delivery, 'content-hashes.txt'), `source-content SHA-256 ${sourceHash}\ndist/index.html SHA-256 ${buildHash}\n`);
execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts/archive.ps1')], { cwd: root, stdio: 'inherit', windowsHide: true });
const archiveHashes = [];
for (const filename of ['FR-0003-Source.zip', 'FR-0003-Offline.zip']) archiveHashes.push(`${hash(await readFile(path.join(delivery, filename)))}  ${filename}`);
await writeFile(path.join(delivery, 'SHA256SUMS.txt'), archiveHashes.join('\n') + '\n');
console.log(JSON.stringify({ sourceHash, buildHash, sourceFiles: manifest.length, archives: archiveHashes }, null, 2));
