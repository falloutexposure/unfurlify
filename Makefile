.DEFAULT_GOAL := default
.PHONY: default setup site deploy test

default:
	until wrangler dev; do sleep 1; done

setup:
	wrangler secret put B2_APPLICATION_KEY
	wrangler secret put --env production B2_APPLICATION_KEY

site:
	(cd public/; python3 -m http.server 8000)

deploy:
	git add public/*
	git commit -m 'site updated' >/dev/null || true
	git push origin main
	wrangler publish --env production

test:
	curl -v 'http://127.0.0.1:8001/api?url=https%3A%2F%2Fexample.com%2F&cache=no'
# 	curl -v 'http://127.0.0.1:8001/api?url=https%3A%2F%2Fwww.taylorswift.com%2F&cache=no'
# 	curl -v 'http://127.0.0.1:8001/api?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dz5iK8D-5T8s'
