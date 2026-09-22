(() => {
  'use strict';

  window.__portfolioReady = true;

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ── theme ─────────────────────────────────────────────── */
  const themeBtn = $('#themeToggle');
  const themeMeta = $('meta[name="theme-color"]');

  const applyTheme = (theme, persist) => {
    root.setAttribute('data-theme', theme);
    if (themeMeta) themeMeta.setAttribute('content', theme === 'light' ? '#ece7dd' : '#0d0d0e');
    themeBtn.setAttribute('aria-label', theme === 'light' ? 'Switch to ink (dark) theme' : 'Switch to paper (light) theme');
    if (persist) {
      try { localStorage.setItem('theme', theme); } catch (e) { /* storage blocked */ }
    }
    window.dispatchEvent(new Event('themechange'));
  };

  applyTheme(root.getAttribute('data-theme') || 'dark', false);
  themeBtn.addEventListener('click', () => {
    applyTheme(root.getAttribute('data-theme') === 'light' ? 'dark' : 'light', true);
  });

  /* ── nav: mobile menu + scrollspy ──────────────────────── */
  const nav = $('#nav');
  const burger = $('#burger');
  const links = $$('.nav__links a');

  const setMenu = (open) => {
    nav.classList.toggle('open', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  burger.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
  links.forEach((a) => a.addEventListener('click', () => setMenu(false)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // scrollspy: watch every section; sections without a nav link simply clear the highlight
  const spyMap = new Map(links.map((a) => [a.dataset.spy, a]));
  const spyEls = $$('main section[id]').filter((el) => el.id !== 'top');
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((a) => a.classList.toggle('active', a === spyMap.get(entry.target.dataset.spyGroup || entry.target.id)));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    spyEls.forEach((el) => spy.observe(el));
  }

  /* ── reveal on scroll + count-up ───────────────────────── */
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    const useComma = el.dataset.comma === '1';
    const fmt = (n) => {
      const s = decimals ? n.toFixed(decimals) : String(Math.round(n));
      return (useComma ? Number(s).toLocaleString('en-US') : s) + suffix;
    };
    if (reduceMotion) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const dur = 1500;
    const tick = (now) => {
      const p = Math.min((now - start) / dur, 1);
      el.textContent = fmt(target * easeOut(p));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const revealables = $$('.reveal, .about__figure, .proj');
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        const num = $('[data-count]', entry.target);
        if (num) countUp(num);
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealables.forEach((el) => io.observe(el));
  } else {
    revealables.forEach((el) => el.classList.add('in'));
  }

  /* ── scroll-driven scenes (hero, stack) ────────────────── */
  const hero = $('#top');
  const figure = $('.about__figure');

  const updateScenes = () => {
    const y = window.scrollY;
    const vh = window.innerHeight;
    nav.classList.toggle('scrolled', y > 12);
    if (reduceMotion) return;

    if (hero) {
      const hp = clamp(y / (hero.offsetHeight * 0.75), 0, 1);
      hero.style.setProperty('--hp', hp.toFixed(3));
    }
    if (figure) {
      const r = figure.getBoundingClientRect();
      if (r.top < vh * 1.2 && r.bottom > -vh * 0.2) {
        const ex = easeOut(clamp((vh - r.top) / (vh * 0.85), 0, 1));
        figure.style.setProperty('--ex', ex.toFixed(3));
      }
    }
  };

  let ticking = false;
  const requestUpdate = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; updateScenes(); });
  };
  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);

  if (!reduceMotion && figure) figure.style.setProperty('--ex', '0');
  updateScenes();

  /* ── Sera: drag-to-scale architecture ──────────────────── */
  // Design targets from the Sera architecture plan (not measured results).
  const TIERS = [
    {
      users: 10, label: '10', name: 'Dev', env: 'Docker Compose', p95: '< 2 s', cache: 'n/a', pips: 1,
      subs: { browser: 'React + TS', cdn: 'edge audio', alb: 'round-robin', api: '1 process', redis: 'local container', pg: 'local container', replica: 'recs queries', queue: 'TTS jobs', tts: 'in-process · sync', s3: 'PDFs + audio' },
      changes: [
        'Single FastAPI process',
        'Local Postgres and Redis in Docker',
        'StyleTTS 2 runs in the same container',
        'No queue: TTS is generated synchronously',
      ],
    },
    {
      users: 100, label: '100', name: 'Staging', env: 'AWS ECS Fargate', p95: '< 1 s API · < 3 s TTS', cache: '> 80%', pips: 2,
      subs: { browser: 'React + TS', cdn: 'edge audio', alb: 'round-robin', api: '2 Fargate tasks', redis: 'TTS cache > 80% hit', pg: 'RDS · pooled', replica: 'recs queries', queue: 'TTS jobs', tts: '1 worker', s3: 'PDFs + audio' },
      changes: [
        'Two API tasks behind a load balancer',
        'An SQS queue decouples TTS generation from the API response',
        'A separate TTS worker task',
        'Redis becomes critical: the TTS cache must hit more than 80%',
        'RDS Postgres with connection pooling',
      ],
    },
    {
      users: 1000, label: '1,000', name: 'Growth', env: 'ECS auto-scaling', p95: '< 500 ms', cache: '> 90%', pips: 5, auto: true,
      subs: { browser: 'React + TS', cdn: 'edge audio', alb: 'round-robin', api: 'auto-scale CPU>60%', redis: 'cache > 90% hit', pg: 'RDS · pgBouncer', replica: 'recs queries', queue: 'TTS jobs', tts: 'scales w/ queue', s3: 'via CDN' },
      changes: [
        'API auto-scales out when CPU passes 60%',
        'pgBouncer folds hundreds of app connections into ~20 database connections',
        'CloudFront serves audio from the edge instead of S3',
        'TTS workers scale on queue depth',
        'Redis Cluster if a single Redis saturates',
      ],
    },
    {
      users: 10000, label: '10,000', name: 'Scale', env: 'Kubernetes', p95: '< 200 ms', cache: '> 95%', pips: 8, auto: true,
      subs: { browser: 'React + TS', cdn: 'global edge', alb: 'multi-AZ', api: 'K8s · HPA', redis: 'cache > 95% hit', pg: 'primary · writes', replica: 'recs queries', queue: 'FIFO · user dedup', tts: 'HPA · queue depth', s3: 'via CDN' },
      changes: [
        'Kubernetes with autoscaling on CPU and queue depth',
        'A read replica takes recommendation queries; the primary handles writes',
        'A dedicated vector database (e.g. Qdrant) if pgvector latency degrades',
        'Multi-AZ deployment with a global CDN',
        'SQS FIFO queues with per-user deduplication',
      ],
    },
  ];

  const scaler = $('#scaler');
  if (scaler) {
    const range = $('#scaleRange', scaler);
    const ticks = $$('.ticks button', scaler);
    const nodes = $$('.nd', scaler);
    const edges = $$('.ed', scaler);
    const pipsG = $('#apiPips', scaler);
    const out = {
      users: $('#tierUsers'), name: $('#tierName'), env: $('#tierEnv'),
      p95: $('#tierP95'), cache: $('#tierCache'), list: $('#tierList'),
    };
    const svgNS = 'http://www.w3.org/2000/svg';

    const setTier = (i, animate = true) => {
      const t = TIERS[i];
      const prev = TIERS[i - 1];

      out.users.textContent = t.label;
      out.name.textContent = t.name;
      out.env.textContent = t.env;
      out.p95.textContent = t.p95;
      out.cache.textContent = t.cache;
      out.list.innerHTML = t.changes.map((c, k) => `<li style="animation-delay:${animate ? k * 60 : 0}ms">${c}</li>`).join('');

      range.value = String(i);
      range.style.setProperty('--fill', `${(i / (TIERS.length - 1)) * 100}%`);
      range.setAttribute('aria-valuetext', `${t.label} users, ${t.name}`);
      ticks.forEach((b, k) => b.classList.toggle('on', k === i));

      nodes.forEach((g) => {
        const key = g.dataset.node;
        const min = parseInt(g.dataset.min, 10);
        const active = t.users >= min;
        const sub = g.querySelector('[data-sub]');
        if (sub) sub.textContent = t.subs[key];
        const isNew = active && (t.users === min || (prev && prev.subs[key] !== t.subs[key]));
        g.classList.toggle('ghost', !active);
        g.classList.toggle('hot', Boolean(i > 0 && isNew));
      });

      edges.forEach((e) => {
        const min = parseInt(e.dataset.min, 10);
        const max = e.dataset.max ? parseInt(e.dataset.max, 10) : Infinity;
        const on = t.users >= min && t.users <= max;
        e.classList.toggle('on', on);
        e.classList.toggle('off', !on && t.users > max);
      });

      pipsG.innerHTML = '';
      pipsG.classList.toggle('auto', Boolean(t.auto));
      for (let k = 0; k < t.pips; k++) {
        const r = document.createElementNS(svgNS, 'rect');
        r.setAttribute('x', String(k * 15));
        r.setAttribute('y', '0');
        r.style.animationDelay = `${k * 45}ms`;
        pipsG.appendChild(r);
      }
    };

    range.addEventListener('input', () => setTier(parseInt(range.value, 10)));
    ticks.forEach((b) => b.addEventListener('click', () => setTier(parseInt(b.dataset.tier, 10))));
    setTier(1, false);
  }

  /* ── hero: drifting node graph ─────────────────────────── */
  const canvas = $('#graph');
  if (!canvas || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const heroEl = canvas.parentElement;
  const LINK = 128;
  const POINTER_R = 190;

  let w = 0, h = 0, dpr = 1;
  let nodes = [];
  let raf = 0;
  let visible = true;
  const pointer = { x: -9999, y: -9999 };
  const rgb = { fg: '233,227,215', accent: '143,118,232' };

  const readColors = () => {
    const cs = getComputedStyle(root);
    rgb.fg = cs.getPropertyValue('--rgb-fg').trim() || rgb.fg;
    rgb.accent = cs.getPropertyValue('--rgb-accent').trim() || rgb.accent;
  };

  const seed = () => {
    const density = w < 700 ? 20000 : 15000;
    const count = Math.max(26, Math.min(92, Math.round((w * h) / density)));
    nodes = Array.from({ length: count }, () => {
      const hot = Math.random() < 0.1;
      return {
        x: w * (0.15 + 0.85 * Math.sqrt(Math.random())),
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: hot ? 2.6 + Math.random() * 1.2 : 1.1 + Math.random() * 1.3,
        hot,
      };
    });
  };

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    if (reduceMotion) draw();
  };

  const step = () => {
    for (const n of nodes) {
      const dx = pointer.x - n.x;
      const dy = pointer.y - n.y;
      const d = Math.hypot(dx, dy);
      if (d < POINTER_R && d > 1) {
        const pull = (1 - d / POINTER_R) * 0.05;
        n.x += (dx / d) * pull * 6;
        n.y += (dy / d) * pull * 6;
      }
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
    }
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    ctx.lineWidth = 1;

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        const t = 1 - d / LINK;
        const hot = a.hot || b.hot;
        ctx.strokeStyle = hot ? `rgba(${rgb.accent},${t * 0.6})` : `rgba(${rgb.fg},${t * 0.26})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
      if (pd < POINTER_R) {
        ctx.strokeStyle = `rgba(${rgb.accent},${(1 - pd / POINTER_R) * 0.7})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }

    for (const n of nodes) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.hot ? `rgba(${rgb.accent},.95)` : `rgba(${rgb.fg},.7)`;
      ctx.fill();
      if (n.hot) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${rgb.accent},.16)`;
        ctx.fill();
      }
    }
  };

  const loop = () => {
    step();
    draw();
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (!raf && !reduceMotion) raf = requestAnimationFrame(loop); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  readColors();
  resize();
  if (reduceMotion) draw(); else start();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });

  window.addEventListener('themechange', () => {
    readColors();
    if (reduceMotion) draw();
  });

  heroEl.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch') return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = e.clientX - rect.left;
    pointer.y = e.clientY - rect.top;
  });
  heroEl.addEventListener('pointerleave', () => { pointer.x = pointer.y = -9999; });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !document.hidden) start(); else stop();
    }).observe(heroEl);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else if (visible) start();
  });
})();
