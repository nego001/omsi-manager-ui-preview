// M60: pure built-HTML CSP injection. No host/network/OS operations.
// React's intentional inline style attributes require unsafe-inline *style*
// but never unsafe-inline/unsafe-eval *script*.
export const PACKAGED_CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://shared.fastly.steamstatic.com",
  "font-src 'self' data:",
  "connect-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "base-uri 'none'",
  "form-action 'none'"
].join('; ');

const CSP_META = '<meta http-equiv="Content-Security-Policy" content="' + PACKAGED_CSP + '">';
export function injectPackagedCSP(html) {
  if (typeof html !== 'string' ||
      html.split('<head>').length !== 2 ||
      /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html)) {
    throw new Error('PACKAGED_CSP_BUILD_REFUSED');
  }
  // Make CSP the first item within head, before the built script and CSS tags.
  return html.replace('<head>', '<head>' + CSP_META);
}
export { CSP_META };
