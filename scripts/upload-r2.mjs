import { readdir, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { join, relative, sep } from 'node:path';

const bucket = process.argv[2] ?? 'flyon360-assets';
const root = new URL('../public/assets/', import.meta.url).pathname;
const concurrency = 3;
const startAt = Math.max(0, Number(process.env.R2_START_AT ?? 1) - 1);

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter(entry => entry.name !== '.DS_Store')
    .map(entry => entry.isDirectory()
      ? filesUnder(join(directory, entry.name))
      : Promise.resolve([join(directory, entry.name)])));
  return nested.flat();
}

function contentType(path) {
  const extension = path.split('.').pop()?.toLowerCase();
  return ({
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', svg: 'image/svg+xml',
    webp: 'image/webp', mp3: 'audio/mpeg', mp4: 'video/mp4', json: 'application/json',
    ttf: 'font/ttf', woff: 'font/woff', woff2: 'font/woff2',
  })[extension] ?? 'application/octet-stream';
}

function uploadOnce(file, index, total) {
  const sourceKey = relative(root, file).split(sep).join('/');
  const key = sourceKey.replace(/\.\.(?=[^/]*$)/g, '.');
  return new Promise((resolve, reject) => {
    console.log(`[${index}/${total}] ${key}`);
    const command = spawn('npx', [
      'wrangler', 'r2', 'object', 'put', `${bucket}/${key}`,
      '--file', file, '--content-type', contentType(file), '--remote',
    ], { stdio: 'inherit' });
    command.on('error', reject);
    command.on('exit', code => code === 0 ? resolve() : reject(new Error(`Upload failed (${code}): ${key}`)));
  });
}

async function upload(file, index, total) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await uploadOnce(file, index, total);
      return;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Retry ${attempt}/2 for file ${index} after a transient error.`);
      await new Promise(resolve => setTimeout(resolve, attempt * 2000));
    }
  }
}

const files = await filesUnder(root);
const totalBytes = (await Promise.all(files.map(file => stat(file)))).reduce((sum, item) => sum + item.size, 0);
console.log(`Uploading ${files.length} files (${(totalBytes / 1024 ** 3).toFixed(2)} GiB) to ${bucket}`);

let cursor = startAt;
await Promise.all(Array.from({ length: concurrency }, async () => {
  while (cursor < files.length) {
    const index = cursor++;
    await upload(files[index], index + 1, files.length);
  }
}));
console.log('R2 upload complete.');
