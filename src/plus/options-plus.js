// Director's Cut: settings page extras (loaded after options.js).
// Adds a search box that filters settings, and highlights the nav item for the section in view.
// Doesn't touch options.js; its nav click handler needs className === 'nav-item', so state lives in aria-current.

(() => {
	const nav = document.querySelector('.topnav');
	const sections = [...document.querySelectorAll('body > div[id]')].filter(section => section.querySelector(':scope > h3'));
	if (!nav || !sections.length) return;

	// --- Search ---
	const search = document.createElement('input');
	search.type = 'search';
	search.className = 'dc-search';
	search.placeholder = 'Search settings';
	search.setAttribute('aria-label', 'Search settings');
	nav.prepend(search);

	const noResults = document.createElement('p');
	noResults.className = 'dc-no-results';
	noResults.textContent = 'No settings match.';
	sections[0].before(noResults);

	// A "row" is a div holding a label + control; its group is the nearest div with an h4
	const rows = sections.flatMap(section => [...section.querySelectorAll('div')].filter(div => div.querySelector(':scope > label')));
	const rowText = row => {
		const group = row.closest('div:has(> h4)');
		const section = row.closest('body > div[id]');
		return [row.textContent, group?.querySelector(':scope > h4')?.textContent, section?.querySelector(':scope > h3')?.textContent]
			.join(' ').toLowerCase();
	};
	const index = rows.map(row => ({ row, text: rowText(row) }));

	search.addEventListener('input', () => {
		const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
		document.body.classList.toggle('dc-searching', terms.length > 0);
		for (const { row, text } of index) {
			row.classList.toggle('dc-hidden', terms.length > 0 && !terms.every(term => text.includes(term)));
		}
		let anyVisible = false;
		for (const section of sections) {
			// Hide groups and sections left with no visible rows (but never hide a row's own parent row)
			for (const group of section.querySelectorAll('div:has(> h4)')) {
				const visible = [...group.querySelectorAll('div:has(> label)')].some(row => !row.classList.contains('dc-hidden'));
				group.classList.toggle('dc-hidden', terms.length > 0 && !visible);
			}
			const visible = [...section.querySelectorAll('div:has(> label)')].some(row => !row.closest('.dc-hidden'));
			section.classList.toggle('dc-hidden', terms.length > 0 && !visible);
			anyVisible ||= visible;
		}
		noResults.classList.toggle('dc-show', terms.length > 0 && !anyVisible);
		if (terms.length) window.scrollTo({ top: 0 });
	});

	// --- Active section in the nav ---
	const navItems = new Map([...nav.querySelectorAll('.nav-item')].map(item => [item.getAttribute('sectionId'), item]));
	for (const item of navItems.values()) {
		item.setAttribute('role', 'link');
		item.tabIndex = 0;
		item.addEventListener('keydown', event => { if (event.key === 'Enter') item.click(); });
	}
	const observer = new IntersectionObserver(entries => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			for (const [id, item] of navItems) item.setAttribute('aria-current', String(id === entry.target.id));
		}
	}, { rootMargin: '0px 0px -70% 0px' });
	for (const section of sections) observer.observe(section);
})();
