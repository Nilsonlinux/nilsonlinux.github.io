/* NLinux — efeito do nome no hero (canvas).
   Monta "NLinux" com blocos/partículas e vai alternando efeitos:
     chuva    — blocos caem de cima e se encaixam;
     explosão — o nome estoura em partículas e se recompõe;
     lateral  — as peças entram pelas laterais;
     onda     — as peças se recolhem do caos;
     teclado  — as peças aparecem da esquerda p/ a direita;
     bordas   — as peças entram pela borda mais próxima;
     glitch   — começa embaralhado e "trava" no lugar;
     vórtice  — as peças espiralam até o nome.
   Além disso, blocos soltos aparecem e somem ao fundo enquanto o
   nome se forma. Segue o tema pelo --accent (amarelo no escuro,
   azul no claro) e respeita prefers-reduced-motion: nesse caso o
   canvas nem liga e o texto em gradiente do .hero-name-text fica visível. */
(() => {
	const host = document.querySelector('.hero-name');
	if (!host) return;
	const canvas = host.querySelector('canvas');
	if (!canvas || !canvas.getContext) return;
	const ctx = canvas.getContext('2d');
	const textEl = host.querySelector('.hero-name-text');
	const TEXT = host.dataset.text || (textEl && textEl.textContent.trim()) || 'NLinux';
	const reduce = matchMedia('(prefers-reduced-motion: reduce)');

	const WEIGHT = 800;
	const FAMILY = 'Inter, ui-sans-serif, system-ui, sans-serif';
	const root = document.documentElement;

	let W = 0, H = 0, dpr = 1, fontPx = 100;
	let particles = [];
	let ambient = [];
	let gradTop = 0, gradSpan = 1;
	let ACCENT = [255, 245, 155], BG = [7, 7, 34];
	let ambientColor = 'rgb(180, 170, 120)';

	/* ---------- cor ---------- */
	const cssVar = name => getComputedStyle(root).getPropertyValue(name).trim();
	function parseColor(str) {
		str = (str || '#fff59b').trim();
		if (str[0] === '#') {
			let h = str.slice(1);
			if (h.length === 3) h = h.split('').map(c => c + c).join('');
			const n = parseInt(h.slice(0, 6), 16);
			return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
		}
		const m = str.match(/\d+(?:\.\d+)?/g);
		return m && m.length >= 3 ? [+m[0], +m[1], +m[2]] : [255, 245, 155];
	}
	const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
	const rgb = c => 'rgb(' + (c[0] | 0) + ', ' + (c[1] | 0) + ', ' + (c[2] | 0) + ')';
	const smooth = x => { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); };

	function readColors() {
		ACCENT = parseColor(cssVar('--accent'));
		BG = parseColor(cssVar('--bg') || '#070722');
		ambientColor = rgb(mix(ACCENT, BG, 0.35));
	}

	/* tom metálico: topo mais claro, meio no --accent, base mais escura */
	function tone(u) {
		u = u < 0 ? 0 : u > 1 ? 1 : u;
		const white = [255, 255, 255], black = [0, 0, 0];
		return u <= 0.5 ? rgb(mix(ACCENT, white, (0.5 - u) * 0.8))
		                : rgb(mix(ACCENT, black, (u - 0.5) * 0.9));
	}

	/* ---------- geometria / alvos ---------- */
	function computeFont() {
		const targetW = W * 0.96;
		ctx.font = WEIGHT + ' 100px ' + FAMILY;
		const w = ctx.measureText(TEXT).width || 1;
		fontPx = Math.max(24, Math.min((targetW / w) * 100, H * 0.9));
	}

	function buildParticles() {
		const off = document.createElement('canvas');
		off.width = W; off.height = H;
		const o = off.getContext('2d');
		o.textAlign = 'center'; o.textBaseline = 'middle';
		o.font = WEIGHT + ' ' + fontPx + 'px ' + FAMILY;
		o.fillStyle = '#fff';
		o.fillText(TEXT, W / 2, H / 2);

		let data;
		try { data = o.getImageData(0, 0, W, H).data; }
		catch (e) { return; }

		const step = Math.max(4, Math.round(fontPx / 16));
		const size = step * 1.05;
		const xs = [], ys = [];
		let top = H, bot = 0;
		for (let y = 0; y < H; y += step) {
			for (let x = 0; x < W; x += step) {
				if (data[(y * W + x) * 4 + 3] > 140) {
					xs.push(x); ys.push(y);
					if (y < top) top = y;
					if (y > bot) bot = y;
				}
			}
		}
		if (!xs.length) { particles = []; return; }
		if (bot <= top) { top = H / 2 - fontPx / 2; bot = top + fontPx; }
		gradTop = top; gradSpan = Math.max(1, bot - top);

		particles = new Array(xs.length);
		for (let i = 0; i < xs.length; i++) {
			particles[i] = {
				tx: xs[i], ty: ys[i], x: xs[i], y: ys[i],
				vx: 0, vy: 0, size: size, delay: 0,
				color: tone((ys[i] - gradTop) / gradSpan)
			};
		}
	}

	/* ---------- blocos soltos ao fundo ---------- */
	const rnd = (a, b) => a + Math.random() * (b - a);

	function respawnAmbient(a, initial) {
		const base = Math.max(60, fontPx);
		a.size = rnd(base * 0.035, base * 0.1);
		a.x = rnd(-a.size, W + a.size);
		a.y = rnd(-a.size, H + a.size);
		a.vx = rnd(-18, 18);
		a.vy = rnd(-14, 14);
		a.max = rnd(1.8, 4.8);
		a.life = initial ? rnd(0, a.max) : 0;
	}

	function buildAmbient() {
		ambient = [];
		const n = Math.round(Math.min(34, Math.max(14, W / 42)));
		for (let i = 0; i < n; i++) {
			const a = {};
			respawnAmbient(a, true);
			ambient.push(a);
		}
	}

	function drawAmbient(dt) {
		ctx.fillStyle = ambientColor;
		for (let i = 0; i < ambient.length; i++) {
			const a = ambient[i];
			a.life += dt;
			if (a.life >= a.max) { respawnAmbient(a, false); continue; }
			a.x += a.vx * dt;
			a.y += a.vy * dt;
			const alpha = Math.sin(Math.PI * (a.life / a.max)) * 0.45;
			if (alpha <= 0.012) continue;
			ctx.globalAlpha = alpha;
			const s = a.size;
			ctx.fillRect(a.x - s * 0.5, a.y - s * 0.5, s, s);
		}
		ctx.globalAlpha = 1;
	}

	function layout() {
		const r = host.getBoundingClientRect();
		W = Math.max(160, Math.round(r.width));
		H = Math.max(48, Math.round(r.height));
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = W + 'px';
		canvas.style.height = H + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		computeFont();
		buildParticles();
		buildAmbient();
	}

	/* ---------- efeitos ---------- */
	const EFFECTS = [
		{ /* chuva: caem de cima e se encaixam (onda da esquerda p/ direita) */
			duration: 2.5,
			init() {
				for (const p of particles) {
					p.x = p.tx + rnd(-W * 0.12, W * 0.12);
					p.y = -H * rnd(0.25, 1.1);
					p.vx = rnd(-1, 1);
					p.vy = rnd(4, 9);
					p.delay = (p.tx / Math.max(1, W)) * 0.18;
				}
			},
			params: () => ({ k: 0.085, damp: 0.9, grav: 0.42 })
		},
		{ /* explosão: estoura do centro e volta a se montar */
			duration: 2.6,
			init() {
				const cx = W / 2, cy = H / 2;
				for (const p of particles) {
					p.x = p.tx; p.y = p.ty;
					const a = Math.atan2(p.ty - cy, p.tx - cx) + rnd(-0.35, 0.35);
					const sp = rnd(5, 15);
					p.vx = Math.cos(a) * sp;
					p.vy = Math.sin(a) * sp - rnd(1, 4);
					p.delay = 0;
				}
			},
			params(t) {
				if (t < 0.34) return { k: 0, damp: 0.985, grav: 0.45 };
				const e = smooth((t - 0.34) / 0.66);
				return { k: 0.13 * e, damp: 0.9, grav: 0.45 * (1 - e) };
			}
		},
		{ /* lateral: as peças entram pelas laterais */
			duration: 2.4,
			init() {
				for (const p of particles) {
					const left = p.tx < W / 2;
					p.x = left ? -rnd(30, W * 0.5) : W + rnd(30, W * 0.5);
					p.y = p.ty + rnd(-H * 0.25, H * 0.25);
					p.vx = (left ? 1 : -1) * rnd(6, 14);
					p.vy = rnd(-1, 1);
					p.delay = (Math.abs(p.tx - W / 2) / Math.max(1, W)) * 0.2;
				}
			},
			params: () => ({ k: 0.1, damp: 0.88, grav: 0 })
		},
		{ /* onda: recolhe do caos */
			duration: 2.6,
			init() {
				for (const p of particles) {
					p.x = rnd(0, W); p.y = rnd(0, H);
					p.vx = 0; p.vy = 0;
					p.delay = rnd(0, 0.25);
				}
			},
			params: () => ({ k: 0.055, damp: 0.9, grav: 0 })
		},
		{ /* teclado: as peças aparecem da esquerda p/ a direita */
			duration: 2.7,
			init() {
				const R = fontPx * 0.28;
				for (const p of particles) {
					p.x = p.tx + rnd(-R, R);
					p.y = p.ty + rnd(-R, R);
					p.vx = 0; p.vy = 0;
					p.delay = (p.tx / Math.max(1, W)) * 0.72;
				}
			},
			params: () => ({ k: 0.2, damp: 0.7, grav: 0 })
		},
		{ /* bordas: as peças entram pela borda mais próxima */
			duration: 2.4,
			init() {
				for (const p of particles) {
					const top = p.ty, bot = H - p.ty, left = p.tx, right = W - p.tx;
					const m = Math.min(top, bot, left, right);
					let vx = 0, vy = 0;
					if (m === top) { p.x = p.tx + rnd(-W * 0.1, W * 0.1); p.y = -rnd(20, H * 0.45); vy = rnd(6, 13); }
					else if (m === bot) { p.x = p.tx + rnd(-W * 0.1, W * 0.1); p.y = H + rnd(20, H * 0.45); vy = -rnd(6, 13); }
					else if (m === left) { p.x = -rnd(20, W * 0.45); p.y = p.ty + rnd(-H * 0.1, H * 0.1); vx = rnd(6, 13); }
					else { p.x = W + rnd(20, W * 0.45); p.y = p.ty + rnd(-H * 0.1, H * 0.1); vx = -rnd(6, 13); }
					p.vx = vx; p.vy = vy;
					p.delay = 0;
				}
			},
			params: () => ({ k: 0.095, damp: 0.88, grav: 0 })
		},
		{ /* glitch: começa embaralhado e "trava" no lugar */
			duration: 2.1,
			init() {
				for (const p of particles) {
					p.x = p.tx; p.y = p.ty;
					p.vx = rnd(-6, 6); p.vy = rnd(-2, 2);
					p.delay = 0;
				}
			},
			params: t => t < 0.55 ? { k: 0.03, damp: 0.72, grav: 0 }
			                      : { k: 0.17, damp: 0.7, grav: 0 },
			tick(p, t) {
				if (t < 0.62 && Math.random() < 0.05) {
					p.x = p.tx + rnd(-W * 0.05, W * 0.05);
					p.y = p.ty + rnd(-5, 5);
				}
			}
		},
		{ /* vórtice: as peças espiralam até o nome */
			duration: 2.8,
			init() {
				const cx = W / 2, cy = H / 2;
				for (const p of particles) {
					const a = rnd(0, Math.PI * 2);
					const rad = rnd(H * 0.6, H * 1.7);
					p.x = cx + Math.cos(a) * rad;
					p.y = cy + Math.sin(a) * rad * 0.6;
					p.vx = -Math.sin(a) * rnd(3, 7);
					p.vy = Math.cos(a) * rnd(3, 7) * 0.6;
					p.delay = rnd(0, 0.2);
				}
			},
			params: () => ({ k: 0.07, damp: 0.9, grav: 0 })
		}
	];

	/* atraso por partícula: segura a mola no começo (efeito de onda) */
	function gate(p, t) {
		if (!p.delay) return 1;
		const x = (t - p.delay) / 0.16;
		if (x <= 0) return 0;
		if (x >= 1) return 1;
		return smooth(x);
	}

	/* ---------- loop ---------- */
	let cur = 0, t0 = 0, raf = 0, running = false, visible = true, last = 0;

	function startEffect(idx) {
		cur = ((idx % EFFECTS.length) + EFFECTS.length) % EFFECTS.length;
		EFFECTS[cur].init();
		t0 = performance.now();
	}

	function frame(now) {
		if (!running) return;
		raf = requestAnimationFrame(frame);
		if (!visible) { last = now; return; }

		const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;

		ctx.clearRect(0, 0, W, H);
		drawAmbient(dt);
		if (!particles.length) return;

		let fx = EFFECTS[cur];
		let t = (now - t0) / (fx.duration * 1000);
		if (t >= 1) { startEffect(cur + 1); fx = EFFECTS[cur]; t = 0; }

		const par = fx.params(t);
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			if (fx.tick) fx.tick(p, t);
			const g = gate(p, t);
			const k = par.k * g;
			p.vx += (p.tx - p.x) * k;
			p.vy += (p.ty - p.y) * k + par.grav * g;
			p.vx *= par.damp;
			p.vy *= par.damp;
			p.x += p.vx;
			p.y += p.vy;
			const s = p.size;
			ctx.fillStyle = p.color;
			ctx.fillRect(p.x - s * 0.5, p.y - s * 0.5, s, s);
		}
	}

	function run() {
		if (running) return;
		running = true;
		startEffect(0);
		last = 0;
		raf = requestAnimationFrame(frame);
	}
	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function activate() {
		readColors();
		layout();
		if (reduce.matches) {
			stop();
			host.classList.remove('is-canvas');
			return;
		}
		host.classList.add('is-canvas');
		if (running) startEffect(cur); // já rodando: só reinicia o efeito
		else run();
	}

	/* ---------- eventos ---------- */
	let rt = 0;
	addEventListener('resize', () => {
		clearTimeout(rt);
		rt = setTimeout(activate, 160);
	}, { passive: true });

	new MutationObserver(() => {
		readColors();
		for (const p of particles) p.color = tone((p.ty - gradTop) / gradSpan);
	}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

	if (reduce.addEventListener) reduce.addEventListener('change', activate);
	else if (reduce.addListener) reduce.addListener(activate);

	if ('IntersectionObserver' in window) {
		new IntersectionObserver(es => {
			for (const e of es) visible = e.isIntersecting;
		}, { threshold: 0 }).observe(canvas);
	}
	document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

	/* ---------- início ---------- */
	activate();
	if (document.fonts && document.fonts.ready) {
		document.fonts.ready.then(() => { if (!reduce.matches) activate(); });
	}
})();
