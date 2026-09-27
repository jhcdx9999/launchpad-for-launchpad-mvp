# o1.exchange Launchpad of Launchpads MVP

Hackathon-style MVP for the PRD in `o1-exchange-Launchpad-of-Launchpads-Google-Docs.png`.

The project demonstrates a vertical slice:

```text
Connect wallet
  -> Create launchpad
  -> deploy/create a dedicated launchpad contract
  -> configure metadata / slug / fee
  -> launch a B20-style token
  -> emit/index token attribution
  -> show the token under the correct custom launchpad
```

## Structure

```text
contracts/          Solidity factory, per-launchpad instance, registry/router, and local B20 mock
apps/api/           TypeScript API, JSON store, and event indexer
apps/web/           Static frontend served by the API
packages/shared/    Shared domain types, validators, mock chain event helpers
docs/               Architecture document and production notes
```

## Run The MVP

Copy the example env file first:

```bash
cp .env.example .env
```

For local review, keep:

```text
PUBLIC_APP_URL=http://127.0.0.1:3000
PUBLIC_BASE_DOMAIN=launch.jkswebtest.xyz
```

Then run:

```bash
npm run dev
```

Then open:

```text
http://127.0.0.1:3000
```

The API seeds demo launchpads automatically on first load. You can reset demo data from the UI.

## Configuration

Custom deployment values live in `.env` and `config/app.config.json`.

Main `.env` variables:

```text
HOST=127.0.0.1
PORT=3000
PUBLIC_APP_URL=http://127.0.0.1:3000
PUBLIC_BASE_DOMAIN=launch.jkswebtest.xyz
DATA_FILE=data/launchpad-db.json
DEMO_OWNER_WALLET=0x1111111111111111111111111111111111111111
DEMO_CREATOR_WALLET=0x2222222222222222222222222222222222222222
```

For deployment on your server/domain, use:

```text
HOST=127.0.0.1
PORT=4002
PUBLIC_APP_URL=https://launch.jkswebtest.xyz
PUBLIC_BASE_DOMAIN=launch.jkswebtest.xyz
```

The frontend will render launchpad examples such as:

```text
ai.launch.jkswebtest.xyz
meme.launch.jkswebtest.xyz
rwa.launch.jkswebtest.xyz
```

## Run Checks

```bash
npm test
```

Contract tests are included in Foundry format:

```bash
npm run contracts:test
```

Foundry is not bundled with this repository, so install `forge` before running the Solidity tests.

## Important MVP Notes

- The frontend uses a static app to keep the project reviewable without installing a large framework.
- The backend uses a JSON file store for hackathon speed.
- The B20 Factory is simulated locally in TypeScript and mocked in Solidity, but the integration boundary follows `IB20Factory.createB20(variant, salt, params, initCalls)`.
- The frontend includes a demo wallet connection. In production, launchpad creation and token launch would submit wallet transactions and require gas.
- Each launchpad record includes a dedicated launchpad contract address. In the local API this address is simulated; in Solidity, `LaunchpadFactory` deploys a `LaunchpadInstance`.
- Production should replace the mock event stream with a real chain indexer such as Ponder, Envio, The Graph, or a viem worker.

## Submission Checklist

- Runnable MVP: frontend + backend local app
- Solidity contracts: factory, per-launchpad instance, registry alternative, B20 mock
- Tests: TypeScript tests plus Foundry-style Solidity tests
- Architecture document: `docs/ARCHITECTURE.md`
- Clear mock/production boundary notes

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the technical design.

See [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) for a 3-5 minute walkthrough script.
