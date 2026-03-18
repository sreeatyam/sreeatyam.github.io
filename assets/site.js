function updateBlur() {
  const doc = document.documentElement;
  if (document.body.classList.contains('home')) {
    document.body.style.setProperty('--blur-top', '0');
    document.body.style.setProperty('--blur-bottom', '0');
    return;
  }
  const disableScrollBlur = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
  if (disableScrollBlur) {
    document.body.style.setProperty('--blur-top', '0');
    document.body.style.setProperty('--blur-bottom', '0');
    return;
  }
  const isScrollable = doc.scrollHeight > window.innerHeight + 16;
  const maxScroll = doc.scrollHeight - window.innerHeight;
  const progress = isScrollable && maxScroll > 0 ? window.scrollY / maxScroll : 0;

  document.body.style.setProperty(
    '--blur-top',
    isScrollable ? Math.min(progress * 2, 1).toFixed(3) : '0'
  );
  document.body.style.setProperty(
    '--blur-bottom',
    isScrollable ? Math.min((1 - progress) * 2, 1).toFixed(3) : '0'
  );
}

function ensureLiquidCanvas() {
  let canvas = document.getElementById('liquid-canvas');
  if (canvas) {
    return canvas;
  }

  canvas = document.createElement('canvas');
  canvas.id = 'liquid-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  return canvas;
}

function setupLiquidMouseRestrictions() {
  const canvas = document.getElementById('liquid-canvas');
  if (!canvas) return;

  const originalDispatch = canvas.dispatchEvent.bind(canvas);

  function isInProtectedZone(clientX, clientY) {
    const nav  = document.querySelector('.nav');
    const main = document.querySelector('.main, .home-container');

    const inNav = !!(nav && (() => {
      const r = nav.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right
          && clientY >= r.top  && clientY <= r.bottom;
    })());

    const inMain = !!(main && (() => {
      const r = main.getBoundingClientRect();
      return clientX >= r.left && clientX <= r.right
          && clientY >= r.top  && clientY <= r.bottom;
    })());

    return inNav || inMain;
  }

  window.addEventListener('mousemove', (e) => {
    const blocked = isInProtectedZone(e.clientX, e.clientY);
    const coords = {
      clientX: blocked ? -999 : e.clientX,
      clientY: blocked ? -999 : e.clientY,
      bubbles: false,
      cancelable: false
    };

    originalDispatch(new MouseEvent('mousemove', coords));

    if (!blocked) {
      originalDispatch(new PointerEvent('pointerdown', {
        ...coords,
        pressure: 0.15
      }));
      originalDispatch(new PointerEvent('pointerup', {
        ...coords,
        pressure: 0
      }));
    }
  }, { passive: true });
}

async function initLiquidBackground() {
  const canvas = ensureLiquidCanvas();

  try {
    const module = await import(
      'https://cdn.jsdelivr.net/npm/threejs-components@0.0.22/build/backgrounds/liquid1.min.js'
    );
    const LiquidBackground = module.default;
    if (!LiquidBackground) {
      return;
    }

    const app = LiquidBackground(canvas);
    if (app.renderer) {
      app.renderer.setClearColor(0x000000, 1);
      app.renderer.setPixelRatio(window.devicePixelRatio);
    }
    if (app.scene) {
      app.scene.background = null;
    }
    function getViewportSize() {
      const vv = window.visualViewport;
      return {
        width: Math.round(vv ? vv.width : document.documentElement.clientWidth),
        height: Math.round(vv ? vv.height : document.documentElement.clientHeight),
      };
    }

    const initialSize = getViewportSize();
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.width = initialSize.width;
    canvas.height = initialSize.height;
    if (app.resize)   app.resize();
    if (app.onResize) app.onResize();
    if (app.setSize)  app.setSize(initialSize.width, initialSize.height);

    let lastW = initialSize.width;
    let lastH = initialSize.height;

    function applyLiquidResize() {
      const { width, height } = getViewportSize();
      if (width === lastW && height === lastH) return;
      lastW = width;
      lastH = height;
      canvas.width = width;
      canvas.height = height;
      if (app.resize)   app.resize();
      if (app.onResize) app.onResize();
      if (app.setSize)  app.setSize(width, height);
    }

    window.__triggerLiquidResize = applyLiquidResize;
    window.addEventListener('resize', applyLiquidResize, { passive: true });

    canvas.style.pointerEvents = 'none';
    canvas.style.border  = 'none';
    canvas.style.outline = 'none';
    canvas.addEventListener('click',     (e) => e.stopPropagation(), true);
    canvas.addEventListener('mousedown', (e) => e.stopPropagation(), true);

    app.liquidPlane.material.metalness = 0.75;
    app.liquidPlane.material.roughness = 0.25;
    app.liquidPlane.uniforms.displacementScale.value = 10;
    app.setRain(false);
    window.__liquidApp = app;

    setupLiquidMouseRestrictions();
  } catch (err) {
    console.warn('Liquid background failed to initialize.', err);
  }
}

window.addEventListener('scroll', updateBlur, { passive: true });
window.addEventListener('resize', updateBlur, { passive: true });
window.addEventListener('load', updateBlur);
updateBlur();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiquidBackground, { once: true });
} else {
  initLiquidBackground();
}

function initWidgets() {
  const PROXIMITY = 25;
  const isMobileWidgetsOff = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
  if (isMobileWidgetsOff) return;
  const isHome = document.body.classList.contains('home');

  // Mark active nav link
  const currentPath = window.location.pathname;
  document.querySelectorAll('.widget-nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href && currentPath.endsWith(href.replace(/^\//, ''))) {
      a.classList.add('active');
    }
  });

  // Individual widget proximity detection — desktop
  const pods = document.querySelectorAll('.widget-pod');

  document.addEventListener('mousemove', (e) => {
    pods.forEach(pod => {
      if (pod.style.display === 'none') return;
      const haze = pod.querySelector('.widget-haze');
      if (!haze) return;
      const r = haze.getBoundingClientRect();
      const dx = Math.max(r.left - e.clientX, 0, e.clientX - r.right);
      const dy = Math.max(r.top  - e.clientY, 0, e.clientY - r.bottom);
      const dist = Math.sqrt(dx * dx + dy * dy);
      pod.classList.toggle('is-revealed', dist < PROXIMITY);
    });
  });

  // Mobile tap toggle — per widget
  pods.forEach(pod => {
    const haze = pod.querySelector('.widget-haze');
    if (!haze) return;
    haze.addEventListener('click', (e) => {
      const isRevealed = pod.classList.contains('is-revealed');
      pods.forEach(p => p.classList.remove('is-revealed'));
      if (!isRevealed) pod.classList.add('is-revealed');
      e.stopPropagation();
    });
  });
  document.addEventListener('click', () => {
    pods.forEach(p => p.classList.remove('is-revealed'));
  });

  // Load data/widgets.json
  fetch('/data/widgets.json')
    .then(r => r.json())
    .then(data => {
      const updatesEl = document.getElementById('updates-text');
      if (updatesEl && data.updates) {
        updatesEl.textContent = data.updates;
      }

      const readingEl = document.getElementById('reading-text');
      if (readingEl && data.reading) {
        readingEl.innerHTML =
          `<span style="font-weight:600">${data.reading.title}</span>` +
          `<br><span style="color:var(--muted);font-style:italic">` +
          `${data.reading.author}</span>`;
      }

      const progressEl = document.getElementById('reading-progress');
      if (progressEl && data.reading?.progress != null) {
        progressEl.style.width = (data.reading.progress * 100) + '%';
      }
    })
    .catch(() => {});

  // GitHub contribution grid
  fetch('https://github-contributions-api.jogruber.de/v4/sreeatyam?y=last')
    .then(r => r.json())
    .then(data => {
      const grid = document.getElementById('github-grid');
      if (!grid || !data.contributions) return;
      const recent = data.contributions.slice(-91);
      grid.innerHTML = recent.map(day =>
        `<div class="github-cell" data-level="${day.level}"
          title="${day.date}: ${day.count} commits"></div>`
      ).join('');
    })
    .catch(() => {});

  // Ensure nav visibility matches current page on load
  const nav = document.querySelector('.nav');
  if (nav) {
    const onHome = document.body.classList.contains('home');
    nav.style.opacity = onHome ? '0' : '1';
    nav.style.pointerEvents = onHome ? 'none' : 'auto';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initWidgets, { once: true });
} else {
  initWidgets();
}

function initPjax() {
  const isMobilePjaxOff = window.matchMedia('(max-width: 1024px), (pointer: coarse)').matches;
  if (isMobilePjaxOff) return;

  // Fade duration in ms — match this to the CSS transition below
  const FADE_MS = 300;
  let isNavigating = false;

  function getMainContent(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return {
      main:      doc.querySelector('.content-blur-wrap'),
      title:     doc.title,
      bodyClass: doc.body.className,
      doc:       doc,
    };
  }

  async function navigateTo(href) {
    if (isNavigating) return;
    isNavigating = true;

    let wrap = null;
    let existingNav = null;

    try {
      wrap = document.querySelector('.content-blur-wrap');
      if (!wrap) {
        window.location.href = href;
        return;
      }

      existingNav = document.querySelector('.nav');

      // Fade out content and nav together
      wrap.style.transition = `opacity ${FADE_MS}ms ease`;
      wrap.style.opacity = '0';

      if (existingNav) {
        existingNav.style.transition = `opacity ${FADE_MS}ms ease`;
        existingNav.style.opacity = '0';
      }

      const res  = await fetch(href);
      const html = await res.text();
      const { main, title, bodyClass, doc } = getMainContent(html);

      await new Promise(r => setTimeout(r, FADE_MS));

      if (!main) {
        wrap.style.opacity = '1';
        if (existingNav) existingNav.style.opacity = '1';
        window.location.href = href;
        return;
      }

      // Swap content
      wrap.innerHTML = main.innerHTML;

      // Swap .nav element
      const currentNav  = document.querySelector('.nav');
      const fetchedNav  = doc.querySelector('.nav');

      if (fetchedNav && !currentNav) {
        // Home → non-home: insert nav invisible
        const navEl = document.importNode(fetchedNav, true);
        navEl.style.opacity = '0';
        navEl.style.transition = `opacity ${FADE_MS}ms ease`;
        document.body.insertBefore(navEl, wrap);
      } else if (!fetchedNav && currentNav) {
        // Non-home → home: remove nav
        currentNav.remove();
      } else if (fetchedNav && currentNav) {
        // Both exist: update links only
        currentNav.innerHTML = fetchedNav.innerHTML;
        currentNav.style.opacity = '0';
      }

      // Update page meta
      document.title = title;
      const isHome = bodyClass.includes('home');
      document.body.className = isHome ? 'home' : bodyClass;
      updateBlur();

      // Ensure home has no sidebar nav, and non-home has exactly one nav.
      if (isHome) {
        document.querySelectorAll('.nav').forEach((node) => node.remove());
      } else {
        const navs = Array.from(document.querySelectorAll('.nav'));
        if (navs.length === 0 && fetchedNav) {
          const navEl = document.importNode(fetchedNav, true);
          navEl.style.opacity = '0';
          navEl.style.transition = `opacity ${FADE_MS}ms ease`;
          document.body.insertBefore(navEl, wrap);
        }
        const dedupedNavs = Array.from(document.querySelectorAll('.nav'));
        if (dedupedNavs.length > 1) {
          dedupedNavs.slice(1).forEach((node) => node.remove());
        }
      }

      // Update URL
      history.pushState({ href }, title, href);

      // Update active nav link
      document.querySelectorAll('.nav a, .home-nav a').forEach(a => {
        a.classList.remove('active');
        const path = new URL(a.href, location.origin).pathname;
        if (path === location.pathname) a.classList.add('active');
      });

      initExpandable();
      initWidgets();
      window.scrollTo(0, 0);

      // Fade in content and nav together
      wrap.style.opacity = '0';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          wrap.style.opacity = '1';
          const newNav = document.querySelector('.nav');
          if (newNav) newNav.style.opacity = '1';
        });
      });

    } catch (err) {
      if (wrap) wrap.style.opacity = '1';
      if (existingNav) existingNav.style.opacity = '1';
      window.location.href = href;
    } finally {
      isNavigating = false;
    }
  }

  // Intercept all internal link clicks
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    const resolvedPath = (() => {
      try {
        return new URL(link.href, location.origin).pathname.toLowerCase();
      } catch {
        return '';
      }
    })();
    const isRedirectStub = ['/vitae.html', '/blog.html', '/slides.html'].includes(resolvedPath);
    const isPdfLink = resolvedPath.endsWith('.pdf');
    if (
      !href ||
      href.startsWith('http') ||
      href.startsWith('mailto') ||
      href.startsWith('#') ||
      href.startsWith('javascript') ||
      link.target === '_blank' ||
      isRedirectStub ||
      isPdfLink
    ) return;

    e.preventDefault();
    navigateTo(href);
  });

  // Handle browser back/forward buttons
  window.addEventListener('popstate', (e) => {
    if (e.state?.href) {
      navigateTo(e.state.href);
    } else {
      window.location.reload();
    }
  });

  // Store initial state so back button works from first page
  history.replaceState({ href: location.pathname }, document.title, location.pathname);
}

function initExpandable() {
  const toggles = document.querySelectorAll('[data-expand-toggle]');
  const LIQUID_RESIZE_DEBOUNCE_MS = 80;
  let liquidResizeTimer = null;

  function scheduleLiquidResize() {
    if (liquidResizeTimer) {
      clearTimeout(liquidResizeTimer);
    }
    liquidResizeTimer = setTimeout(() => {
      liquidResizeTimer = null;
      if (typeof window.__triggerLiquidResize === 'function') {
        window.__triggerLiquidResize();
      }
    }, LIQUID_RESIZE_DEBOUNCE_MS);
  }

  function openPanel(toggle, panel) {
    panel.hidden = false;
    panel.classList.add('is-open');
    panel.style.maxHeight = '0px';
    requestAnimationFrame(() => {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    });
    const onOpenEnd = (e) => {
      if (e.propertyName !== 'max-height') return;
      panel.style.maxHeight = 'none';
      panel.removeEventListener('transitionend', onOpenEnd);
      scheduleLiquidResize();
    };
    panel.addEventListener('transitionend', onOpenEnd);
    toggle.setAttribute('aria-expanded', 'true');
  }

  function closePanel(toggle, panel) {
    if (panel.style.maxHeight === 'none' || !panel.style.maxHeight) {
      panel.style.maxHeight = panel.scrollHeight + 'px';
    }
    panel.classList.remove('is-open');
    requestAnimationFrame(() => {
      panel.style.maxHeight = '0px';
    });
    const onCloseEnd = (e) => {
      if (e.propertyName !== 'max-height') return;
      panel.hidden = true;
      panel.style.maxHeight = '';
      panel.removeEventListener('transitionend', onCloseEnd);
      scheduleLiquidResize();
    };
    panel.addEventListener('transitionend', onCloseEnd);
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggles.forEach((toggle) => {
    const panelId = toggle.getAttribute('aria-controls');
    const panel = panelId ? document.getElementById(panelId) : null;
    if (!panel) return;

    // Clone to remove any existing listeners before rebinding
    const fresh = toggle.cloneNode(true);
    toggle.parentNode.replaceChild(fresh, toggle);

    fresh.addEventListener('click', () => {
      const isOpen = fresh.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closePanel(fresh, panel);
      } else {
        openPanel(fresh, panel);
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initExpandable();
    initPjax();
  }, { once: true });
} else {
  initExpandable();
  initPjax();
}
