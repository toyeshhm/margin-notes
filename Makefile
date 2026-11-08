.PHONY: lint test check

lint:
	npm run lint && npm run typecheck

test:
	npm test && npm run build && npm run playtest

check: lint test
