(() => {
  // Apply preloaded stylesheets (web fonts) without blocking the first paint.
  if (typeof document.querySelectorAll === 'function') {
    document.querySelectorAll('link[data-deferred-style]').forEach(preload => {
      const stylesheet = document.createElement('link');
      stylesheet.rel = 'stylesheet';
      stylesheet.href = preload.href;
      document.head.appendChild(stylesheet);
    });
  }

  const showLoadError = () => {
    const status = document.getElementById('startup-status');
    if (!status) return; // React already replaced the loading state.
    status.textContent = 'No se pudo abrir la tienda. Revisa tu conexión y vuelve a cargar. Tu carrito no se borrará.';
    const retry = document.getElementById('startup-retry');
    if (retry) retry.hidden = false;
  };
  const retry = document.getElementById('startup-retry');
  retry?.addEventListener('click', () => window.location.reload());
  window.addEventListener('error', showLoadError, true);
  window.addEventListener('unhandledrejection', showLoadError);
  const timer = window.setTimeout(showLoadError, 20000);
  window.addEventListener('friozo:ready', () => {
    window.clearTimeout(timer);
    window.removeEventListener('error', showLoadError, true);
    window.removeEventListener('unhandledrejection', showLoadError);
  }, { once: true });
})();
