// Director's Cut: shared helpers for the features in src/plus/.
// Loaded before every other plus/ script (see manifest content_scripts).
// Kept separate from Letterboxd Extras' code so upstream merges stay clean.

/* exported DC */
const DC = (() => {
	const ext = typeof browser !== 'undefined' ? browser : chrome;

	// --- Proxy client: TMDB via vinciamo (key lives on the server) ---
	const PROXY_URL = 'https://vinciamomedia.com/pages/directors-cut-api/';
	const IMAGE_BASE = 'https://image.tmdb.org/t/p';
	const memo = new Map();

	function tmdb(path, params = {}) {
		const query = new URLSearchParams({ path, ...params });
		const url = `${PROXY_URL}?${query}`;
		if (!memo.has(url)) {
			memo.set(url, fetch(url, { credentials: 'omit' }).then(res => {
				if (!res.ok) throw new Error(`TMDB proxy ${res.status}`);
				return res.json();
			}).catch(err => {
				memo.delete(url);
				throw err;
			}));
		}
		return memo.get(url);
	}

	// --- Settings: stored in Letterboxd Extras' sync "options" object ---
	// Every Director's Cut key starts with "dc-"; missing keys fall back to DEFAULTS.
	const DEFAULTS = {
		'dc-extras-enabled': true,
		'dc-extras-unofficial': false,
		'dc-photos-enabled': true,
		'dc-photos-cast-hover': true,
		'dc-photos-person': true,
		'dc-photos-search': true,
		'dc-commonsense-enabled': true,
	};
	let settingsPromise = null;

	function settings() {
		if (!settingsPromise) {
			settingsPromise = ext.storage.sync.get('options')
				.then(data => ({ ...DEFAULTS, ...(data?.options ?? {}) }))
				.catch(() => ({ ...DEFAULTS }));
		}
		return settingsPromise;
	}

	async function enabled(key) {
		return (await settings())[key] === true;
	}

	// --- Page helpers ---
	function filmTmdbId() {
		const el = document.querySelector('[data-tmdb-type="movie"][data-tmdb-id]');
		return el ? el.getAttribute('data-tmdb-id') : null;
	}

	function isFilmPage() {
		return /^\/film\/[^/]+\/?$/.test(location.pathname);
	}

	function el(tag, attrs = {}, children = []) {
		const node = document.createElement(tag);
		for (const [name, value] of Object.entries(attrs)) {
			if (name === 'text') node.textContent = value;
			else if (name.startsWith('on')) node.addEventListener(name.slice(2), value);
			else node.setAttribute(name, value);
		}
		for (const child of [].concat(children)) {
			if (child) node.append(child);
		}
		return node;
	}

	// Run fn once the selector exists (Letterboxd loads some sections late).
	function whenPresent(selector, fn, timeoutMs = 8000) {
		const found = document.querySelector(selector);
		if (found) return fn(found);
		const observer = new MutationObserver(() => {
			const match = document.querySelector(selector);
			if (match) {
				observer.disconnect();
				fn(match);
			}
		});
		observer.observe(document.documentElement, { childList: true, subtree: true });
		setTimeout(() => observer.disconnect(), timeoutMs);
	}

	return { ext, tmdb, IMAGE_BASE, settings, enabled, filmTmdbId, isFilmPage, el, whenPresent };
})();
