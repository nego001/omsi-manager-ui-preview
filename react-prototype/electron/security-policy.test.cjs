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

test('entry navigation refuses URL-embedded credentials even with matching host, port and path', () => {
  const credentialUrls = [
    'http://user@127.0.0.1:4173/',
    'http://user:password@127.0.0.1:4173/',
    'http://:password@127.0.0.1:4173/',
    'http://%61dmin:se%63ret@127.0.0.1:4173/',
    'http://user:password@127.0.0.1:4173/#games'
  ];
  for (const value of credentialUrls)
    assert.equal(isAllowedTopLevelURL(value, DEV_URL), false, value);
  assert.equal(isAllowedTopLevelURL('http://127.0.0.1:4173/#games', DEV_URL), true);
});
test('a credential-bearing approval parameter cannot turn an authentication URL into a trusted entry', () => {
  const credentialEntry = 'http://admin:password@127.0.0.1:4173/';
  assert.equal(isAllowedTopLevelURL(credentialEntry, credentialEntry), false);
  assert.equal(isAllowedTopLevelURL(DEV_URL, credentialEntry), false);
});
test('bundled file document retains same-file hash navigation and rejects separate documents', () => {
  const entry = 'file:///tmp/omsi-manager/dist/index.html';
  assert.equal(isAllowedTopLevelURL(entry+'#games',entry),true);
  assert.equal(isAllowedTopLevelURL('file:///tmp/omsi-manager/dist/index.html?auth=test',entry),false);
  assert.equal(isAllowedTopLevelURL('file:///tmp/omsi-manager/dist/other.html',entry),false);
});
