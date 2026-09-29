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
const NLINUX_ISO_URL = 'https://drive.google.com/file/d/1ZYcKrgaz_z_o4JO5O_LyaeEyySESUAbY/view?usp=sharing';
const NLINUX_ISO_DATE = '2026-09-29';

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
