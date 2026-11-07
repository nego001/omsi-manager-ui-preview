'use strict';
const { URL } = require('node:url');

const SECURE_WEB_PREFERENCES = Object.freeze({
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  webviewTag: false,
  webSecurity: true,
  allowRunningInsecureContent: false
});
const DEV_URL = 'http://127.0.0.1:4173/';

function isAllowedTopLevelURL(candidate, approvedEntryURL) {
  try {
    const target = new URL(candidate);
    const approved = new URL(approvedEntryURL);
    return target.protocol === approved.protocol &&
      target.hostname === approved.hostname &&
      target.port === approved.port &&
      target.pathname === approved.pathname &&
      target.search === approved.search &&
      // File URLs must never load a different local document.
      (target.protocol === 'file:' || target.protocol === 'http:');
  } catch {
    return false;
  }
}

module.exports = { SECURE_WEB_PREFERENCES, DEV_URL, isAllowedTopLevelURL };
