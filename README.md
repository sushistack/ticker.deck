# TickerDeck

TickerDeck is an always-on 13-instrument market dashboard designed for a 1920x480 ultrawide display. It runs as one web container in Kubernetes; a Raspberry Pi only needs Chromium in kiosk mode. The 13 market cards and status tile use a dense 7x2 layout.

## Architecture

```text
Binance / Yahoo Finance
          |
          v
TickerDeck Node service (API + in-memory cache + React assets)
          |
          v
Kubernetes NodePort :30080 -> Raspberry Pi Chromium kiosk
```

Crypto symbols are served by Binance USDT markets. Indices, FX, and US equities are served by Yahoo Finance. The browser only talks to same-origin `/api` endpoints and never contacts either provider directly.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Open `http://localhost:1420`. Vite proxies `/api` to the local Node server on port 8080. To render deterministic mock data without external requests:

```bash
VITE_MOCK_DATA=true npm run dev
```

Production checks:

```bash
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm start
```

The production server listens on `PORT` (default `8080`) and serves assets from `STATIC_DIR` (default `dist`).

## HTTP API

```text
GET /api/quotes?symbols=BTC-USD,QQQ
GET /api/charts?symbols=BTC-USD,QQQ&range=1D
GET /healthz
GET /readyz
```

Only symbols configured in `shared/instruments.ts` are accepted. Requests are bounded and ranges are limited to `1D` and `1M`. Quotes are cached for four seconds; 1D charts for one minute; 1M charts for ten minutes. Failed refreshes retain the last good value and mark only the affected symbol stale.

## Container

Build and smoke-test locally:

```bash
docker build -t tickerdeck:test .
docker run --rm -p 8080:8080 tickerdeck:test
curl http://127.0.0.1:8080/healthz
```

The runtime image uses Node 22, contains production dependencies only, and runs as the unprivileged `node` user. It is built for both `linux/amd64` and `linux/arm64` by GitHub Actions.

## GitHub Container Registry

`.github/workflows/container.yml` verifies the project before building. Pull requests build without publishing. Other events publish to:

```text
ghcr.io/sushistack/ticker.deck
```

Tags are produced as follows:

- push to `main`: `latest` and `sha-<commit>`
- push of `v1.2.3`: `1.2.3`, `1.2`, and `sha-<commit>`
- manual dispatch: `sha-<commit>` plus `latest` on the default branch

Release tags must use `vMAJOR.MINOR.PATCH` and match `package.json`; a mismatched tag fails before image publication.

The workflow authenticates with GitHub's short-lived `GITHUB_TOKEN`; no registry secret is required. After the first publish, open the package settings on GitHub and make the package public for anonymous cluster pulls.

For a private package, create a pull secret instead:

```bash
kubectl create secret docker-registry ghcr-pull \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USER \
  --docker-password=YOUR_READ_PACKAGES_TOKEN
```

Then add `imagePullSecrets: [{ name: ghcr-pull }]` under `spec.template.spec` in the Deployment. Do not commit the token.

## Kubernetes deployment

The supplied manifest runs one replica because the cache is in process memory; multiple replicas would multiply anonymous upstream traffic.

```bash
kubectl apply -f deployment/k8s/
kubectl rollout status deployment/tickerdeck
kubectl get pods,service -l app.kubernetes.io/name=tickerdeck
```

The service uses NodePort `30080`, a dependency-free default for a trusted home LAN. From a LAN client, open:

```text
http://KUBERNETES_NODE_IP:30080
```

Check it before configuring the Pi:

```bash
curl http://KUBERNETES_NODE_IP:30080/healthz
```

For deterministic rollouts, replace `:latest` in `deployment/k8s/deployment.yaml` with a released semantic version or `sha-*` tag. After changing the image:

```bash
kubectl apply -f deployment/k8s/
kubectl rollout status deployment/tickerdeck
kubectl logs deployment/tickerdeck --tail=100
```

Put an authenticated HTTPS ingress or private overlay network in front before exposing the service to the public Internet.

## Raspberry Pi kiosk

Use Raspberry Pi OS Desktop with automatic login for a dedicated unprivileged user. Install Chromium and curl, and verify the browser path:

```bash
sudo apt update
sudo apt install -y chromium curl
command -v chromium
```

Create the kiosk URL configuration:

```bash
mkdir -p ~/.config
printf 'TICKERDECK_URL=http://KUBERNETES_NODE_IP:30080\n' > ~/.config/tickerdeck-kiosk.env
```

Install and enable the included user service from the graphical user's session:

```bash
mkdir -p ~/.config/systemd/user
cp deployment/raspberry-pi/tickerdeck-kiosk.service ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now tickerdeck-kiosk.service
journalctl --user -u tickerdeck-kiosk.service -f
```

The service waits until `/healthz` is reachable, launches Chromium fullscreen, and restarts it after a crash. If `command -v chromium` reports another path, update the Chromium path in the unit. The service must run inside the graphical user session; do not run Chromium as root.

Disable screen blanking and configure HDMI power scheduling in the Pi desktop/compositor settings. Those commands differ between current Wayland/labwc images and legacy X11 images, so display power intentionally remains a Pi OS responsibility rather than a server feature.

### Migrating an existing desktop installation

If this machine previously ran the removed Tauri/Linux appliance service, disable it before enabling the Pi kiosk:

```bash
systemctl --user disable --now tickerdeck.service || true
rm -f ~/.config/systemd/user/tickerdeck.service
systemctl --user daemon-reload
```

## Operations

```bash
# Server status
kubectl get deployment,pod,service -l app.kubernetes.io/name=tickerdeck

# Server logs
kubectl logs deployment/tickerdeck --tail=100 -f

# Restart the web service
kubectl rollout restart deployment/tickerdeck

# Restart the kiosk browser
systemctl --user restart tickerdeck-kiosk.service
```

Binance endpoints used here are public market-data APIs. Yahoo Finance endpoints are unofficial and may be delayed, rate-limited, changed, or discontinued; neither source should be treated as an exchange-grade trading feed.
