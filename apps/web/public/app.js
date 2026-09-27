const appConfig = window.__O1_LAUNCHPAD_CONFIG__ || {};

const state = {
  launchpads: [],
  tokens: [],
  selectedSlug: null,
  message: "",
  wallet: localStorage.getItem("demoWallet") || "",
  createLaunchpadDraft: {
    name: "RWA Desk",
    slug: "rwa",
    description: "A curated launchpad for tokenized real-world assets.",
    primary: "#155EEF",
    accent: "#16A34A",
    additionalFeeBps: "50"
  },
  launchTokenDraft: {
    name: "AI Compute Index",
    symbol: "AICI",
    decimals: "18",
    initialSupply: "1000000",
    contractURI: "ipfs://metadata/ai-compute-index"
  }
};

const demoWallet = appConfig.demoWallet || "";

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}

function shortAddress(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function launchpadUrl(slug) {
  return `${slug}.${appConfig.baseDomain || window.location.host}`;
}

function tenantSlugFromHost() {
  const baseDomain = appConfig.baseDomain;
  if (!baseDomain) return null;

  const host = window.location.hostname.toLowerCase();
  const normalizedBase = baseDomain.toLowerCase();
  if (host === normalizedBase || host === `www.${normalizedBase}`) return null;
  if (!host.endsWith(`.${normalizedBase}`)) return null;

  const prefix = host.slice(0, -1 * (`.${normalizedBase}`).length);
  if (!prefix || prefix.includes(".")) return null;
  return prefix;
}

function isTenantView() {
  return Boolean(tenantSlugFromHost());
}

function activeLaunchpad() {
  const selected = state.launchpads.find((launchpad) => launchpad.slug === state.selectedSlug);
  if (isTenantView()) return selected || null;
  return selected || state.launchpads[0] || null;
}

function requireWallet() {
  if (!state.wallet) {
    throw new Error("Please connect a wallet before creating launchpads or launching tokens.");
  }
}

function connectWallet() {
  if (!demoWallet) {
    state.message = "Demo wallet is not configured. Please set DEMO_OWNER_WALLET in .env.";
    render();
    return;
  }

  state.wallet = demoWallet;
  localStorage.setItem("demoWallet", state.wallet);
  state.message = `Wallet connected: ${shortAddress(state.wallet)}. Transactions are simulated locally for the MVP.`;
  render();
}

function disconnectWallet() {
  state.wallet = "";
  localStorage.removeItem("demoWallet");
  state.message = "Wallet disconnected.";
  render();
}

async function load() {
  const { launchpads } = await api("/api/launchpads");
  state.launchpads = launchpads;
  if (!state.launchpads.length) {
    await api("/api/demo/reset", { method: "POST", body: "{}" });
    return load();
  }
  const tenantSlug = tenantSlugFromHost();
  if (tenantSlug && !state.launchpads.some((launchpad) => launchpad.slug === tenantSlug)) {
    state.message = `No launchpad exists for ${tenantSlug}.${appConfig.baseDomain}. Create it from the root app first.`;
  }
  if (tenantSlug) {
    state.selectedSlug = tenantSlug;
  } else {
    state.selectedSlug ||= state.launchpads[0]?.slug;
  }
  const selected = activeLaunchpad();
  if (selected && tenantSlug) {
    const detail = await api(`/api/launchpads/slug/${selected.slug}`);
    state.tokens = detail.tokens;
  } else {
    state.tokens = [];
  }
  render();
}

async function createLaunchpad(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.createLaunchpadDraft = {
    name: String(form.get("name") || ""),
    slug: String(form.get("slug") || ""),
    description: String(form.get("description") || ""),
    primary: String(form.get("primary") || ""),
    accent: String(form.get("accent") || ""),
    additionalFeeBps: String(form.get("additionalFeeBps") || "")
  };

  try {
    requireWallet();
    const payload = {
      name: state.createLaunchpadDraft.name,
      slug: state.createLaunchpadDraft.slug,
      description: state.createLaunchpadDraft.description,
      ownerWallet: state.wallet,
      primary: state.createLaunchpadDraft.primary,
      accent: state.createLaunchpadDraft.accent,
      additionalFeeBps: Number(state.createLaunchpadDraft.additionalFeeBps || 50)
    };

    const { launchpad } = await api("/api/launchpads", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.selectedSlug = launchpad.slug;
    state.message = `Launchpad "${launchpad.name}" is live at ${launchpadUrl(launchpad.slug)}.`;
    await load();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function launchToken(event) {
  event.preventDefault();
  const launchpad = activeLaunchpad();
  if (!launchpad) return;

  const form = new FormData(event.currentTarget);
  state.launchTokenDraft = {
    name: String(form.get("name") || ""),
    symbol: String(form.get("symbol") || ""),
    decimals: String(form.get("decimals") || ""),
    initialSupply: String(form.get("initialSupply") || ""),
    contractURI: String(form.get("contractURI") || "")
  };

  try {
    requireWallet();
    const payload = {
      launchpadId: launchpad.id,
      name: state.launchTokenDraft.name,
      symbol: state.launchTokenDraft.symbol.toUpperCase(),
      decimals: Number(state.launchTokenDraft.decimals || 18),
      creatorWallet: state.wallet,
      initialSupply: state.launchTokenDraft.initialSupply,
      contractURI: state.launchTokenDraft.contractURI
    };

    const { token } = await api("/api/tokens/launch", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    state.message = `B20 token ${token.symbol} was indexed under ${launchpad.name}.`;
    await load();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function resetDemo() {
  await api("/api/demo/reset", { method: "POST", body: "{}" });
  state.selectedSlug = null;
  state.message = "Demo data reset.";
  await load();
}

function launchpadListHtml(selected) {
  return state.launchpads
    .map(
      (launchpad) => `
        <button class="launchpad-button ${selected?.id === launchpad.id ? "active" : ""}" data-slug="${launchpad.slug}">
          <strong>${launchpad.name}</strong><br />
          <span>${launchpadUrl(launchpad.slug)}</span>
        </button>
      `
    )
    .join("");
}

function tokenCardsHtml(tokens) {
  if (!tokens.length) {
    return `<div class="notice">No tokens yet. Launch one through the selected custom launchpad.</div>`;
  }

  return tokens
    .map(
      (token) => `
        <article class="token-card">
          <header>
            <div>
              <strong>${token.name}</strong>
              <div class="muted">${token.symbol} · ${token.variant} · ${token.decimals} decimals</div>
            </div>
            <span class="pill">Indexed</span>
          </header>
          <div class="mono">Token: ${token.tokenAddress}</div>
          <div class="mono">Tx: ${token.txHash}</div>
          <div class="muted">Creator ${shortAddress(token.creatorWallet)} · Initial supply ${token.initialSupply}</div>
        </article>
      `
    )
    .join("");
}

function render() {
  const tenantView = isTenantView();
  const selected = activeLaunchpad();
  const tokens = tenantView && selected ? state.tokens : [];
  const messageClass = state.message && state.message.toLowerCase().includes("must") ? "notice error" : "notice";
  const createDraft = state.createLaunchpadDraft;
  const tokenDraft = state.launchTokenDraft;

  document.querySelector("#app").innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <strong>o1.exchange</strong>
          <span>Launchpad of Launchpads MVP</span>
        </div>

        <div class="stats">
          <div class="stat"><b>${state.launchpads.length}</b><span>Launchpads</span></div>
          <div class="stat"><b>${tokens.length}</b><span>Selected tokens</span></div>
        </div>

        <section>
          <h2>Custom Launchpads</h2>
          <div class="launchpad-list">${launchpadListHtml(selected)}</div>
        </section>

        <button class="secondary-action" id="resetDemo">Reset Demo Data</button>
        <p class="muted">
          Local MVP uses a mocked B20 Factory event stream, but follows the real
          IB20Factory.createB20 integration boundary.
        </p>
      </aside>

      <section class="main">
        <div class="topbar">
          <div>
            <h1>${tenantView && selected ? selected.name : "Create, customize, and operate B20 launchpads"}</h1>
            <div class="muted">${
              tenantView
                ? "Launch B20 tokens from this custom launchpad."
                : `Wallet → dedicated launchpad contract → ${appConfig.baseDomain || window.location.host} subdomain → B20 token → attribution.`
            }</div>
          </div>
          ${
            state.wallet
              ? `<button class="secondary-action" id="disconnectWallet">Connected ${shortAddress(state.wallet)}</button>`
              : `<button class="primary-action" id="connectWallet">Connect Wallet</button>`
          }
        </div>

        ${
          state.wallet
            ? ""
            : `<div class="notice">Connect a wallet first. In production, creating a launchpad and launching a token would submit transactions and require gas.</div>`
        }

        ${state.message ? `<div class="${messageClass}">${state.message}</div>` : ""}

        <section class="flow">
          <div class="flow-step">1. Connect wallet</div>
          <div class="flow-step">2. Create launchpad</div>
          <div class="flow-step">3. Configure branding</div>
          <div class="flow-step">4. Launch B20 token</div>
          <div class="flow-step">5. View attribution</div>
        </section>

        <section class="grid">
          ${
            tenantView
              ? ""
              : `
          <div class="panel">
            <h2>Create Launchpad</h2>
            <form class="form" id="createLaunchpadForm">
              <div class="field">
                <label>Name</label>
                <input name="name" value="${createDraft.name}" required />
              </div>
              <div class="field">
                <label>Slug / subdomain</label>
                <input name="slug" value="${createDraft.slug}" required />
              </div>
              <div class="field">
                <label>Description</label>
                <textarea name="description">${createDraft.description}</textarea>
              </div>
              <div class="inline">
                <div class="field">
                  <label>Primary color</label>
                  <input name="primary" value="${createDraft.primary}" />
                </div>
                <div class="field">
                  <label>Accent color</label>
                  <input name="accent" value="${createDraft.accent}" />
                </div>
              </div>
              <div class="field">
                <label>Additional platform fee (bps)</label>
                <input name="additionalFeeBps" type="number" value="${createDraft.additionalFeeBps}" min="0" max="1000" />
              </div>
              <button class="primary-action">Create Launchpad</button>
            </form>
          </div>
          `
          }

          <div class="panel preview" style="--tenant-primary: ${selected?.theme.primary || "#155EEF"}">
            <div class="preview-hero">
              <h2>${selected?.name || "Launchpad Preview"}</h2>
              <p>${selected?.description || "Create a launchpad to preview it here."}</p>
            </div>
            <div class="preview-body">
              <div class="pill-row">
                <span class="pill">${selected ? launchpadUrl(selected.slug) : `slug.${appConfig.baseDomain || window.location.host}`}</span>
                <span class="pill">${selected?.additionalFeeBps || 0} bps platform fee</span>
                <span class="pill">Owner ${selected ? shortAddress(selected.ownerWallet) : "0x..."}</span>
                <span class="pill">Contract ${selected ? shortAddress(selected.contractAddress) : "0x..."}</span>
              </div>
              ${
                selected
                  ? `<div class="notice">
                      Dedicated launchpad contract:
                      <span class="mono">${selected.contractAddress}</span>
                    </div>`
                  : ""
              }

              ${
                tenantView && selected
                  ? `
              <form class="form" id="launchTokenForm">
                <h2>Launch B20 Token Through This Launchpad</h2>
                <div class="inline">
                  <div class="field">
                    <label>Token name</label>
                    <input name="name" value="${tokenDraft.name}" required />
                  </div>
                  <div class="field">
                    <label>Symbol</label>
                    <input name="symbol" value="${tokenDraft.symbol}" required />
                  </div>
                </div>
                <div class="inline">
                  <div class="field">
                    <label>Decimals</label>
                    <input name="decimals" type="number" value="${tokenDraft.decimals}" min="6" max="18" />
                  </div>
                  <div class="field">
                    <label>Initial supply</label>
                    <input name="initialSupply" value="${tokenDraft.initialSupply}" />
                  </div>
                </div>
                <div class="field">
                  <label>Contract URI</label>
                  <input name="contractURI" value="${tokenDraft.contractURI}" />
                </div>
                <button class="primary-action">Launch Token</button>
              </form>
              `
                  : tenantView
                    ? `<div class="notice error">This launchpad does not exist yet. Create it from ${appConfig.appUrl || appConfig.baseDomain || "the root app"} first.</div>`
                    : `<div class="notice">Open a custom launchpad URL, such as ${selected ? launchpadUrl(selected.slug) : `slug.${appConfig.baseDomain || window.location.host}`}, to launch a token under that launchpad.</div>`
              }
            </div>
          </div>
        </section>

        ${
          tenantView && selected
            ? `
        <section class="panel">
          <h2>Tokens Under ${selected.name}</h2>
          <div class="token-grid">${tokenCardsHtml(tokens)}</div>
        </section>
        `
            : ""
        }
      </section>
    </main>
  `;

  document.querySelectorAll(".launchpad-button").forEach((button) => {
    button.addEventListener("click", async () => {
      state.selectedSlug = button.dataset.slug;
      state.message = "";
      await load();
    });
  });
  document.querySelector("#connectWallet")?.addEventListener("click", connectWallet);
  document.querySelector("#disconnectWallet")?.addEventListener("click", disconnectWallet);
  document.querySelector("#createLaunchpadForm")?.addEventListener("submit", createLaunchpad);
  document.querySelector("#launchTokenForm")?.addEventListener("submit", launchToken);
  document.querySelector("#createLaunchpadForm")?.addEventListener("input", (event) => {
    state.createLaunchpadDraft[event.target.name] = event.target.value;
  });
  document.querySelector("#launchTokenForm")?.addEventListener("input", (event) => {
    state.launchTokenDraft[event.target.name] = event.target.value;
  });
  document.querySelector("#resetDemo")?.addEventListener("click", resetDemo);
}

load().catch((error) => {
  state.message = error.message;
  render();
});
