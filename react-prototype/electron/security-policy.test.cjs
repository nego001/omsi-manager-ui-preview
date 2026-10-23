'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SECURE_WEB_PREFERENCES: prefs, DEV_URL, isAllowedTopLevelURL } = require('./security-policy.cjs');

test('renderer remains isolated with Node and webviews disabled', () => {
  assert.equal(prefs.contextIsolation, true);
  assert.equal(prefs.sandbox, true);
  assert.equal(prefs.nodeIntegration, false);
  assert.equal(prefs.webviewTag, false);
  assert.equal(prefs.webSecurity, true);
  assert.equal(prefs.allowRunningInsecureContent, false);
  assert.equal(Object.isFrozen(prefs), true);
});
test('development navigation is restricted to the same entry document', () => {
  assert.equal(isAllowedTopLevelURL('http://127.0.0.1:4173/#games', DEV_URL), true);
  for (const value of [
    'https://example.com/', 'http://localhost:4173/', 'http://127.0.0.1:4174/',
    'http://127.0.0.1:4173/admin', 'file:///C:/Users/Public/document.html',
    'javascript:alert(1)', 'data:text/html,hello', 'broken'
  ]) assert.equal(isAllowedTopLevelURL(value, DEV_URL), false, value);
});
test('production navigation cannot switch to a different file', () => {
  const entry = 'file:///C:/OMSI%20Manager/dist/index.html';
  assert.equal(isAllowedTopLevelURL(entry+'#details', entry), true);
  assert.equal(isAllowedTopLevelURL('file:///C:/OMSI%20Manager/dist/other.html', entry), false);
  assert.equal(isAllowedTopLevelURL('https://example.com', entry), false);
});
