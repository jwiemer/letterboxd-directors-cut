// Director's Cut: "Extras" carousel on film pages.
// Trailers, featurettes, behind the scenes, clips and bloopers from TMDB (official only by default),
// with Letterboxd-style tabs to filter by type. Clicking a video opens a player with prev/next
// and a strip of every video (with the same tabs) so you can move between videos and categories.

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

	const inTab = (tab, video) => !tab.types || tab.types.includes(video.type);
	const tabsFor = videos => TABS.filter(tab => !tab.types || videos.some(v => tab.types.includes(v.type)));

	// Letterboxd's native tab markup (.content-tab-filters > .tablist > button.trigger), so tabs,
	// hover and the selected underline look like CAST / CREW / DETAILS
	function buildTabs(tabs, selectedId, onSelect) {
		const tablist = DC.el('div', { class: 'tablist', role: 'tablist' });
		for (const tab of tabs) {
			tablist.append(DC.el('button', {
				type: 'button', class: 'trigger', role: 'tab', 'data-tab': tab.id, 'aria-selected': String(tab.id === selectedId),
				onclick: () => {
					for (const button of tablist.children) button.setAttribute('aria-selected', String(button.dataset.tab === tab.id));
					onSelect(tab);
				},
			}, [DC.el('span', { class: 'label', text: tab.label })]));
		}
		return DC.el('div', { class: 'content-tab-filters -no-divider dc-tab-filters' }, [tablist]);
	}

	// --- Section: heading, tabs, scrolling row of cards ---
	function buildSection(videos) {
		const row = DC.el('ul', { class: 'dc-row', role: 'list' });
		const arrows = buildArrows(row);
		const tabs = tabsFor(videos);
		let current = TABS[0];

		const showTab = tab => {
			current = tab;
			const list = videos.filter(v => inTab(tab, v));
			row.replaceChildren(...list.map((video, i) => buildCard(video, () => openPlayer(videos, tab.id, i))));
			row.scrollLeft = 0;
			arrows.update();
		};
		const tabBar = buildTabs(tabs, 'all', showTab);
		// One tab besides "All" means the tabs add nothing
		if (tabs.length <= 2) tabBar.hidden = true;

		const section = DC.el('section', { class: 'section dc-extras', 'aria-label': 'Extras' }, [
			DC.el('h2', { class: 'section-heading', text: 'Extras' }),
			tabBar,
			DC.el('div', { class: 'dc-row-wrap' }, [arrows.left, row, arrows.right]),
			DC.el('p', { class: 'dc-credit' }, [
				'Videos via ', DC.el('a', { href: `https://www.themoviedb.org/movie/${DC.filmTmdbId()}/videos`, target: '_blank', rel: 'noopener', text: 'TMDB' }),
			]),
		]);
		showTab(current);
		return section;
	}

	function thumbUrl(video) {
		return `https://i.ytimg.com/vi/${encodeURIComponent(video.key)}/mqdefault.jpg`;
	}

	function buildCard(video, onClick) {
		return DC.el('li', { class: 'dc-card' }, [
			DC.el('button', { type: 'button', class: 'dc-card-button', 'aria-label': `Play ${video.name}`, onclick: onClick }, [
				DC.el('span', { class: 'dc-thumb' }, [
					DC.el('img', { src: thumbUrl(video), alt: '', loading: 'lazy', width: '320', height: '180' }),
					DC.el('span', { class: 'dc-play', 'aria-hidden': 'true' }),
				]),
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

	// --- Player modal: video, prev/next, and a filmstrip with category tabs ---
	function openPlayer(videos, tabId, startIndex) {
		const lastFocus = document.activeElement;
		let tab = TABS.find(t => t.id === tabId) ?? TABS[0];
		let list = videos.filter(v => inTab(tab, v));
		let index = startIndex;

		const player = DC.el('div', { class: 'dc-player' });
		const caption = DC.el('p', { class: 'dc-modal-caption' });
		const counter = DC.el('span', { class: 'dc-modal-counter' });
		const strip = DC.el('ul', { class: 'dc-strip', role: 'list' });

		const play = i => {
			index = (i + list.length) % list.length;
			const video = list[index];
			player.replaceChildren(DC.el('iframe', {
				src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.key)}?autoplay=1&rel=0&playsinline=1`,
				title: video.name, allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowfullscreen: '',
			}));
			caption.replaceChildren(DC.el('strong', { text: video.type }), ` · ${video.name}`);
			counter.textContent = `${index + 1} / ${list.length}`;
			modal.setAttribute('aria-label', video.name);
			strip.querySelectorAll('.dc-strip-item').forEach((item, n) => item.setAttribute('aria-current', String(n === index)));
			strip.children[index]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
		};

		const fillStrip = () => {
			strip.replaceChildren(...list.map((video, n) => DC.el('li', { class: 'dc-strip-item' }, [
				DC.el('button', { type: 'button', class: 'dc-strip-button', title: video.name, 'aria-label': `Play ${video.name}`, onclick: () => play(n) }, [
					DC.el('img', { src: thumbUrl(video), alt: '', loading: 'lazy', width: '160', height: '90' }),
					DC.el('span', { class: 'dc-strip-title', text: video.name }),
				]),
			])));
		};

		const tabs = tabsFor(videos);
		const tabBar = buildTabs(tabs, tab.id, next => {
			tab = next;
			list = videos.filter(v => inTab(tab, v));
			fillStrip();
			play(0);
		});
		if (tabs.length <= 2) tabBar.hidden = true;

		const close = () => {
			modal.remove();
			document.removeEventListener('keydown', onKey);
			document.documentElement.classList.remove('dc-modal-open');
			lastFocus?.focus?.();
		};
		const onKey = event => {
			if (event.key === 'Escape') close();
			if (event.key === 'ArrowLeft') play(index - 1);
			if (event.key === 'ArrowRight') play(index + 1);
		};
		const closeButton = DC.el('button', { type: 'button', class: 'dc-modal-close', 'aria-label': 'Close', onclick: close, text: '×' });
		const modal = DC.el('div', { class: 'dc-modal', role: 'dialog', 'aria-modal': 'true' }, [
			DC.el('div', { class: 'dc-modal-backdrop', onclick: close }),
			DC.el('div', { class: 'dc-modal-body' }, [
				closeButton,
				DC.el('div', { class: 'dc-stage' }, [
					DC.el('button', { type: 'button', class: 'dc-stage-nav dc-stage-prev', 'aria-label': 'Previous video', onclick: () => play(index - 1) }),
					player,
					DC.el('button', { type: 'button', class: 'dc-stage-nav dc-stage-next', 'aria-label': 'Next video', onclick: () => play(index + 1) }),
				]),
				DC.el('div', { class: 'dc-modal-meta' }, [caption, counter]),
				tabBar,
				strip,
			]),
		]);
		document.body.append(modal);
		document.documentElement.classList.add('dc-modal-open');
		document.addEventListener('keydown', onKey);
		fillStrip();
		play(index);
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
			observer.observe(document.querySelector('#film-page-wrapper') ?? document.body, { childList: true, subtree: true });
			setTimeout(() => observer.disconnect(), 10000);
		}
	}

	// The friends section isn't always inside .col-main, so search the whole film page
	function findFriendsSection() {
		const root = document.querySelector('#film-page-wrapper') ?? document;
		for (const heading of root.querySelectorAll('h2, .section-heading')) {
			if (/activity from friends/i.test(heading.textContent)) return heading.closest('section') ?? heading.parentElement;
		}
		return null;
	}

	init();
})();
