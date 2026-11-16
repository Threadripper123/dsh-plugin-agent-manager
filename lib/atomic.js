import { writeFile, rename, unlink } from 'node:fs/promises';

export async function writeAtomic(file, text) {
  const tmp = `${file}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
  await writeFile(tmp, text, 'utf8');
  try {
    await rename(tmp, file);
  } catch (err) {
    if (err && (err.code === 'EEXIST' || err.code === 'EPERM' || err.code === 'EACCES')) {
      await unlink(file).catch(() => {});
      await rename(tmp, file);
    } else {
      await unlink(tmp).catch(() => {});
      throw err;
    }
  }
}
