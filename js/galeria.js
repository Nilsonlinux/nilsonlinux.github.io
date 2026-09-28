/* Galeria de telas do live e do instalador.
   Compartilhada entre a home (index.html) e a documentação (docs.html). */
(() => {
	const $ = s => document.querySelector(s);

	// o modal é criado aqui: as páginas só precisam do botão [data-lb-open]
	const MODAL = `	<div class="lb" id="lb" role="dialog" aria-modal="true" aria-labelledby="lbTitle" hidden>
		<div class="lb-top">
			<div class="lb-heading">
				<span class="lb-heading-icon"><i class="ti ti-device-desktop-analytics"></i></span>
				<div class="lb-titles">
					<p class="lb-title" id="lbTitle">NLinux · live e instalador</p>
					<p class="lb-subtitle">ISO ao vivo · instalador web em 10 passos</p>
				</div>
			</div>
			<div class="lb-top-actions">
				<span class="lb-counter"><b id="lbCurrent">1</b> / <span id="lbTotal">22</span></span>
				<a class="lb-btn" id="lbOpen" href="img/instalador/nlinux-instalador-01.jpg" target="_blank" rel="noopener noreferrer" aria-label="Abrir imagem em tamanho cheio" title="Abrir em tamanho cheio"><i class="ti ti-external-link"></i></a>
				<button type="button" class="lb-btn lb-close" id="lbClose" aria-label="Fechar galeria" title="Fechar (Esc)"><i class="ti ti-x"></i></button>
			</div>
		</div>

		<div class="lb-stage" id="lbStage">
			<button type="button" class="lb-nav lb-prev" id="lbPrev" aria-label="Foto anterior" title="Anterior (←)"><i class="ti ti-chevron-left"></i></button>
			<figure class="lb-frame" id="lbFrame">
				<img id="lbImage" alt="" />
			</figure>
			<button type="button" class="lb-nav lb-next" id="lbNext" aria-label="Próxima foto" title="Próxima (→)"><i class="ti ti-chevron-right"></i></button>
		</div>

		<div class="lb-bottom">
			<p class="lb-caption" id="lbCaption">Tela <b>1</b> de <b>22</b></p>
			<div class="lb-thumbs" id="lbThumbs" aria-label="Miniaturas das telas"></div>
			<p class="lb-hint"><kbd>←</kbd><kbd>→</kbd> navegar <span>·</span> <kbd>Esc</kbd> fechar <span>·</span> <kbd>Início</kbd>/<kbd>Fim</kbd> extremos</p>
		</div>
	</div>`;
	if (!document.getElementById('lb')) document.body.insertAdjacentHTML('beforeend', MODAL);

	// ---- Galeria de telas (lightbox) ----
	const GALLERY = Array.from({ length: 22 }, (_, i) => `img/instalador/nlinux-instalador-${String(i + 1).padStart(2, '0')}.jpg`);

	const lb = $('#lb');
	const lbStage = $('#lbStage');
	const lbFrame = $('#lbFrame');
	const lbImage = $('#lbImage');
	const lbThumbs = $('#lbThumbs');
	const lbCurrent = $('#lbCurrent');
	const lbCaption = $('#lbCaption');
	const lbPrev = $('#lbPrev');
	const lbNext = $('#lbNext');
	const lbClose = $('#lbClose');
	const lbOpenLink = $('#lbOpen');
	const pad = n => String(n).padStart(2, '0');
	let lbIndex = 0;
	let lbOpener = null;
	let lbTimer = 0;
	const preloaded = new Set();

	$('#lbTotal').textContent = GALLERY.length;
	lbCaption.innerHTML = `Tela <b>1</b> de <b>${GALLERY.length}</b>`;

	const preload = i => {
		if (i < 0 || i >= GALLERY.length || preloaded.has(i)) return;
		preloaded.add(i);
		const img = new Image();
		img.src = GALLERY[i];
	};

	// miniaturas
	GALLERY.forEach((src, i) => {
		const btn = document.createElement('button');
		btn.type = 'button';
		btn.className = 'lb-thumb';
		btn.setAttribute('aria-label', `Ver tela ${i + 1}`);
		btn.innerHTML = `<img src="${src}" alt="" loading="lazy" decoding="async" /><span class="lb-num">${pad(i + 1)}</span>`;
		btn.addEventListener('click', () => show(i));
		lbThumbs.appendChild(btn);
	});
	const lbThumbsItems = [...lbThumbs.children];

	function show(i) {
		lbIndex = (i + GALLERY.length) % GALLERY.length;
		const src = GALLERY[lbIndex];
		lbFrame.classList.add('swap', 'loading');
		lbImage.src = src;
		lbImage.alt = `NLinux — tela ${lbIndex + 1} de ${GALLERY.length} (live e instalador)`;
		lbOpenLink.href = src;
		lbCurrent.textContent = lbIndex + 1;
		lbCaption.innerHTML = `Tela <b>${pad(lbIndex + 1)}</b> de <b>${GALLERY.length}</b>`;
		lbThumbsItems.forEach((t, k) => {
			t.classList.toggle('active', k === lbIndex);
			if (k === lbIndex) t.setAttribute('aria-current', 'true');
			else t.removeAttribute('aria-current');
		});
		const active = lbThumbsItems[lbIndex];
		if (active) {
			const box = lbThumbs.clientWidth;
			const left = active.offsetLeft - (box - active.offsetWidth) / 2;
			lbThumbs.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
		}
		preload(lbIndex - 1);
		preload(lbIndex + 1);
	}

	lbImage.addEventListener('load', () => lbFrame.classList.remove('swap', 'loading'));
	lbImage.addEventListener('error', () => {
		lbFrame.classList.remove('loading');
		lbCaption.innerHTML = `Não foi possível carregar a tela ${pad(lbIndex + 1)}.`;
	});

	function openLb(i = 0, trigger = null) {
		clearTimeout(lbTimer);
		lbOpener = trigger || document.activeElement;
		lb.hidden = false;
		document.body.classList.add('lb-open');
		show(i);
		void lb.offsetWidth;
		lb.classList.add('open');
		focusClose(0);
	}

	// o Firefox resolve a visibilidade dos filhos um quadro depois do fade,
	// então o foco no botão de fechar só pega depois de alguns tentativas
	function focusClose(tentativas) {
		lbClose.focus({ preventScroll: true });
		if (document.activeElement !== lbClose && tentativas < 8) {
			lbTimer = setTimeout(() => focusClose(tentativas + 1), 40);
		}
	}

	function closeLb() {
		if (lb.hidden) return;
		lb.classList.remove('open');
		document.body.classList.remove('lb-open');
		clearTimeout(lbTimer);
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) lb.hidden = true;
		else lbTimer = setTimeout(() => { lb.hidden = true; }, 250);
		if (lbOpener && lbOpener.isConnected) lbOpener.focus({ preventScroll: true });
		lbOpener = null;
	}

	document.querySelectorAll('[data-lb-open]').forEach(btn => btn.addEventListener('click', () => openLb(0, btn)));
	lbClose.addEventListener('click', closeLb);
	lbPrev.addEventListener('click', () => show(lbIndex - 1));
	lbNext.addEventListener('click', () => show(lbIndex + 1));
	lb.addEventListener('click', e => {
		if (e.target === lb || e.target === lbStage) closeLb();
	});

	document.addEventListener('keydown', e => {
		if (lb.hidden) return;
		const key = e.key;
		if (key === 'Escape') { e.preventDefault(); closeLb(); }
		else if (key === 'ArrowLeft') { e.preventDefault(); show(lbIndex - 1); }
		else if (key === 'ArrowRight') { e.preventDefault(); show(lbIndex + 1); }
		else if (key === 'Home') { e.preventDefault(); show(0); }
		else if (key === 'End') { e.preventDefault(); show(GALLERY.length - 1); }
		else if (key === 'Tab') {
			const focusables = [...lb.querySelectorAll('button, a[href]')].filter(el => !el.disabled);
			if (!focusables.length) return;
			const first = focusables[0];
			const last = focusables[focusables.length - 1];
			if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
			else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
		}
	});

	// arrastar / swipe para trocar de foto
	let touchX = 0;
	let touchY = 0;
	lbStage.addEventListener('touchstart', e => {
		const t = e.changedTouches[0];
		touchX = t.clientX; touchY = t.clientY;
	}, { passive: true });
	lbStage.addEventListener('touchend', e => {
		const t = e.changedTouches[0];
		const dx = t.clientX - touchX;
		const dy = t.clientY - touchY;
		if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) show(lbIndex + (dx < 0 ? 1 : -1));
	}, { passive: true });
})();
