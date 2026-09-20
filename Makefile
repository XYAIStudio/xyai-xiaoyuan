# Makefile for XYAI精灵小元
# Usage:
#   make              Show this help
#   make all          format + lint + typecheck + test
#   make check        lint + typecheck + test (CI, no auto-format)
#   make install-hooks  Point git to .githooks
#
# Prerequisites:
#   - Node.js LTS + npm
#   - Rust (rustup) + cargo
#   - Tauri platform deps: https://tauri.app/start/prerequisites/

SHELL := /bin/bash
.DEFAULT_GOAL := help

REPO_ROOT := $(shell pwd)
TAURI_DIR := $(REPO_ROOT)/src-tauri

.PHONY: help
help:
	@echo "XYAI精灵小元"
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "Development:"
	@echo "  install          npm install"
	@echo "  dev              npm run tauri dev"
	@echo "  mock             npm run mock:backends"
	@echo "  doctor           npm run doctor (probe localhost backends)"
	@echo "  live             print live 联调 URLs"
	@echo "  audio            generate original companion wavs"
	@echo "  build            npm run tauri build"
	@echo "  build-windows    print how to get NSIS from Actions"
	@echo ""
	@echo "Quality:"
	@echo "  all              format + lint + typecheck + test"
	@echo "  check            lint + typecheck + test (CI, no auto-format)"
	@echo "  lint             rust + frontend"
	@echo "  format           rust + frontend"
	@echo "  typecheck        tsc --noEmit + cargo check"
	@echo "  test             vitest + cargo test"

.PHONY: install
install:
	npm install

.PHONY: dev
dev:
	npm run tauri dev

.PHONY: mock
mock:
	npm run mock:backends

.PHONY: doctor
doctor:
	npm run doctor

.PHONY: live
live:
	npm run live

.PHONY: audio
audio:
	npm run audio:generate

.PHONY: build
build:
	npm run tauri build

.PHONY: build-windows
build-windows:
	@echo "Windows NSIS 请在 windows-latest 上构建：见 .github/workflows/windows.yml 与 docs/packaging-windows.md"
	@echo "本机若已安装 Windows 工具链：npx tauri build --bundles nsis"

.PHONY: test
test:
	npm test
	cd "$(TAURI_DIR)" && cargo test

.PHONY: coverage
coverage:
	npm run test:coverage

.PHONY: sync-version
sync-version:
	@test -n "$(VERSION)" || (echo "Usage: make sync-version VERSION=0.1.0" && exit 1)
	node scripts/sync-version.mjs $(VERSION)

.PHONY: typecheck
typecheck:
	npx tsc --noEmit
	cd "$(TAURI_DIR)" && cargo check

.PHONY: format-rust
format-rust:
	cd "$(TAURI_DIR)" && cargo fmt

.PHONY: lint-rust
lint-rust:
	@echo "[lint-rust] cargo fmt --check"
	cd "$(TAURI_DIR)" && cargo fmt --check
	@echo "[lint-rust] cargo clippy"
	cd "$(TAURI_DIR)" && cargo clippy -- -D warnings

.PHONY: format-frontend
format-frontend:
	npx prettier --write .

.PHONY: lint-frontend
lint-frontend:
	npx prettier --check .
	npm run lint

.PHONY: format-all
format-all: format-rust format-frontend

.PHONY: lint-all
lint-all: lint-rust lint-frontend

.PHONY: lint
lint: lint-all

.PHONY: format
format: format-all

.PHONY: all
all: format-all lint typecheck test

.PHONY: check
check: lint typecheck test

.PHONY: install-hooks
install-hooks:
	@echo "[install-hooks] Setting core.hooksPath=.githooks"
	git config core.hooksPath .githooks
	@chmod +x "$(REPO_ROOT)/.githooks/"* 2>/dev/null || true
	@echo "[install-hooks] Pre-commit runs: make all"

.PHONY: clean
clean:
	rm -rf dist coverage
	cd "$(TAURI_DIR)" && cargo clean
