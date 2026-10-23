import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const root = process.cwd();
const vite = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1', '--port', '4173', '--strictPort'], { stdio: 'inherit' });
let electron;
let quitting = false;
const stop = () => {
  if (quitting) return;
  quitting = true;
  vite.kill();
  electron?.kill();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
try {
  let started = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (vite.exitCode !== null) throw new Error('Vite encerrou antes de iniciar o desktop.');
    try {
      const response = await fetch('http://127.0.0.1:4173/');
      if (response.ok) { started = true; break; }
    } catch { /* server not yet listening */ }
    await delay(250);
  }
  if (!started) throw new Error('Vite não respondeu na porta 4173.');
  electron = spawn(process.execPath, [join(root, 'node_modules', 'electron', 'cli.js'), '.'], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, OMSI_MANAGER_DEV_PREVIEW: '1' }
  });
  const result = await new Promise(resolve => electron.on('exit', (code) => resolve(code ?? 1)));
  stop();
  process.exitCode = result;
} catch (error) {
  console.error(error);
  stop();
  process.exitCode = 1;
}
