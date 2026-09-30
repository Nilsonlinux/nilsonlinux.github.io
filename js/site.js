/* ============================================================
   NLinux · variáveis compartilhadas do site

   DADOS DA ÚLTIMA ISO — fonte única da verdade.
   Publicou uma ISO nova? Troque SOMENTE as duas linhas abaixo
   (link e data). Todo elemento marcado no HTML com
   [data-iso-download] ou [data-iso-date] recebe o valor via JS:

     · [data-iso-download] → href do botão de baixar
     · [data-iso-date]     → data da ISO, formatada em pt-BR

   O conteúdo no HTML é só a reserva para quando o JS não carrega:
   nunca aponta para um arquivo ou uma data desatualizada.
   ============================================================ */
const NLINUX_ISO_URL = 'https://drive.google.com/file/d/17m7E-nJyaV51c-vTzITPII-6noAaBH1J/view?usp=sharing';
const NLINUX_ISO_DATE = '2026-09-30';

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
