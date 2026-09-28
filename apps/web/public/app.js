const appConfig = window.__O1_LAUNCHPAD_CONFIG__ || {};
const walletStorageKey = "demoWallet";

const state = {
  launchpads: [],
  tokens: [],
  popularLaunchpads: [],
  selectedSlug: null,
  message: "",
  adminSession: { authenticated: false },
  adminLoginDraft: {
    username: "",
    password: ""
  },
  wallet: readStoredWallet(),
  createLaunchpadDraft: {
    name: "",
    slug: "",
    description: "",
    additionalFeeBps: ""
  },
  launchTokenDraft: {
    name: "",
    symbol: "",
    decimals: "",
    initialSupply: "",
    contractURI: ""
  }
};

const demoWallet = appConfig.demoWallet || "";

function sharedWalletCookieDomain() {
  const baseDomain = String(appConfig.baseDomain || "").toLowerCase();
  const host = window.location.hostname.toLowerCase();
  if (!baseDomain || host === "localhost" || host === "127.0.0.1") return "";
  if (host === baseDomain || host.endsWith(`.${baseDomain}`)) return baseDomain;
  return "";
}

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const match = document.cookie.split("; ").find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

function writeWalletCookie(wallet, maxAgeSeconds) {
  const parts = [
    `${encodeURIComponent(walletStorageKey)}=${encodeURIComponent(wallet)}`,
    "path=/",
    `max-age=${maxAgeSeconds}`,
    "SameSite=Lax"
  ];
  const domain = sharedWalletCookieDomain();
  if (domain) parts.push(`domain=${domain}`);
  if (window.location.protocol === "https:") parts.push("Secure");
  document.cookie = parts.join("; ");
}

function readStoredWallet() {
  const localWallet = localStorage.getItem(walletStorageKey) || "";
  const sharedWallet = readCookie(walletStorageKey);
  if (sharedWalletCookieDomain()) {
    if (sharedWallet && sharedWallet !== localWallet) localStorage.setItem(walletStorageKey, sharedWallet);
    if (!sharedWallet && localWallet) localStorage.removeItem(walletStorageKey);
    return sharedWallet;
  }
  const wallet = localWallet || sharedWallet;
  if (wallet && wallet !== sharedWallet) writeWalletCookie(wallet, 60 * 60 * 24 * 30);
  if (wallet && wallet !== localWallet) localStorage.setItem(walletStorageKey, wallet);
  return wallet;
}

function saveStoredWallet(wallet) {
  localStorage.setItem(walletStorageKey, wallet);
  writeWalletCookie(wallet, 60 * 60 * 24 * 30);
}

function clearStoredWallet() {
  localStorage.removeItem(walletStorageKey);
  writeWalletCookie("", 0);
}

async function api(path, options = {}) {
  const { headers = {}, ...rest } = options;
  const response = await fetch(path, {
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...headers },
    ...rest
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

function rootLaunchpadUrl() {
  if (appConfig.appUrl) return appConfig.appUrl;
  return `${window.location.protocol}//${appConfig.baseDomain || window.location.host}`;
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

function isAdminView() {
  return window.location.pathname.replace(/\/+$/, "") === "/admin" && !tenantSlugFromHost();
}

function activeLaunchpad() {
  const selected = state.launchpads.find((launchpad) => launchpad.slug === state.selectedSlug);
  if (isTenantView()) return selected || null;
  return selected || state.launchpads[0] || null;
}

function formatTokenCount(count) {
  return `${count} token${count === 1 ? "" : "s"}`;
}

function formatCurrency(value) {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value}`;
}

function formatDateTime(value) {
  if (!value) return "Unknown";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
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
  saveStoredWallet(state.wallet);
  state.message = `Wallet connected: ${shortAddress(state.wallet)}. Transactions are simulated locally for the MVP.`;
  render();
}

function disconnectWallet() {
  state.wallet = "";
  clearStoredWallet();
  state.message = "Wallet disconnected.";
  render();
}

async function load() {
  state.wallet = readStoredWallet();
  const { launchpads } = await api("/api/launchpads");
  state.launchpads = launchpads;
  const tenantSlug = tenantSlugFromHost();
  if (tenantSlug && !state.launchpads.some((launchpad) => launchpad.slug === tenantSlug)) {
    state.message = `No launchpad exists for ${tenantSlug}.${appConfig.baseDomain}. Create it from the root app first.`;
  }
  if (tenantSlug) {
    state.selectedSlug = tenantSlug;
  } else {
    state.selectedSlug = state.launchpads.some((launchpad) => launchpad.slug === state.selectedSlug)
      ? state.selectedSlug
      : state.launchpads[0]?.slug || null;
  }
  const { popularLaunchpads } = await api("/api/launchpads/popular?limit=5");
  state.popularLaunchpads = popularLaunchpads;
  if (isAdminView()) {
    await loadAdminSession();
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

async function loadAdminSession() {
  try {
    const { session } = await api("/api/admin/session");
    state.adminSession = session;
  } catch {
    state.adminSession = { authenticated: false };
  }
}

async function createLaunchpad(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.createLaunchpadDraft = {
    name: String(form.get("name") || ""),
    slug: String(form.get("slug") || ""),
    description: String(form.get("description") || ""),
    additionalFeeBps: String(form.get("additionalFeeBps") || "")
  };

  try {
    requireWallet();
    const payload = {
      name: state.createLaunchpadDraft.name,
      slug: state.createLaunchpadDraft.slug,
      description: state.createLaunchpadDraft.description,
      ownerWallet: state.wallet,
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
    state.adminLoginDraft.password = "";
    state.message = error.message;
    render();
  }
}

async function clearLaunchpadData() {
  try {
    const result = await api("/api/admin/clear", {
      method: "POST",
      body: "{}"
    });
    state.selectedSlug = null;
    state.message = `Launchpad data cleared. ${result.launchpads.length} launchpads remain.`;
    await load();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function adminLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  state.adminLoginDraft = {
    username: String(form.get("username") || ""),
    password: String(form.get("password") || "")
  };

  try {
    const { session } = await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify(state.adminLoginDraft)
    });
    state.adminSession = session;
    state.adminLoginDraft.password = "";
    state.message = "Admin session active for 24 hours.";
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

async function adminLogout() {
  try {
    const { session } = await api("/api/admin/logout", {
      method: "POST",
      body: "{}"
    });
    state.adminSession = session;
    state.message = "Admin logged out.";
    render();
  } catch (error) {
    state.message = error.message;
    render();
  }
}

function launchpadListHtml(selected) {
  if (!state.popularLaunchpads.length) {
    return `<div class="muted">No popular launchpads yet.</div>`;
  }

  return state.popularLaunchpads
    .map(
      ({ launchpad, stats }) => `
        <button class="launchpad-button ${selected?.id === launchpad.id ? "active" : ""}" data-slug="${launchpad.slug}">
          <div class="launchpad-button-top">
            <strong>${launchpad.name}</strong>
            <span class="launchpad-count">${formatTokenCount(stats.tokenCount)}</span>
          </div>
          <span class="launchpad-url">${launchpadUrl(launchpad.slug)}</span>
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

function launchpadCardsHtml(selected) {
  if (!state.popularLaunchpads.length) {
    return `<div class="notice">No launchpads yet. Create the first one and start the market.</div>`;
  }

  return state.popularLaunchpads
    .map(({ launchpad, stats }, index) => {
      return `
        <article class="token-card launchpad-card ${selected?.id === launchpad.id ? "selected-card" : ""}">
          <header>
            <div>
              <strong>${launchpad.name}</strong>
              <div class="muted">${launchpadUrl(launchpad.slug)}</div>
            </div>
            <span class="pill">#${index + 1} Popular</span>
          </header>
          <div class="market-summary">
            <div>
              <strong>${formatTokenCount(stats.tokenCount)}</strong>
              <span>launched</span>
            </div>
            <div>
              <strong>${formatCurrency(stats.marketCap)}</strong>
              <span>combined market cap</span>
            </div>
            <div>
              <strong>${formatCurrency(stats.volume24h)}</strong>
              <span>24h volume</span>
            </div>
          </div>
          <p class="muted">${launchpad.description}</p>
          ${
            stats.topTokens.length
              ? `
          <div class="top-token-list">
            <div class="top-token-title">Top market-cap launches</div>
            ${stats.topTokens
              .map(
                (token) => `
                  <div class="top-token-row">
                    <div>
                      <strong>${token.name}</strong>
                      <span>${token.symbol}</span>
                    </div>
                    <div class="token-metrics">
                      <span>Market cap ${formatCurrency(token.marketCap)}</span>
                      <span>24h volume ${formatCurrency(token.volume24h)}</span>
                    </div>
                  </div>
                `
              )
              .join("")}
          </div>
          `
              : `<div class="notice">No live tokens yet. First movers can own this launchpad's activity chart.</div>`
          }
          <div class="mono">Contract: ${launchpad.contractAddress}</div>
          <button class="primary-action open-launchpad-card" data-slug="${launchpad.slug}">Open Launchpad</button>
        </article>
      `;
    })
    .join("");
}

function render() {
  if (isAdminView()) {
    renderAdmin();
    return;
  }

  const tenantView = isTenantView();
  const selected = activeLaunchpad();
  const tokens = tenantView && selected ? state.tokens : [];
  const visibleTokenCount = tenantView
    ? tokens.length
    : state.popularLaunchpads.reduce((total, item) => total + item.stats.tokenCount, 0);
  const messageClass = state.message && state.message.toLowerCase().includes("must") ? "notice error" : "notice";
  const createDraft = state.createLaunchpadDraft;
  const tokenDraft = state.launchTokenDraft;

  document.querySelector("#app").innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <a class="home-link" href="${rootLaunchpadUrl()}">Home</a>
          <strong>o1.exchange</strong>
          <span>Launchpad of Launchpads MVP</span>
        </div>

        <div class="stats">
          <div class="stat"><b>${state.launchpads.length}</b><span>Launchpads</span></div>
          <div class="stat"><b>${visibleTokenCount}</b><span>${tenantView ? "Selected tokens" : "Total tokens"}</span></div>
        </div>

        <section>
          <h2>Popular Launchpads</h2>
          <div class="launchpad-list">${launchpadListHtml(selected)}</div>
        </section>

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
          <div class="flow-step">3. Configure launchpad</div>
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
                <input name="name" value="${createDraft.name}" placeholder="name here" required />
              </div>
              <div class="field">
                <label>Slug / subdomain</label>
                <input name="slug" value="${createDraft.slug}" placeholder="slug here" required />
              </div>
              <div class="field">
                <label>Description</label>
                <textarea name="description" placeholder="description here">${createDraft.description}</textarea>
              </div>
              <div class="field">
                <label>Additional platform fee (bps)</label>
                <input name="additionalFeeBps" type="number" value="${createDraft.additionalFeeBps}" placeholder="50" min="0" max="1000" />
              </div>
              <button class="primary-action">Create Launchpad</button>
            </form>
          </div>
          `
          }

          <div class="panel preview">
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
                      ${
                        tenantView
                          ? ""
                          : `<div class="cta-row"><button class="primary-action" id="openSelectedLaunchpad">Open Launchpad</button></div>`
                      }
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
                    <input name="name" value="${tokenDraft.name}" placeholder="token name here" required />
                  </div>
                  <div class="field">
                    <label>Symbol</label>
                    <input name="symbol" value="${tokenDraft.symbol}" placeholder="symbol here" required />
                  </div>
                </div>
                <div class="inline">
                  <div class="field">
                    <label>Decimals</label>
                    <input name="decimals" type="number" value="${tokenDraft.decimals}" placeholder="18" min="6" max="18" />
                  </div>
                  <div class="field">
                    <label>Initial supply</label>
                    <input name="initialSupply" value="${tokenDraft.initialSupply}" placeholder="1000000" />
                  </div>
                </div>
                <div class="field">
                  <label>Contract URI</label>
                  <input name="contractURI" value="${tokenDraft.contractURI}" placeholder="contract URI here" />
                </div>
                <button class="primary-action">Launch Token</button>
              </form>
              `
                  : tenantView
                    ? `<div class="notice error">This launchpad does not exist yet. Create it from ${appConfig.appUrl || appConfig.baseDomain || "the root app"} first.</div>`
                    : `<div class="notice">${
                        selected
                          ? `Open ${launchpadUrl(selected.slug)} to launch a token under that launchpad.`
                          : "Create the first custom launchpad, then open its subdomain to launch tokens under it."
                      }</div>`
              }
            </div>
          </div>
        </section>

        ${
          tenantView
            ? ""
            : `
        <section class="panel">
          <div class="section-heading">
            <div>
              <h2>Popular Custom Launchpads</h2>
              <p class="muted">Discover active launchpads with the strongest launch activity and market momentum.</p>
            </div>
          </div>
          <div class="token-grid">${launchpadCardsHtml(selected)}</div>
        </section>
        `
        }

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
  document.querySelectorAll(".open-launchpad-card").forEach((button) => {
    button.addEventListener("click", () => {
      window.open(`${window.location.protocol}//${launchpadUrl(button.dataset.slug)}`, "_blank", "noopener,noreferrer");
    });
  });
  document.querySelector("#openSelectedLaunchpad")?.addEventListener("click", () => {
    const launchpad = activeLaunchpad();
    if (launchpad) {
      window.open(`${window.location.protocol}//${launchpadUrl(launchpad.slug)}`, "_blank", "noopener,noreferrer");
    }
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
}

function renderAdmin() {
  const totalTokens = state.popularLaunchpads.reduce((total, item) => total + item.stats.tokenCount, 0);
  const isErrorMessage = state.message && /required|invalid|failed|error/i.test(state.message);
  const messageClass = isErrorMessage ? "notice error" : "notice";
  const loginDraft = state.adminLoginDraft;
  const session = state.adminSession || { authenticated: false };

  document.querySelector("#app").innerHTML = `
    <main class="shell">
      <aside class="sidebar">
        <div class="brand">
          <a class="home-link" href="${rootLaunchpadUrl()}">Home</a>
          <strong>Admin</strong>
          <span>Launchpad Operations</span>
        </div>

        <div class="stats">
          <div class="stat"><b>${state.launchpads.length}</b><span>Launchpads</span></div>
          <div class="stat"><b>${totalTokens}</b><span>Total tokens</span></div>
        </div>

        <p class="muted">Admin access uses credentials configured in .env and stays active for 24 hours.</p>
      </aside>

      <section class="main">
        <div class="topbar">
          <div>
            <h1>Admin Console</h1>
            <div class="muted">Restricted operations for this MVP environment.</div>
          </div>
        </div>

        ${state.message ? `<div class="${messageClass}">${state.message}</div>` : ""}

        ${
          session.authenticated
            ? `
        <section class="panel">
          <h2>Access</h2>
          <div class="pill-row">
            <span class="pill">Authenticated</span>
            <span class="pill">Expires ${formatDateTime(session.expiresAt)}</span>
          </div>
          <p class="muted">This admin session is stored in a 24-hour HttpOnly cookie.</p>
          <button class="secondary-action" id="adminLogout">Log Out</button>
        </section>

        <section class="panel danger-panel">
          <h2>Danger Zone</h2>
          <p class="muted">This clears local MVP launchpads, tokens, events, and popular launchpad stats. It does not delete code or configuration.</p>
          <button class="danger-action" id="clearLaunchpadData">Clear Launchpad Data</button>
        </section>
        `
            : `
        <section class="panel">
          <h2>Admin Login</h2>
          <form class="form" id="adminLoginForm">
            <div class="field">
              <label>Username</label>
              <input name="username" value="${loginDraft.username}" autocomplete="username" required />
            </div>
            <div class="field">
              <label>Password</label>
              <input name="password" type="password" value="" autocomplete="current-password" required />
            </div>
            <button class="primary-action">Log In</button>
          </form>
          <p class="muted">Use ADMIN_USERNAME and ADMIN_PASSWORD from .env. No wallet connection is required for admin operations.</p>
        </section>
        `
        }
      </section>
    </main>
  `;

  document.querySelector("#adminLoginForm")?.addEventListener("submit", adminLogin);
  document.querySelector("#adminLoginForm")?.addEventListener("input", (event) => {
    state.adminLoginDraft[event.target.name] = event.target.value;
  });
  document.querySelector("#adminLogout")?.addEventListener("click", adminLogout);
  document.querySelector("#clearLaunchpadData")?.addEventListener("click", clearLaunchpadData);
}

load().catch((error) => {
  state.message = error.message;
  render();
});
