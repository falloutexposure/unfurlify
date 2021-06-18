addEventListener('fetch', event => {
	try {
		event.respondWith(handleRequest(event.request));
	} catch (error) {
		event.respondWith(renderJson(null, `Internal Error - ${error.message || error.name || error.toString()}`, 500));
	}
});

function renderJson(data, error = null, status = 200) {
	return new Response(JSON.stringify({data: data, error: error}, null, ' ') + "\n", {status: status, headers: {
		'Access-Control-Allow-Origin': '*',
		'Content-Type': 'application/json; charset=UTF-8',
		'X-Unfurlify-Environment': ENVIRONMENT,
		'X-Unfurlify-Version': '1.1'
	}});
}

function handleRequest(request) {
	const url = new URL(request.url);
	if (request.method == 'GET' && url.pathname == '/api') {
		return unfurl(url.searchParams.get('url')).then(metadata => renderJson(metadata)).catch(error => renderJson(null, error.message, 400));
	} else {
		throw new Error('INVALID_API_ENDPOINT');
	}
}

function unfurl(url) {
	try {
		if (!url || !['http:', 'https:'].includes(new URL(url).protocol)) throw true;
	} catch {
		return Promise.reject(new Error('INVALID_URL'));
	}
	return fetch(url, {
		headers: {
			'Accept': 'text/html,application/xhtml+xml,application/xml',
			'Accept-Language': 'en-US,en'
		}
	}).then(response => {
		// console.log(JSON.stringify([...response.headers]));
		if (response.ok) {
			if (!response.headers.get('Content-Type').includes('html')) throw new Error('UNSUPPORTED_CONTENT_TYPE');
			return parse(response).then(generate);
		} else {
			if (response.status == 404) throw new Error('NOT_FOUND');
			throw new Error('AN_UNEXPECTED_ERROR_OCCURRED');
		}
	});
}

function parse(response) {
	const parser = new HTMLRewriter(), metadata = {
		type: 'website',
		hostname: (new URL(response.url)).hostname.replace('www.', ''),
		title: null,
		description: null,
		favicon: null,
		image: null,
		video: null,
		fallback: {},
		url: response.url
	};
	parsers['opengraph'](parser, metadata);
	parsers['heuristic'](parser, metadata.fallback);
	if (parsers[metadata.hostname]) parsers[metadata.hostname](parser, metadata);
	return parser.transform(response).text().then(() => metadata);
}

const parsers = {
	opengraph(parser, metadata) {
		parser.on('meta[property="og:title"]', { element(element) {
			metadata.title = element.getAttribute('content');
		}}).on('meta[property="og:description"]', { element(element) {
			metadata.description = element.getAttribute('content');
		}}).on('meta[property="og:image"]', { element(element) {
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
			fallback.favicon ||= element.getAttribute('href');
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
};

function generate(metadata) {
	return new Promise((resolve, reject) => {
		for (let key in metadata) metadata[key] ||= metadata.fallback[key] || null;
		delete metadata.fallback;
		if (metadata.favicon && metadata.favicon.indexOf('://') == -1) metadata.favicon = [new URL(metadata.url).origin, metadata.favicon].join(metadata.favicon.charAt(0) == '/' ? '' : '/');
		resolve(metadata);
	});
}
