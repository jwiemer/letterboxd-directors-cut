// Director's Cut: TMDB calls for the Photos feature, routed through the vinciamo proxy.
// Ported from Letterboxd Photos' background.js (Enes Köse, MIT; see LICENSE in this folder).
// Same handlers and return shapes, so content.js only swaps chrome.runtime.sendMessage for DCPhotosApi.send.

/* exported DCPhotosApi */
const DCPhotosApi = (() => {
	const IMAGE_BASE = DC.IMAGE_BASE;

	function send(message) {
		if (message.type === 'FETCH_IMAGES') return handleFetchImages(message.imdbId);
		if (message.type === 'FETCH_PERSON_IMAGES') return handleFetchPersonImages(message.name, message.tmdbId);
		if (message.type === 'FETCH_PERSON_THUMB') return handleFetchPersonThumb(message.name, message.films);
		return Promise.resolve({ error: 'UNKNOWN' });
	}

	function dedupByPath(items) {
		const seen = new Set();
		return (items || []).filter(img => {
			if (seen.has(img.file_path)) return false;
			seen.add(img.file_path);
			return true;
		});
	}

	function normalizeName(s) {
		return (s || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '')
			.replace(/\s+/g, ' ')
			.trim();
	}

	async function handleFetchImages(imdbId) {
		try {
			const findData = await DC.tmdb(`find/${imdbId}`, { external_source: 'imdb_id' });
			const movie = findData.movie_results?.[0] || findData.tv_results?.[0];
			if (!movie) return { error: 'NOT_FOUND' };

			const mediaType = findData.movie_results?.length > 0 ? 'movie' : 'tv';
			const tmdbId = movie.id;

			const [imgData, creditsData] = await Promise.all([
				DC.tmdb(`${mediaType}/${tmdbId}/images`),
				DC.tmdb(`${mediaType}/${tmdbId}/credits`).catch(() => null),
			]);

			const formatList = (items, size) => items.slice(0, 24).map(img => `${IMAGE_BASE}/${size}${img.file_path}`);

			const backdrops = dedupByPath(
				(imgData.backdrops || [])
					.filter(img => img.iso_639_1 === null)
					.sort((a, b) => b.vote_average - a.vote_average)
			);

			const posters = dedupByPath(
				(imgData.posters || [])
					.filter(img => img.iso_639_1 === null || img.iso_639_1 === 'en')
					.sort((a, b) => b.vote_average - a.vote_average)
			);

			const cast = [];
			if (creditsData) {
				const seen = new Set();
				const addPerson = c => {
					const key = c.name?.toLowerCase();
					if (!key || seen.has(key)) return;
					seen.add(key);
					cast.push({ name: c.name, profile: c.profile_path ? `${IMAGE_BASE}/w185${c.profile_path}` : null });
				};
				(creditsData.cast || []).forEach(addPerson);
				(creditsData.crew || []).forEach(addPerson);
			}

			return {
				ok: true,
				title: movie.title || movie.name,
				tmdbId,
				backdrops: formatList(backdrops, 'original'),
				posters: formatList(posters, 'w780'),
				cast,
			};
		} catch {
			return { error: 'FETCH_FAILED' };
		}
	}

	async function handleFetchPersonThumb(name, films) {
		if (!name) return { error: 'NOT_FOUND' };
		try {
			const data = await DC.tmdb('search/person', { query: name, include_adult: 'true' });
			const results = data.results || [];
			const target = normalizeName(name);
			const exactNameMatches = results.filter(p => normalizeName(p.name) === target);

			let person = null;

			// 1) Film overlap is the strongest signal (works even for stage names).
			if (Array.isArray(films) && films.length) {
				const hints = new Set(films.map(normalizeName).filter(Boolean));
				person = results.find(p => (p.known_for || []).some(kf => {
					const t = kf.title || kf.name;
					return t && hints.has(normalizeName(t));
				}));
			}

			// 2) Otherwise trust a unique exact match, but only for multi-word names
			//    (single names like "Emma" are too ambiguous).
			if (!person && target.includes(' ') && exactNameMatches.length === 1) {
				person = exactNameMatches[0];
			}

			if (!person?.profile_path) return { ok: true, profile: null };
			return { ok: true, name: person.name, profile: `${IMAGE_BASE}/w185${person.profile_path}` };
		} catch {
			return { error: 'FETCH_FAILED' };
		}
	}

	async function handleFetchPersonImages(name, tmdbId) {
		if (!name && !tmdbId) return { error: 'NOT_FOUND' };
		try {
			let personId = tmdbId;
			let personName = name || null;

			if (!personId) {
				const searchData = await DC.tmdb('search/person', { query: name, include_adult: 'false' });
				const lowered = name.toLowerCase();
				const person = (searchData.results || []).find(p => p.name?.toLowerCase() === lowered) || searchData.results?.[0];
				if (!person) return { error: 'NOT_FOUND' };
				personId = person.id;
				personName = person.name;
			}

			const imgData = await DC.tmdb(`person/${personId}/images`);
			const profiles = dedupByPath((imgData.profiles || []).sort((a, b) => b.vote_average - a.vote_average))
				.slice(0, 24)
				.map(img => `${IMAGE_BASE}/original${img.file_path}`);

			return { ok: true, name: personName, tmdbId: personId, profiles };
		} catch {
			return { error: 'FETCH_FAILED' };
		}
	}

	return { send };
})();
