const userAgents = {
	bot: 'Mozilla/5.0 (compatible; Googlebot/2.1)',
 	desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
	hybrid: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0 Twitterbot/1.0'
}, sitesPreferences = {
	'reddit.com': {userAgent: 'desktop'}
}, htmlParsers = {
	opengraph(parser, metadata) {
		parser.on('meta[property="og:title"]', { element(element) {
			metadata.title = element.getAttribute('content');
		}}).on('meta[property="og:description"]', { element(element) {
			metadata.description = element.getAttribute('content');
		}}).on('meta[property="og:image"]', { element(element) {
			metadata.fallback.image = element.getAttribute('content');
		}});
	},
	twitterCard(parser, metadata) {
		parser.on('meta[property="twitter:title"], meta[name="twitter:title"]', { element(element) {
			metadata.title ||= element.getAttribute('content');
		}}).on('meta[property="twitter:description"], meta[name="twitter:description"]', { element(element) {
			metadata.description ||= element.getAttribute('content');
		}}).on('meta[property="twitter:image"], meta[name="twitter:image"]', { element(element) {
			metadata.image = element.getAttribute('content');
		}});
	},
	heuristic(parser, fallback) {
		parser.on('title', { text(chunk) {
			if (!fallback.title) fallback.title = '';
			fallback.title += chunk.text;
		}}).on('meta[name="description"]', { element(element) {
			fallback.description = element.getAttribute('content');
		}}).on('link[rel$="icon"]', { element(element) {
			const href = element.getAttribute('href'), size = Number((element.getAttribute('sizes') || '').split('x')[0]);
			if (/(.ico|.jpe?g|.png)$/i.test(href)) {
				fallback.favicon ||= href;
				if (size >= 32 && size <= 76) fallback.favicon = href;
			}
		}});
	},
	'youtube.com'(parser, metadata) {
		metadata.type = 'video';
		parser.on('link[rel="image_src"]', { element(element) {
			metadata.fallback.image = element.getAttribute('href');
		}}).on('meta[property="og:video:url"]', { element(element) {
			metadata.video = element.getAttribute('content');
		}});
	}
}, toFullUrl = function(value, base) {
	value = (value || '').replace(/&amp;/g, '&');
	if (/^\/\//.test(value)) return `${base.protocol}${value}`;
	if (!/^https?:\/\//.test(value)) return [base.origin, value].join(value.charAt(0) == '/' ? '' : '/');
	return value;
};

addEventListener('fetch', event => {
	try {
		event.respondWith(handleRequest(event));
	} catch (error) {
		event.respondWith(renderJson(null, `Internal Error - ${error.message || error.name || error.toString()}`, 500));
	}
});

function renderJson(data, error = null, status = 200) {
	return new Response(JSON.stringify({data: data, error: error}, null, ' ') + "\n", {status: status, headers: {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'application/json; charset=UTF-8',
		'Cache-Control': 's-maxage=3600',
		'X-Unfurlify-Environment': ENVIRONMENT,
		'X-Unfurlify-Version': '1.2'
	}});
}

function handleRequest(event) {
	const url = new URL(event.request.url);
	if (event.request.method == 'GET' && url.pathname == '/api') {
		const cacheKey = `https://unfurlify.cache/${url.search}`, byPassCache = url.searchParams.get('cache') == 'no';
		// console.log('[handleRequest] cacheKey', cacheKey);
		return caches.default.match(cacheKey).then(cache => {
			if (cache && !byPassCache) {
				return cache;
			} else {
				return unfurl(url.searchParams.get('url')).then(metadata => {
					const response = renderJson(metadata);
					if (!byPassCache) event.waitUntil(caches.default.put(cacheKey, response.clone()));
					return response;
				}).catch(error => renderJson(null, error.message, 400));
			}
		});
	} else {
		throw new Error('INVALID_API_ENDPOINT');
	}
}

function unfurl(url) {
	try {
		console.log('[unfurl]', url);
		url = new URL(url);
		if (!url || !['http:', 'https:'].includes(url.protocol)) throw true;
	} catch {
		return Promise.reject(new Error('INVALID_URL'));
	}
	const sitePreferences = sitesPreferences[Object.keys(sitesPreferences).find(site => site == url.origin || url.origin.endsWith(`.${site}`))];
	return fetchHtml(url, sitePreferences);
}

function fetchHtml(url, sitePreferences = null) {
	return fetch(url, {
		headers: {
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			'Accept-Language': 'en-US,en;q=0.5',
			'User-Agent': (sitePreferences) ? userAgents[sitePreferences.userAgent] : userAgents.hybrid
		}
	}).then(response => {
		// console.log('[unfurl] response.status', response.status);
		// console.log('[unfurl]', JSON.stringify([...response.headers]));
		if (response.ok) {
			if (!response.headers.get('Content-Type').includes('html')) throw new Error('UNSUPPORTED_CONTENT_TYPE');
			return parseHtml(url, response).then(generate);
		} else {
			if (response.status == 404) throw new Error('NOT_FOUND');
			throw new Error(`AN_UNEXPECTED_ERROR_OCCURRED - ${response.status}`);
		}
	});
}

function parseHtml(url, response) {
	const parser = new HTMLRewriter(), metadata = {
		type: 'website',
		hostname: url.hostname.replace('www.', ''),
		title: null,
		description: null,
		favicon: null,
		image: null,
		video: null,
		fallback: {},
		url: url
	};
	htmlParsers['opengraph'](parser, metadata);
	htmlParsers['twitterCard'](parser, metadata);
	htmlParsers['heuristic'](parser, metadata.fallback);
	if (htmlParsers[metadata.hostname]) htmlParsers[metadata.hostname](parser, metadata);
	return parser.transform(response).text().then(() => metadata);
}

function generate(metadata) {
	return new Promise((resolve, reject) => {
		for (let key in metadata) metadata[key] ||= metadata.fallback[key] || null;
		delete metadata.fallback;
		if (metadata.image) metadata.image = toFullUrl(metadata.image, metadata.url);
		if (metadata.favicon) {
			metadata.favicon = toFullUrl(metadata.favicon, metadata.url);
			resolve(metadata);
		} else {
			fetch(`${metadata.url.origin}/favicon.ico`).then(response => {
				if (response.ok) metadata.favicon = response.url;
			}).finally(() => resolve(metadata));
		}
	});
}
