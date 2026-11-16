import { mkdir, writeFile, readFile, readdir, rename, cp, rm, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { agentRoot, skillsRoot, trashRoot } from './paths.js';

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

async function movePath(src, dst) {
  try {
    await rename(src, dst);
  } catch (err) {
    if (!err || (err.code !== 'EXDEV' && err.code !== 'EPERM' && err.code !== 'EACCES')) throw err;
    await cp(src, dst, { recursive: true, force: true, errorOnExist: false });
    await rm(src, { recursive: true, force: true });
  }
}

async function exists(path) {
  try {
    return await stat(path);
  } catch (err) {
    if (err && err.code === 'ENOENT') return null;
    throw err;
  }
}

export async function createTrashEntry({ kind, id, items }) {
  const trashId = `${stamp()}-${randomSuffix()}`;
  const dir = join(trashRoot(), trashId);
  const filesDir = join(dir, 'files');
  await mkdir(filesDir, { recursive: true });

  const moved = [];
  for (const item of items) {
    const src = item.src;
    const st = await exists(src);
    if (!st) continue;
    const name = basename(item.name || src);
    const dst = join(filesDir, name);
    await movePath(src, dst);
    moved.push({ root: item.root, name, original: item.original || src, kind: st.isDirectory() ? 'dir' : 'file' });
  }

  const manifest = {
    schema: 1,
    trashId,
    kind,
    id,
    createdAt: new Date().toISOString(),
    items: moved
  };
  await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return manifest;
}

export async function readTrashManifest(trashId) {
  if (typeof trashId !== 'string' || !/^[A-Za-z0-9_-]{6,80}$/.test(trashId)) {
    const err = new Error('非法的回收站 ID');
    err.statusCode = 400;
    err.code = 'invalid_trash_id';
    throw err;
  }
  const dir = join(trashRoot(), trashId);
  const manifest = JSON.parse(await readFile(join(dir, 'manifest.json'), 'utf8'));
  return { dir, manifest };
}

export async function listTrash() {
  let dirs = [];
  try {
    dirs = (await readdir(trashRoot(), { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
  const out = [];
  for (const trashId of dirs) {
    try {
      const { manifest, dir } = await readTrashManifest(trashId);
      let bytes = 0;
      for (const item of manifest.items || []) {
        const st = await exists(join(dir, 'files', item.name));
        if (st) bytes += st.size || 0;
      }
      out.push({ ...manifest, bytes });
    } catch {
      // ignore broken entries
    }
  }
  return out;
}

function freeName(name, taken) {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 1; i < 1000; i += 1) {
    const candidate = `${base}-restored-${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error(`无法为 ${name} 找到可用的恢复名`);
}

export async function restoreTrash(trashId) {
  const { dir, manifest } = await readTrashManifest(trashId);
  const restored = [];
  for (const item of manifest.items || []) {
    const root = item.root === 'skills' ? skillsRoot() : agentRoot();
    await mkdir(root, { recursive: true });
    let taken = new Set();
    try {
      taken = new Set(await readdir(root));
    } catch {
      taken = new Set();
    }
    const targetName = freeName(item.name, taken);
    const src = join(dir, 'files', item.name);
    const dst = join(root, targetName);
    await movePath(src, dst);
    restored.push({ root: item.root, name: targetName, path: dst });
  }
  await rm(dir, { recursive: true, force: true });
  return { trashId, restored };
}

export async function purgeTrash(trashId) {
  const { dir, manifest } = await readTrashManifest(trashId);
  await rm(dir, { recursive: true, force: true });
  return { trashId, purged: manifest.items?.length || 0 };
}
