---
title: 'Web kiosk deployment through GHCR and Kubernetes'
type: 'refactor'
created: '2026-08-20'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ab3ceeab545c8fad7fae5e5fc3073828f1657b83'
context:
  - '{project-root}/_bmad-output/implementation-artifacts/spec-hybrid-market-wall.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** TickerDeck is packaged as a Tauri desktop application, so its live Binance/Yahoo data path and display controls cannot be deployed as a Kubernetes-hosted web service for a Raspberry Pi thin client.

**Approach:** Replace the Tauri/Rust runtime with a Node.js TypeScript service that serves the React production bundle and normalized market-data APIs from one container. Publish versioned images to GitHub Container Registry, deploy one replica to Kubernetes, and document Raspberry Pi Chromium kiosk startup.

## Boundaries & Constraints

**Always:** Preserve the existing eleven instruments, 6x2 ultrawide layout, Binance-for-crypto/Yahoo-for-US routing, independent quote/chart cache TTLs, request ordering, per-symbol failure isolation, last-good cached values, 1D/1M rotation, local browser settings, and visible stale status. Validate API symbols/ranges against an allowlist, apply upstream timeouts, expose health/readiness endpoints, run the container unprivileged, and use `ghcr.io/sushistack/ticker.deck` with immutable tag support.

**Ask First:** Introducing a database, paid market provider, authentication gateway, public Internet ingress, multiple application replicas, or pushing an image from the local machine.

**Never:** Call Binance or Yahoo directly from React, retain Tauri/Rust build dependencies or desktop-only UI controls, expose an arbitrary upstream proxy, commit credentials, use fabricated production data, or make tests depend on live market endpoints.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Live dashboard | Browser requests allowed mixed symbols | Node routes crypto to Binance and stocks to Yahoo while preserving request order | Only failed symbols are stale; cached successful values remain |
| Cached refresh | Same data requested inside its TTL | Cached snapshots are returned without duplicate upstream work | Expired refresh failure returns last good value marked stale |
| Invalid API request | Unknown symbol, invalid range, or oversized symbol list | API returns HTTP 400 without contacting an upstream | JSON error contains no internal stack or secret |
| Upstream outage | Binance or Yahoo times out/fails | Healthy provider results still render | Affected entries return stale/error state and retry on schedule |
| Container startup | Kubernetes probes service | `/healthz` and `/readyz` return success once the HTTP service can respond | Pod is restarted only after liveness failure |
| Pi reboot | Desktop session and network become available | Chromium opens the service URL in kiosk mode | Startup waits for health and Chromium restarts after failure |

</frozen-after-approval>

## Code Map

- `server/` -- TypeScript HTTP server, upstream adapters, validation, normalization, and in-memory cache.
- `shared/instruments.ts` -- single allowlisted instrument catalog shared by the browser and server.
- `src/services/marketData.ts` -- browser HTTP provider and explicit mock opt-in.
- `src/{App.tsx,types/market.ts}`, `src/components/{StatusCard,SettingsPanel}.tsx` -- web-only runtime state and controls.
- `Dockerfile`, `.dockerignore` -- multi-stage frontend/server build and unprivileged runtime image.
- `.github/workflows/container.yml` -- checks, OCI metadata, and GHCR publication for main and version tags.
- `deployment/k8s/` -- one-replica Deployment and LAN-accessible Service with probes/resources.
- `deployment/raspberry-pi/`, `README.md` -- kiosk service template and deployment/operations runbook.

## Tasks & Acceptance

**Execution:**
- [x] `server/` and server TypeScript/test configuration -- port the normalized Binance/Yahoo providers and cache into a testable Node service, implement validated APIs and static SPA delivery.
- [x] `src/` and `package.json` -- use HTTP for live web data, retain mock mode only when explicitly enabled, and remove Tauri/appliance/window dependencies and controls.
- [x] `src-tauri/`, `deployment/linux/`, obsolete release scripts/workflow/config -- remove the Rust/Tauri desktop delivery path completely.
- [x] `Dockerfile`, `.dockerignore` -- build both TypeScript targets and create a small non-root production image with deterministic dependencies.
- [x] `.github/workflows/container.yml` -- run checks and publish GHCR tags (`latest`, commit SHA, and semantic version tags) using GitHub's package token.
- [x] `deployment/k8s/` -- provide a directly applicable single-replica workload, NodePort service, probes, security context, and conservative resource limits.
- [x] `deployment/raspberry-pi/`, `README.md` -- document image visibility/pull-secret options, Kubernetes rollout, LAN URL, Raspberry Pi autologin/kiosk setup, and update/recovery commands.
- [x] Frontend/server tests -- cover provider selection, normalization, routing, validation, caching, stale fallback, and existing dashboard behavior without live network calls.

**Acceptance Criteria:**
- Given a clean checkout, when `npm ci`, checks, tests, and production build run, then no Rust toolchain or Tauri platform package is required.
- Given the built image starts, when `/` and valid market endpoints are requested, then the dashboard assets and normalized live responses are served from the same origin.
- Given a push to `main` or a `v*` tag, when GitHub Actions completes, then an authenticated workflow publishes the documented GHCR tags without embedded registry credentials.
- Given the Kubernetes manifest is applied and the Pod is ready, when a LAN client opens the documented node address and port, then the dashboard loads with live data.
- Given a Raspberry Pi desktop reboot, when network and the service become reachable, then Chromium displays TickerDeck fullscreen without manual interaction.

## Spec Change Log

## Design Notes

Use one Node process for API and static files so the browser has no CORS configuration and the Pod has one lifecycle. Keep a single replica because caches are in memory and additional replicas would multiply anonymous upstream traffic. A fixed NodePort is the dependency-free home-cluster default; TLS/Ingress remains a later environment-specific operation. Browser `localStorage` owns UI preferences, while kiosk/fullscreen and monitor power belong to the Pi operating system.

Implementation preserved the baseline's current 13-instrument, 7x2 wall; the earlier 11-instrument wording came from superseded project context rather than the checked-out baseline.

## Verification

**Commands:**
- `npm ci && npm run typecheck && npm run lint && npm test -- --run && npm run build` -- all web/server checks pass offline except dependency installation.
- `docker build -t tickerdeck:test .` -- production image builds without Rust and runs as a non-root user.
- `docker run --rm -p 8080:8080 tickerdeck:test` plus local health/API smoke requests -- static UI and service endpoints respond.
- `kubectl apply --dry-run=client -f deployment/k8s/` -- Kubernetes resources parse successfully.

## Suggested Review Order

**Runtime composition**

- Start with the single-process API, cache, provider, and static-site assembly.
  [`index.ts:8`](../../server/index.ts#L8)

- Same-origin routes distinguish validation failures and operational failures safely.
  [`app.ts:11`](../../server/app.ts#L11)

**Market data resilience**

- TTL caches preserve last-good values and coalesce concurrent upstream requests.
  [`marketService.ts:21`](../../server/marketService.ts#L21)

- Provider adapters normalize Binance and Yahoo behind one routing boundary.
  [`providers.ts:40`](../../server/providers.ts#L40)

- Browser requests use bounded waits while serialized polling retains stale state.
  [`useMarketDashboard.ts:45`](../../src/hooks/useMarketDashboard.ts#L45)

- Production web mode calls only the same-origin market API.
  [`marketData.ts:82`](../../src/services/marketData.ts#L82)

**Delivery and appliance operation**

- Multi-architecture images publish with least-privilege GHCR permissions and validated tags.
  [`container.yml:17`](../../.github/workflows/container.yml#L17)

- Multi-stage assembly produces the unprivileged production runtime.
  [`Dockerfile:1`](../../Dockerfile#L1)

- Kubernetes applies one hardened replica with probes and bounded resources.
  [`deployment.yaml:7`](../../deployment/k8s/deployment.yaml#L7)

- Pi startup waits for health and restarts Chromium in kiosk mode.
  [`tickerdeck-kiosk.service:6`](../../deployment/raspberry-pi/tickerdeck-kiosk.service#L6)

**Supporting contract**

- One catalog drives both browser defaults and server validation.
  [`instruments.ts:1`](../../shared/instruments.ts#L1)

- Server tests cover API safety, provider normalization, cache behavior, and runtime paths.
  [`marketService.test.ts:1`](../../server/marketService.test.ts#L1)
