// Director's Cut: "Extras" carousel on film pages.
// Trailers, featurettes, behind the scenes, clips and bloopers from TMDB (official only by default),
// with tabs to filter by type. Clicking a video opens it in a modal player.

(() => {
	// --- Tabs: label → TMDB video types it includes (empty tabs are hidden) ---
	const TABS = [
		{ id: 'all', label: 'All', types: null },
		{ id: 'trailers', label: 'Trailers', types: ['Trailer', 'Teaser'] },
		{ id: 'bts', label: 'Behind the Scenes', types: ['Behind the Scenes'] },
		{ id: 'featurettes', label: 'Featurettes', types: ['Featurette'] },
		{ id: 'clips', label: 'Clips', types: ['Clip', 'Opening Credits'] },
		{ id: 'bloopers', label: 'Bloopers', types: ['Bloopers'] },
	];
	const TYPE_ORDER = ['Trailer', 'Teaser', 'Featurette', 'Behind the Scenes', 'Clip', 'Opening Credits', 'Bloopers'];

	async function init() {
		if (!DC.isFilmPage() || !(await DC.enabled('dc-extras-enabled'))) return;
		const tmdbId = DC.filmTmdbId();
		if (!tmdbId || document.querySelector('.dc-extras')) return;

		let data;
		try {
			data = await DC.tmdb(`movie/${tmdbId}/videos`, { language: 'en-US' });
		} catch {
			return; // Proxy paused or TMDB down: show nothing rather than an error
		}

		const includeUnofficial = await DC.enabled('dc-extras-unofficial');
		const videos = (data.results ?? [])
			.filter(v => v.site === 'YouTube' && v.key && (includeUnofficial || v.official))
			.sort((a, b) => rank(a) - rank(b) || (a.published_at ?? '').localeCompare(b.published_at ?? ''));
		if (!videos.length) return;

		placeSection(buildSection(videos));
	}

	function rank(video) {
		const index = TYPE_ORDER.indexOf(video.type);
		return index === -1 ? TYPE_ORDER.length : index;
	}

	// --- Section: heading, tabs, scrolling row of cards ---
	function buildSection(videos) {
		const row = DC.el('ul', { class: 'dc-row', role: 'list' });
		const tabs = DC.el('div', { class: 'dc-tabs', role: 'tablist', 'aria-label': 'Filter extras' });
		const arrows = buildArrows(row);

		const tabsInUse = TABS.filter(tab => !tab.types || videos.some(v => tab.types.includes(v.type)));
		for (const tab of tabsInUse) {
			const count = tab.types ? videos.filter(v => tab.types.includes(v.type)).length : videos.length;
			const button = DC.el('button', {
				type: 'button', role: 'tab', class: 'dc-tab', 'data-tab': tab.id, 'aria-selected': String(tab.id === 'all'),
				onclick: () => selectTab(tab),
			}, [DC.el('span', { text: tab.label }), DC.el('span', { class: 'dc-tab-count', text: String(count) })]);
			tabs.append(button);
		}
		// One tab besides "All" means the tabs add nothing
		if (tabsInUse.length <= 2) tabs.hidden = true;

		function selectTab(tab) {
			for (const button of tabs.children) button.setAttribute('aria-selected', String(button.dataset.tab === tab.id));
			row.replaceChildren(...videos.filter(v => !tab.types || tab.types.includes(v.type)).map(buildCard));
			row.scrollLeft = 0;
			arrows.update();
		}

		const section = DC.el('section', { class: 'section dc-extras', 'aria-label': 'Extras' }, [
			DC.el('h2', { class: 'section-heading', text: 'Extras' }),
			tabs,
			DC.el('div', { class: 'dc-row-wrap' }, [arrows.left, row, arrows.right]),
			DC.el('p', { class: 'dc-credit' }, [
				'Videos via ', DC.el('a', { href: `https://www.themoviedb.org/movie/${DC.filmTmdbId()}/videos`, target: '_blank', rel: 'noopener', text: 'TMDB' }),
			]),
		]);
		selectTab(TABS[0]);
		return section;
	}

	function buildCard(video) {
		const thumb = DC.el('img', {
			src: `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/mqdefault.jpg`,
			alt: '', loading: 'lazy', width: '320', height: '180',
		});
		return DC.el('li', { class: 'dc-card' }, [
			DC.el('button', { type: 'button', class: 'dc-card-button', 'aria-label': `Play ${video.name}`, onclick: () => openPlayer(video) }, [
				DC.el('span', { class: 'dc-thumb' }, [thumb, DC.el('span', { class: 'dc-play', 'aria-hidden': 'true' })]),
				DC.el('span', { class: 'dc-card-type', text: video.type }),
				DC.el('span', { class: 'dc-card-title', text: video.name }),
			]),
		]);
	}

	// Desktop arrows; touch screens just swipe the row
	function buildArrows(row) {
		const step = () => Math.max(row.clientWidth * 0.8, 200);
		const left = DC.el('button', { type: 'button', class: 'dc-arrow dc-arrow-left', 'aria-label': 'Scroll left', onclick: () => row.scrollBy({ left: -step(), behavior: 'smooth' }) });
		const right = DC.el('button', { type: 'button', class: 'dc-arrow dc-arrow-right', 'aria-label': 'Scroll right', onclick: () => row.scrollBy({ left: step(), behavior: 'smooth' }) });
		const update = () => {
			left.hidden = row.scrollLeft <= 4;
			right.hidden = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
		};
		row.addEventListener('scroll', update, { passive: true });
		window.addEventListener('resize', update);
		requestAnimationFrame(update);
		return { left, right, update };
	}

	// --- Modal player (same look as the Photos lightbox) ---
	function openPlayer(video) {
		const lastFocus = document.activeElement;
		const close = () => {
			modal.remove();
			document.removeEventListener('keydown', onKey);
			document.documentElement.classList.remove('dc-modal-open');
			lastFocus?.focus?.();
		};
		const onKey = event => { if (event.key === 'Escape') close(); };
		const closeButton = DC.el('button', { type: 'button', class: 'dc-modal-close', 'aria-label': 'Close', onclick: close, text: '×' });
		const modal = DC.el('div', { class: 'dc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': video.name }, [
			DC.el('div', { class: 'dc-modal-backdrop', onclick: close }),
			DC.el('div', { class: 'dc-modal-body' }, [
				closeButton,
				DC.el('div', { class: 'dc-player' }, [
					DC.el('iframe', {
						src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&playsinline=1`,
						title: video.name, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '',
					}),
				]),
				DC.el('p', { class: 'dc-modal-caption' }, [DC.el('strong', { text: video.type }), ` · ${video.name}`]),
			]),
		]);
		document.body.append(modal);
		document.documentElement.classList.add('dc-modal-open');
		document.addEventListener('keydown', onKey);
		closeButton.focus();
	}

	// --- Placement: above "Activity from friends", else above reviews ---
	function placeSection(section) {
		const friends = findFriendsSection();
		const reviews = document.querySelector('section.film-recent-reviews, section.js-popular-reviews');
		const anchor = friends ?? reviews;
		if (anchor) anchor.before(section);
		else document.querySelector('.col-main')?.append(section);

		// Friends' activity can load after us; move above it when it shows up
		if (!friends) {
			const observer = new MutationObserver(() => {
				const late = findFriendsSection();
				if (late && late.previousElementSibling !== section) {
					late.before(section);
					observer.disconnect();
				}
			});
			observer.observe(document.querySelector('.col-main') ?? document.body, { childList: true, subtree: true });
			setTimeout(() => observer.disconnect(), 10000);
		}
	}

	function findFriendsSection() {
		for (const heading of document.querySelectorAll('.col-main h2, .col-main .section-heading')) {
			if (/activity from friends/i.test(heading.textContent)) return heading.closest('section') ?? heading;
		}
		return null;
	}

	init();
})();
