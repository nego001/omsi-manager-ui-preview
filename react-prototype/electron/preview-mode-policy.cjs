'use strict';
// M53: development server is allowed only for an unpackaged Electron app.
// This is a main-JavaScript guard, NOT a substitute for sandbox verification.
const DEV_MODE_DENIED='OMSI_MANAGER_PACKAGED_DEV_MODE_REFUSED';
function resolvePreviewMode(isPackaged, envValue) {
  if (typeof isPackaged !== 'boolean' ||
      (envValue !== undefined && envValue !== '0' && envValue !== '1') ||
      (isPackaged && envValue === '1')) {
    throw new Error(DEV_MODE_DENIED);
  }
  return !isPackaged && envValue === '1';
}
module.exports={DEV_MODE_DENIED,resolvePreviewMode};
