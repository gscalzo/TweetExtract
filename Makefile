SHELL := /bin/bash
.DEFAULT_GOAL := run

PNPM := $(shell command -v pnpm 2>/dev/null)
PKG_MANAGER := $(if $(PNPM),pnpm,npm)

ARGS ?=

.PHONY: install test run bookmarks

install:
	@echo "[info] Installing dependencies with $(PKG_MANAGER)..."
	@if [ "$(PKG_MANAGER)" = "pnpm" ]; then \
		pnpm install; \
	else \
		npm install; \
	fi

test: install
	@echo "[info] Running tests with $(PKG_MANAGER)..."
	@if [ "$(PKG_MANAGER)" = "pnpm" ]; then \
		pnpm test; \
	else \
		npm test; \
	fi

run: install
	@echo "[info] Running tweet-extract with $(PKG_MANAGER)..."
	@if [ "$(PKG_MANAGER)" = "pnpm" ]; then \
		pnpm dev -- $(ARGS); \
	else \
		npm run dev -- $(ARGS); \
	fi

bookmarks: install
	@$(MAKE) run ARGS="bookmarks $(ARGS)"
