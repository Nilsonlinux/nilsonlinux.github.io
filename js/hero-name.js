/* NLinux — efeito do nome no hero (canvas).
   Monta "NLinux" com bolinhas/partículas e vai alternando efeitos:
     chuva    — bolinhas caem de cima e se encaixam;
     converge — umas caem de cima e outras sobem de baixo, devagar;
     explosão — o nome estoura em partículas e se recompõe;
     lateral  — as bolinhas entram pelas laterais;
     lados    — "NLi" entra pela esquerda e "nux" pela direita;
     onda     — as bolinhas se recolhem do caos;
     teclado  — as bolinhas aparecem da esquerda p/ a direita;
     letras   — cada letra se monta por vez (esq -> dir);
     bordas   — as bolinhas entram pela borda mais próxima;
     glitch   — começa embaralhado e "trava" no lugar;
     vórtice  — as bolinhas espiralam até o nome;
     scanline — uma linha varre de cima p/ baixo revelando o nome;
     dominó   — as bolinhas caem em cascata (esq -> dir);
     zoom     — o nome vem grande/afastado e se ajusta;
     ia       — rede neural que "aprende" o nome (sinapses e convergência);
     difusão  — o nome emerge do ruído (denoise);
     tokens   — o nome é gerado token por token (com cursor);
     atenção  — linhas de atenção ligam as letras;
     detecção — caixas de confiança reconhecem cada letra;
     treino   — converge enquanto a "loss" cai (aprendizado).
   Dica: clique sobre o nome para pular para o próximo efeito.
   Além disso, bolinhas soltas aparecem e somem ao fundo enquanto o
   nome se forma, e ao passar o mouse sobre o nome surgem bolinhas que
   seguram um gradiente de cor e somem num degrade. As bolinhas têm um
   brilho que pulsa. No fim de cada efeito as bolinhas se dissolvem numa
   camada com a fonte real (Geist), então o nome 100% montado fica
   idêntico à tipografia — e ganha um brilho (flash ao montar + brilho
   suave contínuo). Segue o tema pelo --accent (amarelo no escuro, azul
   no claro) e respeita
   prefers-reduced-motion: nesse caso o canvas nem liga e o texto em
   gradiente do .hero-name-text fica visível. */
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
	const FAMILY = 'Geist, Inter, ui-sans-serif, system-ui, sans-serif';
	const root = document.documentElement;

	let W = 0, H = 0, dpr = 1, fontPx = 100;
	let particles = [];
	let ambient = [];
	let nameLayer = null, nameLayerCtx = null;
	let hold = 0;
	let ACCENT = [255, 245, 155], ACCENT2 = [155, 254, 206], ACCENT3 = [169, 174, 254], BG = [7, 7, 34];
	let ambientColor = 'rgb(180, 170, 120)';
	const WHITE = [255, 255, 255], BLACK = [0, 0, 0];
	let metal = [];
	let glowRGB = [255, 255, 255], glowColor = 'rgb(255, 255, 255)';
	let pulse = 0, glowFlash = 0;
	let letterBounds = [], nLetters = 1;

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
	const TAU = Math.PI * 2;

	function readColors() {
		ACCENT = parseColor(cssVar('--accent'));
		ACCENT2 = parseColor(cssVar('--accent-2') || '#9bfece');
		ACCENT3 = parseColor(cssVar('--accent-3') || '#a9aefe');
		BG = parseColor(cssVar('--bg') || '#070722');
		ambientColor = rgb(mix(ACCENT, BG, 0.35));
		glowRGB = mix(ACCENT, WHITE, 0.3);
		glowColor = rgb(glowRGB);
		/* mesmos stops do gradiente metálico do .hero-name-text (CSS) */
		metal = [
			[0.000, mix(WHITE, ACCENT, 0.62)], [0.263, mix(WHITE, ACCENT, 0.62)],
			[0.263, ACCENT],                   [0.368, ACCENT],
			[0.368, mix(WHITE, ACCENT, 0.84)], [0.579, mix(WHITE, ACCENT, 0.84)],
			[0.579, mix(BLACK, ACCENT, 0.68)], [0.737, mix(BLACK, ACCENT, 0.68)],
			[0.737, mix(BLACK, ACCENT, 0.42)]
		];
	}

	/* cor do nome em função da altura (u = y/H), amostrando o gradiente
	   metálico — usada pelas bolinhas para casar com a camada da fonte real */
	function nameColorAt(u) {
		u = u < 0 ? 0 : u > 1 ? 1 : u;
		for (let i = 0; i < metal.length - 1; i++) {
			const a = metal[i], b = metal[i + 1];
			if (u >= a[0] && u <= b[0]) {
				const span = b[0] - a[0];
				const t = span <= 1e-6 ? 1 : (u - a[0]) / span;
				return rgb(mix(a[1], b[1], t));
			}
		}
		return rgb(metal.length ? metal[metal.length - 1][1] : ACCENT);
	}

	/* índice da letra (0..nLetters-1) à qual pertence um x alvo */
	function letterAt(x) {
		for (let i = 0; i < letterBounds.length; i++) if (x < letterBounds[i][1]) return i;
		return Math.max(0, letterBounds.length - 1);
	}

	/* aplica a fonte exata (peso 800 + letter-spacing -.045em do CSS) */
	function applyFont(c, px) {
		c.font = WEIGHT + ' ' + px + 'px ' + FAMILY;
		if ('letterSpacing' in c) c.letterSpacing = (-0.045 * px) + 'px';
	}

	/* bolinha com um halo de brilho discreto: um halo externo bem suave
	   + um interno leve, na cor do glow, pulsando com `pulse` */
	function glowDot(x, y, r, color, alpha, glow) {
		if (glow > 0.001) {
			ctx.fillStyle = glowColor;
			ctx.globalAlpha = alpha * glow * 0.3;
			ctx.beginPath();
			ctx.arc(x, y, r * 2.4, 0, TAU);
			ctx.fill();
			ctx.globalAlpha = alpha * glow;
			ctx.beginPath();
			ctx.arc(x, y, r * 1.4, 0, TAU);
			ctx.fill();
		}
		ctx.globalAlpha = alpha;
		ctx.fillStyle = color;
		ctx.beginPath();
		ctx.arc(x, y, r, 0, TAU);
		ctx.fill();
	}

	/* ---------- geometria / alvos ---------- */
	function computeFont() {
		const targetW = W * 0.96;
		applyFont(ctx, 100);
		const w = ctx.measureText(TEXT).width || 1;
		fontPx = Math.max(24, Math.min((targetW / w) * 100, H * 0.9));
		applyFont(ctx, fontPx);
	}

	function buildParticles() {
		const off = document.createElement('canvas');
		off.width = W; off.height = H;
		const o = off.getContext('2d');
		o.textAlign = 'center'; o.textBaseline = 'middle';
		applyFont(o, fontPx);
		o.fillStyle = '#fff';
		o.fillText(TEXT, W / 2, H / 2);

		/* limites de cada letra — usados pelo efeito "letras" */
		nLetters = Math.max(1, TEXT.length);
		const fullW = o.measureText(TEXT).width || 1;
		const textLeft = W / 2 - fullW / 2;
		letterBounds = [];
		for (let i = 0; i < nLetters; i++) {
			const a = o.measureText(TEXT.slice(0, i)).width;
			const b = o.measureText(TEXT.slice(0, i + 1)).width;
			letterBounds.push([textLeft + a, textLeft + b]);
		}

		let data;
		try { data = o.getImageData(0, 0, W, H).data; }
		catch (e) { return; }

		const step = Math.max(4, Math.round(fontPx / 16));
		const size = step * 1.35;
		const xs = [], ys = [];
		for (let y = 0; y < H; y += step) {
			for (let x = 0; x < W; x += step) {
				if (data[(y * W + x) * 4 + 3] > 140) {
					xs.push(x); ys.push(y);
				}
			}
		}
		if (!xs.length) { particles = []; return; }

		particles = new Array(xs.length);
		for (let i = 0; i < xs.length; i++) {
			particles[i] = {
				tx: xs[i], ty: ys[i], x: xs[i], y: ys[i],
				vx: 0, vy: 0, size: size, delay: 0,
				scale: 1, scaleV: 0, rot: 0, rotV: 0, alpha: 1,
				letter: letterAt(xs[i]),
				color: nameColorAt(ys[i] / H)
			};
		}
	}

	/* ---------- camada do nome na fonte real ----------
	   Desenha "NLinux" na fonte exata (Geist 800 + letter-spacing do CSS)
	   com o gradiente metálico. Ao fim de cada efeito as bolinhas dão lugar
	   a esta camada, então o nome montado fica idêntico à tipografia. */
	function paintName(c) {
		c.clearRect(0, 0, W, H);
		const g = c.createLinearGradient(0, 0, 0, H);
		for (let i = 0; i < metal.length; i++) g.addColorStop(metal[i][0], rgb(metal[i][1]));
		c.fillStyle = g;
		c.fillText(TEXT, W / 2, H / 2);
		c.lineWidth = 1.5;
		c.strokeStyle = 'rgba(' + (ACCENT[0] | 0) + ', ' + (ACCENT[1] | 0) + ', ' + (ACCENT[2] | 0) + ', 0.75)';
		c.strokeText(TEXT, W / 2, H / 2);
	}

	function buildNameLayer() {
		nameLayer = document.createElement('canvas');
		nameLayer.width = Math.round(W * dpr);
		nameLayer.height = Math.round(H * dpr);
		nameLayerCtx = nameLayer.getContext('2d');
		nameLayerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
		nameLayerCtx.textAlign = 'center';
		nameLayerCtx.textBaseline = 'middle';
		applyFont(nameLayerCtx, fontPx);
		paintName(nameLayerCtx);
	}

	/* ---------- bolinhas soltas ao fundo ---------- */
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
		for (let i = 0; i < ambient.length; i++) {
			const a = ambient[i];
			a.life += dt;
			if (a.life >= a.max) { respawnAmbient(a, false); continue; }
			a.x += a.vx * dt;
			a.y += a.vy * dt;
			const alpha = Math.sin(Math.PI * (a.life / a.max)) * 0.45;
			if (alpha <= 0.012) continue;
			glowDot(a.x, a.y, a.size * 0.5, ambientColor, alpha, 0.06 + 0.08 * pulse);
		}
		ctx.globalAlpha = 1;
	}

	/* ---------- bolinhas do hover (aparecem ao passar o mouse) ----------
	   As bolinhas surgem sob o cursor com tamanho/posição aleatórios e
	   somem num degrade: a opacidade cai com a vida e a cor percorre um
	   gradiente (accent -> accent-3 -> accent-2) conforme a posição x. */
	const hover = [];
	let lastPt = null;

	function hoverColor(t) {
		t = t < 0 ? 0 : t > 1 ? 1 : t;
		return t < 0.5 ? rgb(mix(ACCENT, ACCENT3, t * 2))
		                : rgb(mix(ACCENT3, ACCENT2, (t - 0.5) * 2));
	}

	function spawnHover(x, y) {
		if (hover.length > 340) return;
		const base = Math.max(8, fontPx);
		hover.push({
			x: x, y: y,
			vx: rnd(-45, 45),
			vy: rnd(-85, -12),
			size: rnd(base * 0.05, base * 0.13),
			life: 0,
			max: rnd(0.55, 1.15),
			color: hoverColor(x / Math.max(1, W))
		});
	}

	function stepHover(dt) {
		for (let i = hover.length - 1; i >= 0; i--) {
			const b = hover[i];
			b.life += dt;
			if (b.life >= b.max) { hover.splice(i, 1); continue; }
			b.vy += 160 * dt;
			b.x += b.vx * dt;
			b.y += b.vy * dt;
		}
	}

	function drawHover() {
		if (!hover.length) return;
		for (let i = 0; i < hover.length; i++) {
			const b = hover[i];
			const u = b.life / b.max;
			const a = (1 - u) * 0.9;
			if (a <= 0.01) continue;
			const r = b.size * (1 - u * 0.45) * 0.5;
			if (r <= 0) continue;
			glowDot(b.x, b.y, r, b.color, a, 0.15 + 0.22 * pulse);
		}
		ctx.globalAlpha = 1;
	}

	function handleMove(e) {
		const x = e.offsetX, y = e.offsetY;
		if (lastPt) {
			const dx = x - lastPt.x, dy = y - lastPt.y;
			const dist = Math.hypot(dx, dy);
			const steps = Math.min(14, Math.max(1, Math.round(dist / 7)));
			for (let s = 1; s <= steps; s++) spawnHover(lastPt.x + dx * s / steps, lastPt.y + dy * s / steps);
		} else {
			spawnHover(x, y);
		}
		lastPt = { x: x, y: y };
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
		buildNameLayer();
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
		{ /* converge: umas caem de cima, outras sobem de baixo, formando devagar */
			duration: 3.2,
			init() {
				const mid = H / 2;
				for (const p of particles) {
					const fromTop = p.ty < mid; // parte de cima do nome desce; a de baixo sobe
					p.x = p.tx + rnd(-W * 0.05, W * 0.05);
					p.y = fromTop ? -rnd(30, H * 0.85) : H + rnd(30, H * 0.85);
					p.vx = rnd(-0.5, 0.5);
					p.vy = fromTop ? rnd(2.5, 6) : -rnd(2.5, 6);
					p.delay = (1 - Math.min(1, Math.abs(p.ty - mid) / (H * 0.5))) * 0.3;
				}
			},
			params: () => ({ k: 0.055, damp: 0.9, grav: 0 })
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
		{ /* lateral: as bolinhas entram pelas laterais */
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
		{ /* lados: a 1ª metade ("NLi") entra pela esquerda, a 2ª ("nux") pela direita */
			duration: 2.6,
			init() {
				const mid = Math.ceil(nLetters / 2);
				for (const p of particles) {
					const left = p.letter < mid;
					p.x = left ? -rnd(40, W * 0.55) : W + rnd(40, W * 0.55);
					p.y = p.ty + rnd(-H * 0.08, H * 0.08);
					p.vx = (left ? 1 : -1) * rnd(8, 16);
					p.vy = rnd(-0.6, 0.6);
					p.delay = 0;
				}
			},
			params: () => ({ k: 0.11, damp: 0.86, grav: 0 })
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
		{ /* teclado: as bolinhas aparecem da esquerda p/ a direita */
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
		{ /* letras: cada letra se monta por vez (esq -> dir) */
			duration: 2.9,
			init() {
				for (const p of particles) {
					p.x = p.tx;
					p.y = p.ty - rnd(H * 0.12, H * 0.42);
					p.vx = 0;
					p.vy = rnd(0, 1);
					p.scale = 0.35; p.scaleV = 0;
					p.alpha = 0;
					p.delay = (p.letter / Math.max(1, nLetters - 1)) * 0.62;
				}
			},
			params: () => ({ k: 0.2, damp: 0.76, grav: 0.3 }),
			tick(p, t) {
				/* a letra surge (fade + crescimento) quando chega a sua vez */
				p.alpha = smooth((t - p.delay) / 0.09);
			}
		},
		{ /* bordas: as bolinhas entram pela borda mais próxima */
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
		{ /* vórtice: as bolinhas espiralam até o nome */
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
		},
		{ /* scanline: uma linha varre de cima p/ baixo revelando o nome */
			duration: 2.6,
			init() {
				for (const p of particles) {
					p.x = p.tx; p.y = p.ty; p.vx = 0; p.vy = 0; p.delay = 0; p.alpha = 0;
				}
			},
			params: () => ({ k: 0.14, damp: 0.85, grav: 0 }),
			tick(p, t) {
				const scan = t * (H * 1.2) - H * 0.1;
				p.alpha = smooth((scan - p.ty) / (H * 0.05));
				if (p.alpha >= 1) p.x = p.tx;
				else p.x = p.tx + rnd(-4, 4);
			},
			overlay(t) {
				const scan = t * (H * 1.2) - H * 0.1;
				if (scan < -2 || scan > H + 2) return;
				ctx.globalAlpha = 0.14;
				ctx.fillStyle = rgb(ACCENT);
				ctx.fillRect(0, scan - H * 0.06, W, H * 0.12);
				ctx.globalAlpha = 0.55;
				ctx.fillRect(0, scan - 1, W, 2);
				ctx.globalAlpha = 1;
			}
		},
		{ /* dominó: as bolinhas caem em cascata (esq -> dir) */
			duration: 2.8,
			init() {
				for (const p of particles) {
					p.x = p.tx;
					p.y = p.ty - rnd(H * 0.12, H * 0.45);
					p.vx = 0; p.vy = rnd(1, 3);
					p.rot = rnd(-1.5, -0.5);
					p.rotV = 0;
					p.delay = (p.tx / Math.max(1, W)) * 0.5;
				}
			},
			params: () => ({ k: 0.14, damp: 0.82, grav: 0.22 })
		},
		{ /* zoom: o nome vem grande/afastado e se ajusta */
			duration: 2.6,
			init() {
				const cx = W / 2, cy = H / 2;
				for (const p of particles) {
					const z = rnd(2.2, 3.4);
					p.scale = z; p.scaleV = 0;
					p.x = cx + (p.tx - cx) * z;
					p.y = cy + (p.ty - cy) * z;
					p.vx = 0; p.vy = 0;
					p.delay = 0;
				}
			},
			params: () => ({ k: 0.09, damp: 0.86, grav: 0 })
		},
		{ /* ia: as bolinhas formam uma "rede neural" que aprende o nome —
		     elas nascem espalhadas, ligadas por sinapses, e convergem
		     devagar até o nome; as sinapses somem conforme ela "aprende" */
			duration: 3.3,
			init() {
				for (const p of particles) {
					p.x = rnd(-W * 0.1, W * 1.1);
					p.y = rnd(-H * 0.2, H * 1.2);
					p.vx = 0; p.vy = 0;
					p.alpha = 1;
					p.delay = rnd(0, 0.2);
				}
			},
			params(t) {
				/* começa "pensando" (mola fraca) e vai travando o nome */
				const e = smooth(Math.min(1, t / 0.65));
				return { k: 0.022 + 0.15 * e, damp: 0.9, grav: 0 };
			},
			underlay(t) {
				/* sinapses: liga bolinhas vizinhas (subamostradas) */
				const linkA = 1 - Math.min(1, t / 0.8);
				if (linkA <= 0.03 || particles.length < 8) return;
				const step = Math.max(8, Math.round(particles.length / 120));
				const pts = [];
				for (let i = 0; i < particles.length; i += step) pts.push(particles[i]);
				const maxD = fontPx * 0.5;
				const maxD2 = maxD * maxD;
				ctx.strokeStyle = glowColor;
				ctx.lineWidth = 1;
				for (let i = 0; i < pts.length; i++) {
					const a = pts[i];
					let links = 0;
					for (let j = i + 1; j < pts.length && links < 3; j++) {
						const b = pts[j];
						const dx = a.x - b.x, dy = a.y - b.y;
						const d2 = dx * dx + dy * dy;
						if (d2 < maxD2) {
							ctx.globalAlpha = linkA * (1 - Math.sqrt(d2) / maxD) * 0.55;
							ctx.beginPath();
							ctx.moveTo(a.x, a.y);
							ctx.lineTo(b.x, b.y);
							ctx.stroke();
							links++;
						}
					}
				}
				ctx.globalAlpha = 1;
			}
		},
		{ /* difusão: o nome emerge do ruído, "desruidando" aos poucos */
			duration: 3.0,
			init() {
				for (const p of particles) {
					p.x = rnd(0, W); p.y = rnd(0, H);
					p.vx = rnd(-2, 2); p.vy = rnd(-2, 2);
					p.alpha = rnd(0.3, 0.7);
					p.delay = rnd(0, 0.45);
				}
			},
			params(t) {
				const e = smooth(Math.max(0, (t - 0.08) / 0.9));
				return { k: 0.02 + 0.13 * e, damp: 0.9, grav: 0 };
			},
			tick(p, t) {
				p.alpha = 0.15 + 0.85 * smooth((t - p.delay) / 0.4);
				const j = (1 - Math.min(1, t / 0.7)) * 3.5; // ruído que vai sumindo
				if (j > 0.12) { p.x += rnd(-j, j); p.y += rnd(-j, j); }
			}
		},
		{ /* tokens: o nome é "gerado" token por token, com cursor piscando */
			duration: 3.0,
			init() {
				for (const p of particles) {
					p.x = p.tx; p.y = p.ty;
					p.vx = 0; p.vy = 0;
					p.scale = 0.1; p.scaleV = 0;
					p.alpha = 0;
					p.delay = (p.letter / nLetters) * 0.72;
				}
			},
			params: () => ({ k: 0.3, damp: 0.6, grav: 0 }),
			tick(p, t) {
				const u = smooth((t - p.delay) / 0.13);
				p.alpha = u;
				p.scale = 0.1 + 0.9 * u;
				p.scaleV = 0;
			},
			overlay(t) {
				const prog = Math.min(nLetters, Math.floor(t / 0.72 * nLetters) + 1);
				const idx = Math.max(0, Math.min(nLetters - 1, prog - 1));
				const caretX = letterBounds[idx] ? letterBounds[idx][1] + fontPx * 0.08 : W / 2;
				const blink = Math.sin(performance.now() / 200) > -0.2 ? 1 : 0;
				ctx.globalAlpha = Math.max(0, 1 - Math.min(1, t / 0.92)) * 0.85 * blink;
				ctx.fillStyle = glowColor;
				ctx.fillRect(caretX, H / 2 - fontPx * 0.34, Math.max(2, fontPx * 0.05), fontPx * 0.68);
				ctx.globalAlpha = 1;
			}
		},
		{ /* atenção: linhas de "atenção" ligam as letras até o nome se formar */
			duration: 3.0,
			init() {
				for (const p of particles) {
					const a = rnd(0, TAU), rad = rnd(H * 0.4, H * 1.3);
					p.x = W / 2 + Math.cos(a) * rad * 1.1;
					p.y = H / 2 + Math.sin(a) * rad;
					p.vx = 0; p.vy = 0;
					p.alpha = 1;
					p.delay = rnd(0, 0.3);
				}
			},
			params(t) {
				const e = smooth(Math.min(1, t / 0.7));
				return { k: 0.02 + 0.14 * e, damp: 0.9, grav: 0 };
			},
			underlay(t) {
				const a = 1 - Math.min(1, t / 0.75);
				if (a <= 0.03 || nLetters < 2) return;
				ctx.strokeStyle = glowColor;
				ctx.lineWidth = 1;
				for (let i = 0; i < nLetters; i++) {
					const xi = (letterBounds[i][0] + letterBounds[i][1]) / 2;
					for (let j = i + 1; j < nLetters; j++) {
						const xj = (letterBounds[j][0] + letterBounds[j][1]) / 2;
						const w = 1 / (1 + Math.abs(i - j));
						ctx.globalAlpha = a * w * 0.55;
						ctx.beginPath();
						ctx.moveTo(xi, H / 2 - fontPx * 0.32);
						ctx.lineTo(xj, H / 2 + fontPx * 0.32);
						ctx.stroke();
					}
				}
				ctx.globalAlpha = 1;
			}
		},
		{ /* detecção: caixas de "confiança" reconhecem cada letra */
			duration: 3.0,
			init() {
				for (const p of particles) {
					p.x = rnd(0, W); p.y = rnd(0, H);
					p.vx = 0; p.vy = 0;
					p.alpha = 0.12;
					p.delay = (p.letter / nLetters) * 0.5 + rnd(0, 0.15);
				}
			},
			params: () => ({ k: 0.09, damp: 0.88, grav: 0 }),
			tick(p, t) {
				p.alpha = 0.12 + 0.88 * smooth((t - p.delay) / 0.35);
			},
			underlay(t) {
				const fade = 1 - Math.min(1, t / 0.82);
				if (fade <= 0.03) return;
				const per = 0.5 / Math.max(1, nLetters);
				ctx.lineWidth = 1.5;
				ctx.strokeStyle = glowColor;
				for (let i = 0; i < nLetters; i++) {
					const on = smooth(Math.min(1, Math.max(0, (t - i * per) / 0.12)));
					if (on <= 0.01) continue;
					const x0 = letterBounds[i][0] - 3, x1 = letterBounds[i][1] + 3;
					const y0 = H / 2 - fontPx * 0.52, y1 = H / 2 + fontPx * 0.52;
					ctx.globalAlpha = on * fade * 0.7;
					ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
					ctx.save();
					ctx.globalAlpha = on * fade * 0.9;
					ctx.fillStyle = glowColor;
					ctx.font = '600 ' + Math.max(8, fontPx * 0.14) + 'px ' + FAMILY;
					ctx.textAlign = 'left';
					ctx.textBaseline = 'bottom';
					if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
					ctx.fillText((88 + ((i * 13) % 11)) + '%', x0, y0 - 3);
					ctx.restore();
				}
				ctx.globalAlpha = 1;
			}
		},
		{ /* treino: o nome "aprende" (converge) enquanto a "loss" cai */
			duration: 3.0,
			init() {
				for (const p of particles) {
					p.x = p.tx + rnd(-W * 0.15, W * 0.15);
					p.y = p.ty + rnd(-H * 0.5, H * 0.5);
					p.vx = 0; p.vy = 0;
					p.alpha = 1;
					p.delay = rnd(0, 0.25);
				}
			},
			params(t) {
				const e = smooth(Math.min(1, t / 0.8));
				return { k: 0.03 + 0.13 * e, damp: 0.9, grav: 0 };
			},
			overlay(t) {
				const fade = 1 - Math.min(1, t / 0.9);
				if (fade <= 0.02) return;
				ctx.save();
				ctx.globalAlpha = fade * 0.7;
				ctx.fillStyle = glowColor;
				ctx.font = '600 ' + Math.max(9, fontPx * 0.15) + 'px ' + FAMILY;
				ctx.textAlign = 'left';
				ctx.textBaseline = 'top';
				if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
				const loss = 1.75 * (1 - Math.min(1, t / 0.85)) + 0.012;
				ctx.fillText('loss ' + loss.toFixed(3), 8, 6);
				ctx.restore();
			}
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
	let settling = false, settleT0 = 0;
	const SETTLE = 0.9; // segundos em que o nome fica montado (fonte real) entre efeitos

	function startEffect(idx) {
		cur = ((idx % EFFECTS.length) + EFFECTS.length) % EFFECTS.length;
		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			p.scale = 1; p.scaleV = 0; p.rot = 0; p.rotV = 0; p.alpha = 1;
		}
		EFFECTS[cur].init();
		settling = false;
		t0 = performance.now();
	}

	function frame(now) {
		if (!running) return;
		raf = requestAnimationFrame(frame);
		if (!visible) { last = now; return; }

		const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;

		/* pulso do brilho das bolinhas + decaimento do flash do nome */
		pulse = 0.5 + 0.5 * Math.sin(now / 620);
		if (glowFlash > 0) glowFlash = Math.max(0, glowFlash - dt / 0.7);

		ctx.clearRect(0, 0, W, H);
		drawAmbient(dt);
		stepHover(dt);
		if (!particles.length) {
			if (nameLayer) { ctx.globalAlpha = 1; ctx.drawImage(nameLayer, 0, 0, W, H); }
			drawHover();
			return;
		}

		let fx = EFFECTS[cur];
		let t = (now - t0) / (fx.duration * 1000);
		if (t >= 1) {
			if (!settling) { settling = true; settleT0 = now; glowFlash = 1; }
			if (now - settleT0 >= SETTLE * 1000) {
				startEffect(cur + 1);
				fx = EFFECTS[cur];
				t = 0;
			} else {
				t = 1; // nome montado: segura na fonte real antes do próximo efeito
			}
		}

		const par = fx.params(t);

		/* "hold": ao final do efeito, as bolinhas viram o nome na fonte real */
		hold += ((t > 0.5 ? 1 : 0) - hold) * Math.min(1, dt / 0.22);
		const pAlpha = 1 - hold;

		if (fx.underlay) fx.underlay(t);

		for (let i = 0; i < particles.length; i++) {
			const p = particles[i];
			const g = gate(p, t);
			const k = par.k * g;

			p.vx += (p.tx - p.x) * k;
			p.vy += (p.ty - p.y) * k + par.grav * g;
			p.vx *= par.damp;
			p.vy *= par.damp;
			p.x += p.vx;
			p.y += p.vy;

			if (p.scale !== 1 || p.scaleV) {
				p.scaleV += (1 - p.scale) * k;
				p.scaleV *= par.damp;
				p.scale += p.scaleV;
			}
			if (p.rot || p.rotV) {
				p.rotV += (0 - p.rot) * k;
				p.rotV *= par.damp;
				p.rot += p.rotV;
			}

			if (fx.tick) fx.tick(p, t);

			if (pAlpha <= 0.004) continue;
			const r = p.size * (p.scale > 0 ? p.scale : 0) * 0.5;
			if (r <= 0) continue;
			glowDot(p.x, p.y, r, p.color, p.alpha * pAlpha, 0.08 + 0.12 * pulse);
		}
		ctx.globalAlpha = 1;

		if (fx.overlay) fx.overlay(t);

		if (nameLayer && hold > 0.004) {
			/* brilho do nome montado: contínuo (pulsante) + flash na montagem */
			const ng = hold * (0.32 + 0.28 * pulse) + glowFlash * 0.75;
			const ga = Math.min(0.7, 0.5 * ng);
			ctx.save();
			ctx.shadowColor = 'rgba(' + (glowRGB[0] | 0) + ', ' + (glowRGB[1] | 0) + ', ' + (glowRGB[2] | 0) + ', ' + ga.toFixed(3) + ')';
			ctx.shadowBlur = 22 * Math.min(1.4, ng);
			ctx.globalAlpha = hold;
			ctx.drawImage(nameLayer, 0, 0, W, H);
			ctx.restore();
		}
		drawHover();
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
		for (const p of particles) p.color = nameColorAt(p.ty / H);
		if (nameLayerCtx) paintName(nameLayerCtx);
	}).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

	if (reduce.addEventListener) reduce.addEventListener('change', activate);
	else if (reduce.addListener) reduce.addListener(activate);

	if ('IntersectionObserver' in window) {
		new IntersectionObserver(es => {
			for (const e of es) visible = e.isIntersecting;
		}, { threshold: 0 }).observe(canvas);
	}
	document.addEventListener('visibilitychange', () => { visible = !document.hidden; });

	canvas.addEventListener('pointermove', handleMove, { passive: true });
	canvas.addEventListener('pointerdown', e => { handleMove(e); startEffect(cur + 1); });
	canvas.addEventListener('pointerleave', () => { lastPt = null; });

	/* ---------- início ---------- */
	activate();
	if (document.fonts && document.fonts.ready) {
		Promise.resolve(document.fonts.load ? document.fonts.load(WEIGHT + ' 64px ' + FAMILY) : null)
			.catch(() => {})
			.then(() => document.fonts.ready)
			.then(() => { if (!reduce.matches) activate(); });
	}
})();
