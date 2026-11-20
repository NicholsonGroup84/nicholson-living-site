/* In-app PDF viewer for NicoNet and NicoMGT.
   Every PDF opens in a full-screen panel with a Close (X) button, so nobody is ever stuck on a PDF.
   Same-origin .pdf links, blob: and data: PDFs, and window.open() of any of those are handled here. */
(function () {
  'use strict';
  if (window.__pdfx) return;
  var here = new URL('.', document.currentScript.src).href;
  var libP = null;
  var state = null;

  var css =
    '.pdfx{position:fixed;inset:0;z-index:2147483000;background:#050607;color:#eef2f2;display:flex;flex-direction:column;font-family:"Archivo",-apple-system,"Segoe UI",sans-serif}' +
    '.pdfx-bar{flex:0 0 auto;display:flex;align-items:center;gap:8px;padding:calc(8px + env(safe-area-inset-top,0px)) 10px 8px 14px;border-bottom:1px solid rgba(63,208,201,.25);background:#0b0f10}' +
    '.pdfx-title{flex:1 1 auto;min-width:0;font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.pdfx-btn{flex:0 0 auto;min-width:44px;height:44px;padding:0 12px;border-radius:999px;border:1px solid rgba(63,208,201,.45);background:transparent;color:#eef2f2;font:600 15px/1 inherit;cursor:pointer}' +
    '.pdfx-x{background:#3fd0c9;border-color:#3fd0c9;color:#032423;font-size:15px}' +
    '.pdfx-body{flex:1 1 auto;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px 0 calc(24px + env(safe-area-inset-bottom,0px));background:#050607}' +
    '.pdfx-page{margin:0 auto 10px;background:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.06)}' +
    '.pdfx-page canvas{display:block;width:100%;height:100%}' +
    '.pdfx-msg{padding:40px 20px;text-align:center;color:#8fa3a3;font-size:14px}' +
    '.pdfx-frame{display:block;width:100%;height:100%;border:0;background:#fff}' +
    '.pdfx-sheet{max-width:560px;margin:0 auto;padding:24px 18px}' +
    '.pdfx-sheet h2{font-family:"Fraunces",Georgia,serif;font-weight:600;font-size:24px;margin:0 0 8px}' +
    '.pdfx-sheet p{color:#8fa3a3;font-size:14px;margin:0 0 20px}' +
    '.pdfx-doc{display:block;width:100%;text-align:left;background:#0d1314;border:1px solid rgba(63,208,201,.16);border-radius:12px;padding:16px 18px;margin:0 0 12px;color:#eef2f2;font:inherit;cursor:pointer}' +
    '.pdfx-doc strong{display:block;font-weight:600;font-size:15px}.pdfx-doc span{color:#8fa3a3;font-size:13px}' +
    '.pdfx-note{color:#5d6f70;font-size:11px;margin-top:20px}';
  var st = document.createElement('style');
  st.textContent = css;
  document.head.appendChild(st);

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }

  function lib() {
    if (!libP) {
      libP = import(here + 'pdf.min.mjs').then(function (m) {
        m.GlobalWorkerOptions.workerSrc = here + 'pdf.worker.min.mjs';
        return m;
      });
    }
    return libP;
  }

  function shell(title) {
    close(true);
    var root = el('div', 'pdfx');
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    var bar = el('div', 'pdfx-bar');
    var t = el('div', 'pdfx-title', title || 'Document');
    var x = el('button', 'pdfx-btn pdfx-x', '✕ Close');
    x.type = 'button';
    x.setAttribute('aria-label', 'Close');
    x.addEventListener('click', function () { close(); });
    bar.appendChild(t);
    var body = el('div', 'pdfx-body');
    root.appendChild(bar);
    root.appendChild(body);
    document.body.appendChild(root);
    var prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    state = { root: root, bar: bar, body: body, x: x, prevOverflow: prev, pushed: false, cleanup: [] };
    try { history.pushState({ pdfx: 1 }, ''); state.pushed = true; } catch (e) { /* ignore */ }
    return state;
  }

  function close(silent) {
    var s = state;
    if (!s) return;
    state = null;
    s.cleanup.forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    s.root.remove();
    document.documentElement.style.overflow = s.prevOverflow;
    if (s.pushed && !silent && history.state && history.state.pdfx) { try { history.back(); } catch (e) { /* ignore */ } }
  }

  window.addEventListener('popstate', function () {
    if (state) { state.pushed = false; close(); }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && state) close(); });

  function fallback(s, url) {
    s.body.textContent = '';
    s.body.style.padding = '0';
    var f = el('iframe', 'pdfx-frame');
    f.src = url;
    s.body.appendChild(f);
  }

  function openPdf(url, title) {
    var s = shell(title);
    var zoom = 1;
    var zb = el('button', 'pdfx-btn', 'A+');
    zb.type = 'button';
    zb.setAttribute('aria-label', 'Zoom');
    s.bar.appendChild(zb);
    s.bar.appendChild(s.x);
    var msg = el('div', 'pdfx-msg', 'Opening…');
    s.body.appendChild(msg);

    lib().then(function (pdfjs) {
      return pdfjs.getDocument({ url: url }).promise.then(function (doc) {
        if (state !== s) { doc.destroy(); return; }
        s.cleanup.push(function () { doc.destroy(); });
        return doc.getPage(1).then(function (first) {
          if (state !== s) return;
          var vp1 = first.getViewport({ scale: 1 });
          var ratio = vp1.height / vp1.width;
          msg.remove();
          var pages = [];
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
              var p = pages[+en.target.dataset.i];
              if (en.isIntersecting) render(p); else release(p);
            });
          }, { root: s.body, rootMargin: '900px 0px' });
          s.cleanup.push(function () { io.disconnect(); });

          function width() { return Math.max(240, Math.min(s.body.clientWidth - 16, 900)) * zoom; }
          function layout() {
            var w = width();
            pages.forEach(function (p) { p.box.style.width = w + 'px'; p.box.style.height = Math.round(w * (p.ratio || ratio)) + 'px'; });
          }
          function render(p) {
            if (p.busy || p.w === width()) return;
            p.busy = true;
            var w = width();
            doc.getPage(p.n).then(function (page) {
              var base = page.getViewport({ scale: 1 });
              p.ratio = base.height / base.width;
              var dpr = Math.min(window.devicePixelRatio || 1, 2);
              var vp = page.getViewport({ scale: (w / base.width) * dpr });
              var c = document.createElement('canvas');
              c.width = Math.floor(vp.width);
              c.height = Math.floor(vp.height);
              return page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise.then(function () {
                if (state !== s) return;
                p.box.textContent = '';
                p.box.appendChild(c);
                p.box.style.height = Math.round(w * p.ratio) + 'px';
                p.w = w;
              });
            }).catch(function () { /* page failed; leave blank */ }).then(function () { p.busy = false; });
          }
          function release(p) {
            if (!p.w) return;
            var c = p.box.firstChild;
            if (c) { c.width = 0; c.height = 0; }
            p.box.textContent = '';
            p.w = 0;
          }

          for (var i = 1; i <= doc.numPages; i++) {
            var box = el('div', 'pdfx-page');
            box.dataset.i = String(i - 1);
            s.body.appendChild(box);
            pages.push({ n: i, box: box, w: 0, busy: false, ratio: 0 });
          }
          layout();
          pages.forEach(function (p) { io.observe(p.box); });

          function relayout() {
            pages.forEach(release);
            layout();
            pages.forEach(function (p) { io.unobserve(p.box); io.observe(p.box); });
          }
          zb.addEventListener('click', function () {
            zoom = zoom === 1 ? 1.75 : 1;
            zb.textContent = zoom === 1 ? 'A+' : 'A−';
            relayout();
          });
          var rt;
          function onResize() { clearTimeout(rt); rt = setTimeout(relayout, 200); }
          window.addEventListener('resize', onResize);
          s.cleanup.push(function () { window.removeEventListener('resize', onResize); });
        });
      });
    }).catch(function () {
      if (state === s) { zb.remove(); fallback(s, url); }
    });
  }

  function openTerms() {
    var s = shell('Terms of Employment');
    s.bar.appendChild(s.x);
    var sh = el('div', 'pdfx-sheet');
    sh.appendChild(el('h2', '', 'Terms of Employment'));
    sh.appendChild(el('p', '', 'The standard forms of contract for employees. Your own signed copies are issued to you individually.'));
    [
      ['Contract of Employment', 'Standard form. PDF, 18 pages.', 'docs/contract-of-employment.pdf?v=1'],
      ['Confidentiality Deed', 'Standard form, employee non-disclosure agreement. PDF, 8 pages.', 'docs/confidentiality-deed.pdf?v=1'],
    ].forEach(function (d) {
      var b = el('button', 'pdfx-doc');
      b.type = 'button';
      b.appendChild(el('strong', '', d[0]));
      b.appendChild(el('span', '', d[1]));
      b.addEventListener('click', function () { openPdf(new URL(d[2], new URL('..', here)).href, d[0]); });
      sh.appendChild(b);
    });
    sh.appendChild(el('div', 'pdfx-note', 'For employees only. Version 2.0, November 2026.'));
    s.body.appendChild(sh);
  }

  /** 'pdf' | 'terms' | null */
  function kind(raw) {
    if (!raw) return null;
    var u;
    try { u = new URL(String(raw), location.href); } catch (e) { return null; }
    if (u.protocol === 'blob:') return 'pdf';
    if (u.protocol === 'data:') return /^data:application\/pdf/i.test(u.href) ? 'pdf' : null;
    if (u.origin !== location.origin) return null;
    if (/\/docs\/terms-of-employment\.html$/i.test(u.pathname)) return 'terms';
    return /\.pdf$/i.test(u.pathname) ? 'pdf' : null;
  }

  function nameOf(raw) {
    try {
      var p = new URL(String(raw), location.href).pathname.split('/').pop() || '';
      p = decodeURIComponent(p).replace(/\.pdf$/i, '').replace(/[-_]+/g, ' ').trim();
      return p ? p.charAt(0).toUpperCase() + p.slice(1) : 'Document';
    } catch (e) { return 'Document'; }
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button > 0) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('download') || (state && state.root.contains(a))) return;
    var href = a.getAttribute('href');
    var k = kind(href);
    if (!k || (k === 'pdf' && /^blob:/i.test(href) && !/pdf/i.test(a.type || a.textContent || ''))) return;
    e.preventDefault();
    e.stopPropagation();
    if (k === 'terms') openTerms();
    else openPdf(a.href, (a.getAttribute('data-title') || a.textContent || '').trim().slice(0, 80) || nameOf(a.href));
  }, true);

  var nativeOpen = window.open;
  window.open = function (url) {
    var k = url ? kind(url) : null;
    if (k === 'terms') { openTerms(); return null; }
    if (k === 'pdf') { openPdf(new URL(String(url), location.href).href, nameOf(url) === 'Document' || /^blob:|^data:/i.test(String(url)) ? 'Document' : nameOf(url)); return null; }
    return nativeOpen.apply(window, arguments);
  };

  window.__pdfx = { open: openPdf, terms: openTerms, close: close };
})();
