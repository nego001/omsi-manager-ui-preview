import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';

let application;
try {
  application = await electron.launch({
    args: ['.'],
    cwd: process.cwd(),
    env: {...process.env, OMSI_MANAGER_DEV_PREVIEW: '0'},
    timeout: 60000
  });
  const window = await application.firstWindow();
  await window.getByRole('heading',{name:'Seu universo de simulação, organizado.'}).waitFor({timeout:20000});
  const capabilities = await window.evaluate(() => ({
    nodeRequire: typeof window.require,
    nodeProcess: typeof window.process,
    preview: window.omsiPreview
  }));
  assert.equal(capabilities.nodeRequire, 'undefined');
  assert.equal(capabilities.nodeProcess, 'undefined');
  assert.equal(capabilities.preview?.mode, 'read-only');
  assert.equal(capabilities.preview?.capabilities?.installMods, false);
  assert.equal(capabilities.preview?.capabilities?.uninstallMods, false);
  assert.equal(capabilities.preview?.capabilities?.executeCommands, false);
  await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Detalhes'}).click();
  assert.equal(await window.getByRole('button',{name:'Instalar (bloqueado)'}).isDisabled(),true);
  assert.equal(await window.getByRole('button',{name:'Remover (bloqueado)'}).isDisabled(),true);
  await window.getByRole('navigation',{name:'Navegação principal'}).getByRole('button',{name:'Segurança'}).click();
  assert.equal(await window.getByRole('heading',{name:'Central de segurança'}).isVisible(),true);
  console.log('Electron desktop smoke: OK. Renderer isolado e operações bloqueadas.');
} finally {
  await application?.close();
}
