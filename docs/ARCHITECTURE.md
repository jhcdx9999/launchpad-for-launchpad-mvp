# o1.exchange Launchpad of Launchpads MVP Architecture

## Goal

This MVP follows the PRD’s core user journey:

```text
Connect wallet
  -> Create Launchpad
  -> Deploy a dedicated LaunchpadInstance contract
  -> Choose name / branding / configuration
  -> Receive unique slug or subdomain
  -> Launchpad goes live
  -> Users can launch B20 tokens
  -> Tokens appear under the correct launchpad
```

The implementation is intentionally scoped like an 8-hour hackathon project: it proves the product loop and the key technical boundaries without overbuilding production infrastructure.

## Product Scope

Implemented:

- Create a custom launchpad with name, slug, owner wallet, theme, description, and fee config.
- Connect a wallet before create/launch actions.
- Generate and display a dedicated launchpad contract address for each custom launchpad.
- View launchpads as tenant-like experiences such as `ai.launch.o1.exchange`.
- Launch a B20-style token through a selected launchpad.
- Associate each launched token with the correct launchpad.
- Index B20 creation plus launchpad attribution into a backend data model.
- Display tokens under the correct custom launchpad.
- Include Solidity contracts for launchpad ownership, B20 routing, and token attribution events.

Simplified or mocked:

- Wallet connection is represented by fixed demo wallets.
- Real wildcard DNS is simulated by launchpad slugs.
- The Base B20 Factory is represented by a Solidity mock and a TypeScript event simulator.
- The database is a JSON file instead of PostgreSQL.
- The indexer runs inside the API process instead of a separate worker.
- UI/UX is functional and reviewable, not final product design.

## Architecture

```text
Frontend
  - Create launchpad
  - Launch token
  - View tenant page
  - View tokens under launchpad

Backend API
  - Launchpad metadata CRUD
  - Token launch endpoint
  - JSON persistence
  - Demo event materialization

Indexer
  - Consumes B20Created + TokenLaunched events
  - Joins events by token address
  - Stores launchpad-token attribution

Smart Contracts
  - LaunchpadFactory
  - LaunchpadInstance
  - LaunchpadRegistry alternative/router
  - MockB20Factory for local testing
  - IB20Factory-compatible integration boundary
```

## Smart Contract Layer

The preferred production-style model is one factory plus one dedicated contract per launchpad:

```text
LaunchpadFactory
  -> creates LaunchpadInstance for ai.launch.o1.exchange
  -> creates LaunchpadInstance for meme.launch.o1.exchange
  -> creates LaunchpadInstance for rwa.launch.o1.exchange
```

This matches the product expectation that every custom launchpad has its own contract identity and can display that contract address in the frontend.

The MVP also keeps `LaunchpadRegistry` as a simpler registry/router alternative, but `LaunchpadFactory` and `LaunchpadInstance` are the model that best fits the user's latest requirement.

### LaunchpadFactory

Responsibilities:

- Create one `LaunchpadInstance` contract per custom launchpad.
- Record owner, instance address, slug hash, metadata URI, active status, and fee config.
- Prevent duplicate slug hashes.
- Emit `LaunchpadCreated` with the new instance contract address.

Important functions:

```solidity
createLaunchpad(bytes32 slugHash, string metadataURI, uint16 additionalFeeBps)
updateLaunchpad(uint256 launchpadId, string metadataURI, uint16 additionalFeeBps, bool active)
launchpadCount()
```

Important events:

```solidity
LaunchpadCreated(launchpadId, owner, instance, slugHash, metadataURI, additionalFeeBps)
LaunchpadUpdated(launchpadId, instance, metadataURI, additionalFeeBps, active)
```

### LaunchpadInstance

Responsibilities:

- Represent one custom launchpad contract.
- Store owner, launchpad ID, slug hash, metadata URI, fee config, and active status.
- Route B20 creation through `IB20Factory.createB20(...)`.
- Emit `TokenLaunched` for launchpad-token attribution.

Important functions:

```solidity
updateConfig(string metadataURI, uint16 additionalFeeBps, bool active)
launchB20Token(B20Variant variant, bytes32 salt, bytes params, bytes[] initCalls)
predictB20Address(B20Variant variant, bytes32 salt)
```

Important event:

```solidity
TokenLaunched(launchpadId, token, creator, variant, salt)
```

### LaunchpadRegistry Alternative

The earlier registry/router contract is still present because it is a simpler MVP path and useful for comparison.

Responsibilities:

- Create launchpads.
- Store trust-critical launchpad ownership.
- Store slug hash, metadata URI, active status, and additional platform fee basis points.
- Route B20 token creation through `IB20Factory.createB20(...)`.
- Emit a launchpad attribution event after token creation.

Important functions:

```solidity
createLaunchpad(bytes32 slugHash, string metadataURI, uint16 additionalFeeBps)
updateLaunchpad(uint256 launchpadId, string metadataURI, uint16 additionalFeeBps, bool active)
launchB20Token(uint256 launchpadId, B20Variant variant, bytes32 salt, bytes params, bytes[] initCalls)
predictB20Address(B20Variant variant, bytes32 salt)
```

Important events:

```solidity
LaunchpadCreated(launchpadId, owner, slugHash, metadataURI, additionalFeeBps)
LaunchpadUpdated(launchpadId, metadataURI, additionalFeeBps, active)
TokenLaunched(launchpadId, token, creator, variant, salt)
```

The key design decision is that o1 should not redeploy a custom ERC-20 implementation for this product. Each launchpad instance should rely on Base’s official B20 Factory:

```solidity
IB20Factory.createB20(variant, salt, params, initCalls)
```

For the MVP, the default token path is the B20 `ASSET` variant because it is the general-purpose token type. The `initCalls` array can bootstrap token configuration in the same creation transaction, such as:

- `IB20.updateSupplyCap(...)`
- `IB20.updateContractURI(...)`
- `IB20.grantRole(...)`
- `IB20.updatePolicy(...)`
- `IB20Asset.batchMint(...)`

This avoids a half-configured token state: if a bootstrap call fails, the creation transaction should revert.

## Event Attribution

The B20 Factory emits:

```solidity
B20Created(token, variant, name, symbol, decimals, variantEventParams)
```

That proves a B20 token was created, but it does not by itself say which custom launchpad owns the launch.

The `LaunchpadInstance` emits:

```solidity
TokenLaunched(launchpadId, token, creator, variant, salt)
```

The off-chain indexer listens to both events and joins them by `token` address:

```text
B20Created.token == TokenLaunched.token
```

After joining, the application can show:

```text
Token 0xABC
  name: AI Index
  symbol: AIDX
  launchpad: ai.launch.o1.exchange
  creator: 0x...
```

## Backend Layer

The backend is a lightweight TypeScript API. In production this would likely become Next.js API routes, NestJS, Hono, or a standalone service.

Implemented endpoints:

```text
GET    /api/health
POST   /api/demo/reset
GET    /api/launchpads
POST   /api/launchpads
GET    /api/launchpads/slug/:slug
PATCH  /api/launchpads/:id
GET    /api/tokens
POST   /api/tokens/launch
```

Stored launchpad metadata:

- Name
- Slug/subdomain mapping
- Owner wallet
- Description
- Theme colors
- Logo/banner placeholders
- Additional fee basis points
- Off-chain status
- Corresponding on-chain launchpad ID

Stored token metadata:

- Token address
- Name
- Symbol
- Decimals
- Creator wallet
- Launchpad ID
- Initial supply
- Contract URI
- Transaction hash
- Salt
- Indexed status

## Frontend Layer

The frontend is a dependency-light static app served by the API. It demonstrates the product loop:

- Connect demo wallet before gas-requiring actions.
- View existing launchpads.
- Create a new launchpad.
- See the dedicated launchpad contract address.
- Preview its custom branded page.
- Launch a B20-style token under it.
- See the token appear under the selected launchpad.

In production, this should become a Next.js app with:

- wagmi and viem wallet integration.
- Real chain reads/writes.
- Transaction confirmation states.
- Gas estimation and transaction failure handling.
- Subdomain-based tenant resolution.
- Existing o1.exchange design system.

Deployment configuration:

- `PUBLIC_APP_URL` controls the public app URL, for example `https://jkswebtest.xyz`.
- `PUBLIC_BASE_DOMAIN` controls launchpad URL display, for example `jkswebtest.xyz` renders `ai.jkswebtest.xyz`.
- Use `PUBLIC_BASE_DOMAIN=launch.jkswebtest.xyz` if the team prefers PRD-style URLs such as `ai.launch.jkswebtest.xyz`.

## Data And Indexing

The MVP uses `data/launchpad-db.json` as a local JSON database.

Each launchpad record includes `contractAddress`. In the local API this is a deterministic simulated address. In the Solidity layer, this would be the actual `LaunchpadInstance` address emitted by `LaunchpadFactory.LaunchpadCreated`.

The indexer logic is implemented in `apps/api/src/indexer.ts`. It accepts chain-like events and materializes application records.

Production replacement:

- PostgreSQL for persistent data.
- Prisma or Drizzle as ORM.
- Ponder, Envio, The Graph, or a viem worker for event indexing.
- Reorg handling and idempotent event processing.
- Separate worker process for indexing.

## Fee Handling

The launchpad contracts store:

```solidity
additionalFeeBps
platformTreasury
```

For the MVP, fee values are stored and displayed but not collected. This is intentional because the PRD asks candidates to reason about how fees should be handled, and the exact production integration depends on the existing o1 protocol fee path.

Production options:

- Collect a fixed SaaS fee in the Launchpad Router before calling `createB20`.
- Route an additional fee into o1 treasury during token launch.
- Integrate launchpad attribution into the existing o1/Uniswap V4 hook fee path.
- Add launchpad owner revenue share later.

## Security Considerations

MVP safeguards:

- Slug normalization and reserved slug checks.
- Launchpad owner is recorded on-chain.
- Only launchpad owner can update on-chain launchpad config.
- Fee is bounded by `MAX_ADDITIONAL_FEE_BPS`.
- Token attribution is emitted on-chain.
- Token cannot be attributed twice.

Production additions:

- SIWE authentication.
- Wallet-based authorization for backend edits.
- Role-based admin controls.
- Upload validation for logos and banners.
- Rate limits and anti-spam controls.
- Contract audit.
- Reorg-aware indexing.
- Monitoring for failed event materialization.

## Tradeoffs

This MVP optimizes for product clarity and implementation speed.

The biggest tradeoff is that the backend simulates B20 Factory events rather than connecting to a live Base network. The code keeps the correct event model and `IB20Factory.createB20(...)` boundary, so replacing the simulator with real viem contract calls and a live indexer is straightforward.

Another tradeoff is using JSON storage instead of PostgreSQL. This keeps local review simple but is not intended for production.

## Production Roadmap

Next steps:

- Replace fixed demo wallets with real wallet connection.
- Deploy `LaunchpadFactory` to Base Sepolia and create real `LaunchpadInstance` contracts.
- Keep `LaunchpadRegistry` only if the team prefers a single-registry architecture instead of per-launchpad contracts.
- Use the real B20 Factory precompile once available in the target environment.
- Add a production indexer.
- Move database to PostgreSQL.
- Support wildcard subdomains: `*.launch.o1.exchange`.
- Add custom domain support.
- Add analytics for launchpad owners.
- Add fee collection and optional owner revenue sharing.
- Add allowlist, scheduling, caps, and other advanced launch rules.
