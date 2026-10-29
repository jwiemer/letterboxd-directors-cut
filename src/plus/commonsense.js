// Director's Cut: Common Sense Media button in the ratings sidebar.
// Link only: their terms (Site Terms of Use, section 7) forbid scraping or showing their content elsewhere,
// so we never fetch commonsensemedia.org. The film's page comes from Wikidata (P7091) when it's listed there;
// otherwise the button opens a Common Sense search for the title.

(() => {
	const CSM_BASE = 'https://www.commonsensemedia.org';

	async function init() {
		if (!DC.isFilmPage() || !(await DC.enabled('dc-commonsense-enabled'))) return;
		const tmdbId = DC.filmTmdbId();
		if (!tmdbId || document.querySelector('.dc-commonsense')) return;

		const href = (await wikidataLink(tmdbId)) ?? searchLink();
		DC.whenPresent('.sidebar .ratings-histogram-chart', () => placeSection(buildSection(href)));
	}

	// --- Link: Wikidata's Common Sense Media ID (P7091) by TMDB movie ID (P4947) ---
	async function wikidataLink(tmdbId) {
		const query = `SELECT ?csm WHERE { ?film wdt:P4947 "${tmdbId}". ?film wdt:P7091 ?csm } LIMIT 1`;
		try {
			const res = await fetch(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`, { credentials: 'omit' });
			if (!res.ok) return null;
			const id = (await res.json()).results?.bindings?.[0]?.csm?.value;
			// IDs are Common Sense node numbers; /node/<id> redirects to the review (Wikidata's formatter URL)
			return id && /^\d+$/.test(id) ? `${CSM_BASE}/node/${id}` : null;
		} catch {
			return null;
		}
	}

	function searchLink() {
		const title = document.querySelector('meta[property="og:title"]')?.content?.replace(/\s*\(\d{4}\)\s*$/, '')
			?? document.querySelector('h1')?.textContent?.trim() ?? '';
		return `${CSM_BASE}/search/${encodeURIComponent(title)}`;
	}

	// --- Section: same markup as Letterboxd Extras' rating sections ---
	function buildSection(href) {
		const isSearch = href.includes('/search/');
		const link = DC.el('a', { class: 'dc-csm-button', href, target: '_blank', rel: 'noopener' }, [
			DC.el('img', { src: `${CSM_BASE}/favicon.ico`, alt: '', width: '16', height: '16' }),
			DC.el('span', { text: isSearch ? 'Find age rating & parents guide' : 'Age rating & parents guide' }),
		]);
		return DC.el('section', { class: 'extras-section ratings-histogram-chart ratings-extras dc-commonsense' }, [
			DC.el('h2', { class: 'section-heading section-heading-extras' }, [
				DC.el('a', { href, target: '_blank', rel: 'noopener', text: 'Common Sense Media' }),
			]),
			link,
		]);
	}

	// Below Letterboxd Extras' ratings when present, else below Letterboxd's own
	function placeSection(section) {
		const holder = document.querySelector('.extras-ratings-holder');
		if (holder) holder.append(section);
		else {
			const charts = document.querySelectorAll('.sidebar .ratings-histogram-chart');
			charts[charts.length - 1]?.after(section);
		}
	}

	init();
})();
