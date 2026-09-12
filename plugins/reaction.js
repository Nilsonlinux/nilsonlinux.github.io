// plugins/reaction.js — botão de joinha (👍) sem consumir a API do GitHub.
//
// A contagem oficial vem de data/reactions.json, um arquivo estático gerado
// pelo workflow "Update reaction counts" (cron 30min + manual). O navegador
// apenas lê esse JSON — zero chamadas à API.
//
// Comportamento do clique: incrementa o contador com efeito + abre a issue
// no GitHub para registrar o joinha de verdade. Cada navegador soma apenas
// 1 por sessão (sessionStorage); as próximas curtidas da issue aparecem no
// próximo refresh do JSON (este arquivo é relido a cada 60s).
(() => {
	const $ = (s, el = document) => el.querySelector(s);
	const username = 'Nilsonlinux';
	const repo = 'noctalia-plugins';
	const seg = location.pathname.split('/').filter(Boolean);
	if (seg[seg.length - 1] === 'index.html') seg.pop();
	const isPluginPage = seg[0] === 'plugins';
	const base = isPluginPage ? '../../' : '';
	const folder = isPluginPage ? seg[1] : '';
	const reactionsUrl = `${base}data/reactions.json`;

	let reactions = {};

	function folderFrom(el) {
		return el.dataset.folder || folder;
	}

	function issueUrl(f, entry) {
		if (entry && entry.issue) {
			return `https://github.com/${username}/${repo}/issues/${entry.issue}`;
		}
		return `https://github.com/${username}/${repo}/issues?q=is%3Aissue+${encodeURIComponent(f)}`;
	}

	function word(count) { return count === 1 ? ' joinha' : ' joinhas'; }

	function setCount(el, count, entry) {
		const n = el.querySelector('[data-likes]');
		const w = el.querySelector('[data-likes-word]');
		if (n) n.textContent = count;
		if (w) w.textContent = word(count);
		el.href = issueUrl(el.dataset.folder || folder, entry);
	}

	function updateTotals() {
		const totalEls = document.querySelectorAll('[data-total-likes]');
		const buttons = document.querySelectorAll('[data-reaction]');
		if (!totalEls.length || !buttons.length) return;
		let total = 0;
		buttons.forEach(el => {
			const n = parseInt((el.querySelector('[data-likes]') || {}).textContent || '0', 10);
			total += n;
		});
		totalEls.forEach(t => { t.textContent = total; });
	}

	function burst(el) {
		const icon = document.createElement('span');
		icon.className = 'burst-icon';
		icon.textContent = '👍';
		el.appendChild(icon);
		el.classList.add('burst');
		icon.addEventListener('animationend', () => { icon.remove(); el.classList.remove('burst'); });
	}

	async function load() {
		try {
			const r = await fetch(`${reactionsUrl}?t=${Date.now()}`, { cache: 'no-store' });
			if (r.ok) reactions = (await r.json()).reactions || {};
		} catch { /* JSON ainda não gerado */ }
		document.querySelectorAll('[data-reaction]').forEach(el => {
			const entry = reactions[el.dataset.folder || folder] || {};
			const nEl = el.querySelector('[data-likes]');
			const cur = parseInt((nEl || {}).textContent || '0', 10);
			setCount(el, Number(entry.likes ?? cur), entry);
		});
		updateTotals();
	}

	function onClick(e) {
		const el = e.target.closest('[data-reaction]');
		if (!el) return;
		e.preventDefault();
		const f = folderFrom(el);
		const entry = reactions[f] || {};
		let count = parseInt((el.querySelector('[data-likes]') || {}).textContent || '0', 10);

		if (!sessionStorage.getItem('liked:' + f)) {
			sessionStorage.setItem('liked:' + f, '1');
			count += 1;
		}
		setCount(el, count, entry);
		updateTotals();
		burst(el);

		const url = issueUrl(f, entry);
		if (url) window.open(url, '_blank', 'noopener');
	}

	document.addEventListener('click', onClick);
	load();
	setInterval(load, 60000);
})();