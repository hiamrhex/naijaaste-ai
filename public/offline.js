// Offline page behaviour — kept in an external file so the strict
// Content-Security-Policy (script-src 'self') can stay free of 'unsafe-inline'.
(function () {
  var link = document.getElementById('retry');
  if (!link) return;

  link.addEventListener('click', function (e) {
    e.preventDefault();
    // The service worker serves this page only after a genuine network
    // failure, so a plain navigation is the correct retry. The cache-busting
    // query keeps an HTTP-cached failure out of the way, and replace() drops
    // the offline page from history so Back never re-enters it.
    var bust = Date.now();
    window.location.replace('/app?retry=' + bust);
  });
})();
