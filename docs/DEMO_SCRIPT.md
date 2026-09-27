# 3-5 Minute Demo Script

## Setup Before Recording

Run the app:

```bash
cd /Users/h.jiang/Desktop/codebase/o1
cp .env.example .env
npm run dev
```

Open:

```text
http://127.0.0.1:3000
```

If deploying to your server, use:

```text
https://launch.jkswebtest.xyz
```

## 0:00 - 0:30 Opening

Show the app homepage.

Say:

```text
This is an 8-hour hackathon-style MVP for the o1.exchange Launchpad of Launchpads project.
The goal is to prove the core product loop: a user can connect a wallet, create a custom launchpad, launch a B20-style token through that launchpad, and see the token correctly associated with the launchpad.
```

## 0:30 - 1:00 Connect Wallet

Action:

1. Click `Connect Wallet`.
2. Point to the connected wallet button.

Say:

```text
The MVP includes a demo wallet connection. In production, this would be replaced with a real wallet integration using wagmi and viem, and creating a launchpad or launching a token would require a real transaction and gas.
```

## 1:00 - 1:45 Create Launchpad

Action:

1. Fill the create launchpad form:
   - Name: `RWA Desk`
   - Slug: `rwa`
   - Description: `A curated launchpad for tokenized real-world assets.`
   - Fee: `50`
2. Click `Create Launchpad`.

Say:

```text
Here I create a custom launchpad. Each launchpad has its own slug, owner wallet, fee configuration, and a dedicated launchpad contract address.
The displayed URL uses the configured deployment domain. For this demo it can be shown as rwa.launch.jkswebtest.xyz.
```

## 1:45 - 2:20 Show Launchpad Contract

Action:

1. Point to the `Dedicated launchpad contract` field.
2. Point to owner and fee pills.

Say:

```text
The important design decision is that each custom launchpad can map to its own LaunchpadInstance contract.
The local API simulates the instance address, while the Solidity layer includes a LaunchpadFactory that deploys a real LaunchpadInstance contract.
```

## 2:20 - 3:10 Launch Token

Action:

1. Open the custom launchpad URL created in the previous step, for example:
   - `https://rwa.launch.jkswebtest.xyz` if wildcard HTTPS is configured.
   - or `http://rwa.launch.jkswebtest.xyz` for a local/non-SSL wildcard test.
2. Fill the token form inside that custom launchpad page:
   - Token name: `RWA Index`
   - Symbol: `RWAI`
   - Decimals: `18`
   - Initial supply: `1000000`
3. Click `Launch Token`.
4. Point to the token card under the selected launchpad.

Say:

```text
Now I launch a B20-style token from the custom launchpad page itself, rather than from the root launchpad builder.
The MVP simulates the B20 Factory event locally, but the contract boundary follows Base's official B20 Factory interface: IB20Factory.createB20 with variant, salt, params, and initCalls.
```

## 3:10 - 4:00 Explain Indexing And Attribution

Action:

1. Briefly switch to `docs/ARCHITECTURE.md` or code.
2. Show `apps/api/src/indexer.ts`.
3. Optionally show `contracts/src/contracts/LaunchpadInstance.sol`.

Say:

```text
The B20 Factory emits B20Created, which tells us a B20 token was created.
The launchpad contract emits TokenLaunched, which tells us which launchpad created that token.
The indexer joins those two events by token address, writes the result into the backend data model, and the frontend displays the token under the correct custom launchpad.
```

## 4:00 - 4:40 Explain Mocked Versus Production

Action:

1. Show `README.md` or `docs/ARCHITECTURE.md`.

Say:

```text
For speed, the frontend/backend flow uses local simulation for wallet transactions and B20 events.
The Solidity contracts define the intended on-chain boundary: LaunchpadFactory, LaunchpadInstance, and a B20 Factory compatible interface.
The next step would be deploying the factory to Anvil or Base Sepolia, wiring the frontend to real wallet transactions, and replacing the local event simulator with a production indexer such as Ponder, Envio, The Graph, or a viem worker.
```

## 4:40 - 5:00 Closing

Say:

```text
The MVP is intentionally small but complete. It proves the core product experience, the launchpad ownership model, token attribution, and the path from hackathon prototype to production architecture.
```
