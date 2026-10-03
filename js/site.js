/* ============================================================
   NLinux · variáveis compartilhadas do site

   DADOS DA ÚLTIMA ISO — fonte única da verdade.
   Publicou uma ISO nova? Troque SOMENTE as três linhas abaixo
   (link, data e sha256). Todo elemento marcado no HTML com
   [data-iso-download], [data-iso-date] ou [data-iso-sha256] recebe
   o valor via JS:

     · [data-iso-download] → href do botão de baixar
     · [data-iso-date]     → data da ISO, formatada em pt-BR
     · [data-iso-sha256]   → hash sha256 da mesma ISO

   O sha256 tem de ser o do MESMO arquivo que o link aponta. Ele sai
   do build local:  sha256sum iso/out/nlinux-<data>-x86_64.iso
   Se a ISO foi re-gerada depois de publicada, o hash muda e o link
   precisa ir para o arquivo novo — conferir um hash velho contra um
   arquivo novo dá erro e derruba a confiança no resto da página.

   O conteúdo no HTML é só a reserva para quando o JS não carrega:
   nunca aponta para um arquivo ou uma data desatualizada.
   ============================================================ */
const NLINUX_ISO_URL = 'https://drive.google.com/file/d/17m7E-nJyaV51c-vTzITPII-6noAaBH1J/view?usp=sharing';
const NLINUX_ISO_DATE = '2026-09-30';
const NLINUX_ISO_SHA256 = 'cd2eb81f96b9a7682f89483e39b3f40e80ff42c434c7db66c0feefdfd1c34eba';

document.querySelectorAll('[data-iso-download]').forEach(link => {
	link.href = NLINUX_ISO_URL;
});

/* "2026-09-29" → "segunda-feira, 29 de setembro de 2026". A data é montada
   na mão (ano/mês/dia) para o fuso não escorregar para o dia anterior. */
const isoDateBr = iso => {
	const [y, m, d] = String(iso).split('-').map(Number);
	if (!y || !m || !d) return iso;
	return new Intl.DateTimeFormat('pt-BR', {
		weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
	}).format(new Date(y, m - 1, d));
};

document.querySelectorAll('[data-iso-date]').forEach(el => {
	el.textContent = isoDateBr(NLINUX_ISO_DATE);
	el.setAttribute('datetime', NLINUX_ISO_DATE);
});

document.querySelectorAll('[data-iso-sha256]').forEach(el => {
	el.textContent = NLINUX_ISO_SHA256;
});

/* ============================================================
   CATÁLOGO DA NLINUX SOFTWARE
   A revisão, a contagem de apps e a de categorias saem do
   catalog-head.json publicado no repositório da loja:

     github.com/Nilsonlinux/nlinux-software/blob/main/catalog-head.json

   Não há nada de versão hardcoded no HTML: publicar um catálogo
   novo atualiza todas as páginas do site sem editar nada. No HTML
   os campos ficam como "…" e são preenchidos aqui.

   O catalog-head.json (143 B) vem sempre fresco; o catálogo
   completo (230 kB) só é baixado quando o sha1 muda e fica
   guardado no localStorage.
   ============================================================ */
(() => {
	const RAW = 'https://raw.githubusercontent.com/Nilsonlinux/nlinux-software/main/';
	const CACHE = 'nlinux-catalog-v1';
	const META = ['stats', 'distro', 'supported'];

	const paint = data => {
		document.querySelectorAll('[data-cat]').forEach(el => {
			const v = data[el.dataset.cat];
			if (v === undefined || v === null) return;
			el.textContent = el.dataset.cat === 'revision' ? 'v' + v : String(v);
		});
	};

	let cached = null;
	try { cached = JSON.parse(localStorage.getItem(CACHE) || 'null'); } catch {}
	if (cached) paint(cached);

	fetch(RAW + 'catalog-head.json', { cache: 'no-store' })
		.then(r => r.ok ? r.json() : null)
		.then(head => {
			if (!head || head.revision == null) return;
			if (cached && cached.sha === head.sha1 && cached.categories != null) { paint(cached); return; }
			const next = { revision: head.revision, apps: head.apps, sha: head.sha1 };
			return fetch(RAW + 'src/apps/applications-en.json')
				.then(r => r.ok ? r.json() : null)
				.then(cat => {
					if (cat) {
						next.categories = Object.keys(cat)
							.filter(k => !META.includes(k) && cat[k] && typeof cat[k] === 'object').length;
						try { localStorage.setItem(CACHE, JSON.stringify(next)); } catch {}
					}
					paint(next);
				});
		})
		.catch(() => {});
})();

/* ============================================================
   ESTRELAS NO GITHUB

   A contagem sai da API pública do GitHub, sem token — e sem
   token o limite é de 60 requisições por hora por IP. Por isso o
   número fica no localStorage por 6 horas, e o HTML vem com "…"
   como reserva para quando o JS não carrega ou a cota acabou.

   Para exibir outro repositório, não mexa aqui: o nome vem do
   href do próprio link. Qualquer elemento com [data-gh="campo"]
   dentro de um <a href="https://github.com/…"> recebe o valor,
   e o [data-gh-label] vizinho vira "estrela"/"estrelas".
   ============================================================ */
(() => {
	const TTL = 6 * 60 * 60 * 1000;      // 6 horas
	const CACHE = 'nlinux-gh-v1';

	// "https://github.com/dono/repo/tree/main/x" → "dono/repo"
	const repoDo = link => link.getAttribute('href')
		.replace(/^https?:\/\/github\.com\//, '')
		.split(/[/?#]/).filter(Boolean).slice(0, 2).join('/');

	// agrupa por repositório para não repetir a chamada
	const grupos = new Map();
	document.querySelectorAll('[data-gh]').forEach(alvo => {
		const link = alvo.closest('a[href*="github.com/"]');
		if (!link) return;
		const repo = repoDo(link);
		if (!grupos.has(repo)) grupos.set(repo, []);
		grupos.get(repo).push(alvo);
	});

	let cache = {};
	try { cache = JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch {}

	const paint = (alvos, d) => alvos.forEach(alvo => {
		const n = d[alvo.dataset.gh];
		if (n == null) return;
		alvo.textContent = n.toLocaleString('pt-BR');
		const rotulo = alvo.parentElement.querySelector('[data-gh-label]');
		if (rotulo) rotulo.textContent = n === 1 ? 'estrela' : 'estrelas';
	});

	// 403/429 é cota esgotada (60/hora por IP sem token): vale tentar
	// mais uma vez depois. Qualquer outra falha é logada, senão o selo
	// fica no "…" e não dá para saber por quê.
	const buscar = (repo, restam) => fetch('https://api.github.com/repos/' + repo, {
		headers: { Accept: 'application/vnd.github+json' }
	}).then(r => {
		if (r.ok) return r.json();
		if ((r.status === 403 || r.status === 429) && restam) {
			console.warn('[site] GitHub: cota da API esgotada, nova tentativa em 30s');
			return new Promise(resolve => setTimeout(resolve, 30000))
				.then(() => buscar(repo, 0));
		}
		console.warn('[site] GitHub: resposta ' + r.status + ' para ' + repo);
		return null;
	});

	grupos.forEach((alvos, repo) => {
		const guardado = cache[repo];
		if (guardado && Date.now() - guardado.t < TTL) { paint(alvos, guardado.d); return; }

		buscar(repo, 1)
			.then(d => {
				if (!d || d.stargazers_count == null) return;
				const dados = {
					stargazers_count: d.stargazers_count,
					forks_count: d.forks_count,
					open_issues_count: d.open_issues_count
				};
				cache[repo] = { t: Date.now(), d: dados };
				try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch {}
				paint(alvos, dados);
			})
			.catch(e => console.warn('[site] GitHub: falha de rede em ' + repo, e));
	});
})();

/* ============================================================
   TOOLTIPS

   Troca o title nativo do navegador por um balão do tema. Não há
   um balão por elemento: cria-se UM só, no body, e ele é movido
   até o alvo. Por isso o custo é o mesmo com 3 ou com 30 tooltips.

   Aparece sem atraso de propósito — o title nativo só surge depois
   de ~1 s parado, o que faz o site parecer lento. Aqui a transição
   é de 80ms na opacidade, imperceptível.

   O title é guardado em data-tip e removido do elemento, senão os
   dois balões apareceriam juntos. Todo elemento que tem title já
   tem aria-label aqui, então o nome acessível não se perde.

   Como o balão é position:fixed com z-index alto, nenhum
   overflow:hidden do ancestral consegue cortá-lo.

   Aceita <b> dentro do texto para destacar em --accent.
   ============================================================ */
(() => {
	const el = document.createElement('div');
	el.className = 'nt';
	el.setAttribute('role', 'tooltip');
	el.hidden = true;
	document.body.appendChild(el);

	// 8px de folga para a borda não encostar na viewport
	const GAP = 8, SETA = 6;

	let alvoAtual = null;

	const suportaHover = matchMedia('(hover: hover) and (pointer: fine)');

	const mostrar = alvo => {
		const texto = alvo.dataset.tip;
		if (!texto) return;
		alvoAtual = alvo;
		el.innerHTML = texto;
		el.hidden = false;

		// media primeiro: dá a largura/altura real antes de posicionar
		const a = alvo.getBoundingClientRect();
		const t = el.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;

		// embaixo por padrão; se não couber, sobe
		let place = 'bottom';
		let top = a.bottom + SETA;
		if (top + t.height > vh - GAP) {
			place = 'top';
			top = a.top - t.height - SETA;
			// sem espaço acima também: fica embaixo, encostado na borda
			if (top < GAP) {
				place = 'bottom';
				top = Math.max(GAP, Math.min(a.bottom + SETA, vh - t.height - GAP));
			}
		}

		// centraliza no alvo e nunca deixa vazar das laterais
		let left = a.left + a.width / 2 - t.width / 2;
		left = Math.max(GAP, Math.min(left, vw - t.width - GAP));

		el.dataset.place = place;
		el.style.left = left + 'px';
		el.style.top = top + 'px';
		el.classList.add('on');
	};

	const esconder = () => {
		el.classList.remove('on');
		el.hidden = true;
		alvoAtual = null;
	};

	// delegation: um listener só, e funciona para conteúdo added depois
	document.addEventListener('pointerover', e => {
		if (!suportaHover.matches) return;
		const alvo = e.target.closest?.('[data-tip]');
		// pointer-events:none no balão faz ele nunca ser o alvo
		if (!alvo) return;
		if (alvo === alvoAtual) return;
		mostrar(alvo);
	});
	document.addEventListener('pointerout', e => {
		if (!alvoAtual) return;
		// relatedTarget preenchido = ainda está dentro do alvo (filho)
		if (e.relatedTarget && alvoAtual.contains(e.relatedTarget)) return;
		esconder();
	});
	// sem balão parado no ar quando a página rola ou redimensiona
	addEventListener('scroll', () => { if (alvoAtual) mostrar(alvoAtual); }, { passive: true });
	addEventListener('resize', () => { if (alvoAtual) mostrar(alvoAtual); });

	// converte os title existentes e tira o atributo
	document.querySelectorAll('[title]').forEach(n => {
		const t = n.getAttribute('title').trim();
		if (!t) return;
		n.dataset.tip = t;
		n.removeAttribute('title');
	});
})();
