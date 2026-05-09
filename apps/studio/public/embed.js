/**
 * Ivaronix receipt-verifier embed loader (planning-01 §3D).
 *
 * Drop on any HTML page:
 *   <script src="https://ivaronix.studio/embed.js" data-receipt-id="1004"></script>
 *
 * Auto-creates an iframe pointing at /embed/r/<id>. Sized to the card
 * (320×420 default) but obeys data-width / data-height overrides.
 *
 * For React projects: prefer the npm package
 *   import { ReceiptVerifier } from '@ivaronix/widget'
 *
 * Either path renders only on-chain-verifiable facts. No analytics,
 * no cookies, no client RPC.
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var receiptId = script.getAttribute('data-receipt-id');
  if (!receiptId) {
    console.warn('[ivaronix] embed.js requires data-receipt-id="<id>"');
    return;
  }
  var origin = (function () {
    try {
      return new URL(script.src).origin;
    } catch (_e) {
      return 'https://ivaronix.studio';
    }
  })();
  var width = script.getAttribute('data-width') || '100%';
  var height = script.getAttribute('data-height') || '420';

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/embed/r/' + encodeURIComponent(receiptId);
  iframe.style.border = '0';
  iframe.style.width = String(width).match(/^\d+$/) ? width + 'px' : width;
  iframe.style.height = String(height).match(/^\d+$/) ? height + 'px' : height;
  iframe.style.maxWidth = '600px';
  iframe.style.display = 'block';
  iframe.setAttribute('title', 'Ivaronix receipt #' + receiptId);
  iframe.setAttribute('loading', 'lazy');
  iframe.setAttribute('referrerpolicy', 'no-referrer');

  // Insert after the script tag so the iframe lands where the embed code
  // was placed.
  var parent = script.parentNode;
  if (parent) parent.insertBefore(iframe, script.nextSibling);
})();
