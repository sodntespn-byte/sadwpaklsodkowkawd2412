/**
 * Fallback para imagens da logo quando /assets/logo.png falha.
 * Usado via addEventListener para respeitar CSP (sem script-src-attr).
 */
(function () {
  var fallbackSvg =
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88"><rect width="88" height="88" fill="%23FFD700"/><text x="44" y="52" font-family="Arial" font-size="24" font-weight="bold" fill="%231a1a1a" text-anchor="middle">L</text></svg>'
    );
  function onLogoError() {
    this.onerror = null;
    this.src = fallbackSvg;
  }
  function setup() {
    document.querySelectorAll('img[data-logo-fallback]').forEach(function (img) {
      img.removeEventListener('error', onLogoError);
      img.addEventListener('error', onLogoError);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();
