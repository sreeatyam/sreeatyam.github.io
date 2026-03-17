function updateBlur() {
  const doc = document.documentElement;
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
    canvas.style.width  = '100vw';
    canvas.style.height = '100vh';
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (app.resize)   app.resize();
    if (app.onResize) app.onResize();
    if (app.setSize)  app.setSize(window.innerWidth, window.innerHeight);

    window.addEventListener('resize', () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
      if (app.resize)   app.resize();
      if (app.onResize) app.onResize();
      if (app.setSize)  app.setSize(window.innerWidth, window.innerHeight);
    }, { passive: true });

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
