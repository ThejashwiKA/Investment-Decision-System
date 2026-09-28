// shared.js — MarketMind: navigation, stock selector, search, and API helpers
// used across index.html / analysis.html / news.html

const API_BASE = "http://localhost:8080";

// Stock ID mapping is fixed across backend, frontend and ML service.
const STOCKS = [
  { id: 1, symbol: "AAPL", name: "Apple Inc." },
  { id: 4, symbol: "GOOGL", name: "Alphabet Inc." },
  { id: 5, symbol: "MSFT", name: "Microsoft Corp." },
  { id: 6, symbol: "AMZN", name: "Amazon.com Inc." },
];

function getStock(id) {
  return STOCKS.find((s) => s.id === Number(id));
}

function getSelectedStockId() {
  const stored = localStorage.getItem("mm_selected_stock");
  return stored ? Number(stored) : STOCKS[0].id;
}

function setSelectedStockId(id) {
  localStorage.setItem("mm_selected_stock", String(id));
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
  return res.json();
}

// Renders the shared masthead + nav + search + stock selector into #mm-nav.
// activePage is one of "home" | "analysis" | "news".
// The "Watching" selector is hidden on the home page.
function renderNav(activePage) {
  const mount = document.getElementById("mm-nav");
  if (!mount) return;

  const selected = getSelectedStockId();
  const options = STOCKS.map(
    (s) =>
      `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.symbol} — ${s.name}</option>`
  ).join("");

  const selector =
    activePage === "home"
      ? ""
      : `<label class="stock-select">
          <span>Watching</span>
          <select id="mm-stock-select">${options}</select>
        </label>`;

  mount.innerHTML = `
    <div class="masthead">
      <a class="masthead__title" href="index.html">MarketMind</a>
      <span class="masthead__rule">|</span>
      <span class="masthead__tagline">Ledger of Prices, Predictions &amp; News</span>
    </div>
    <div class="nav-row">
      <nav class="nav-links">
        <a href="index.html" class="${activePage === "home" ? "active" : ""}">Home</a>
        <a href="analysis.html" class="${activePage === "analysis" ? "active" : ""}">Analysis</a>
        <a href="news.html" class="${activePage === "news" ? "active" : ""}">News</a>
      </nav>
      <div class="nav-tools">
        <div class="stock-search">
          <input id="mm-search" type="search" placeholder="Search stock or symbol" autocomplete="off" aria-label="Search stocks" />
          <ul id="mm-search-results" class="search-results" hidden></ul>
        </div>
        ${selector}
      </div>
    </div>
  `;

  const select = document.getElementById("mm-stock-select");
  if (select) {
    select.addEventListener("change", (e) => {
      setSelectedStockId(e.target.value);
      window.dispatchEvent(new CustomEvent("mm:stock-changed", { detail: Number(e.target.value) }));
    });
  }

  setupSearch(activePage);
}

// Search: type a symbol or company name, click a result or press Enter.
// From Home/Analysis it opens Analysis; from News it stays on News.
function setupSearch(activePage) {
  const input = document.getElementById("mm-search");
  const list = document.getElementById("mm-search-results");
  if (!input || !list) return;

  const target = activePage === "news" ? "news.html" : "analysis.html";

  function matchesFor(query) {
    const q = query.trim().toLowerCase();
    return STOCKS.filter(
      (s) => s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }

  function go(id) {
    setSelectedStockId(id);
    window.location.href = target;
  }

  function render() {
    if (!input.value.trim()) {
      list.hidden = true;
      return;
    }
    const matches = matchesFor(input.value);
    list.hidden = false;
    list.innerHTML = matches.length
      ? matches
          .map((s) => `<li data-id="${s.id}"><span class="mono">${s.symbol}</span> ${s.name}</li>`)
          .join("")
      : `<li class="search-empty">No matching stock</li>`;
  }

  input.addEventListener("input", render);
  input.addEventListener("focus", render);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const matches = matchesFor(input.value);
      if (matches.length) go(matches[0].id);
    } else if (e.key === "Escape") {
      list.hidden = true;
    }
  });

  // mousedown fires before the input loses focus, so the click can't be lost
  list.addEventListener("mousedown", (e) => {
    const item = e.target.closest("li[data-id]");
    if (item) {
      e.preventDefault();
      go(item.dataset.id);
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".stock-search")) list.hidden = true;
  });
}

function showError(message) {
  const banner = document.getElementById("mm-error");
  if (!banner) return;
  if (!message) {
    banner.hidden = true;
    banner.textContent = "";
    return;
  }
  banner.hidden = false;
  banner.textContent = message;
}

function formatPrice(n) {
  return typeof n === "number" ? `$${n.toFixed(2)}` : "—";
}

function formatPct(n) {
  return typeof n === "number" ? `${(n * 100).toFixed(1)}%` : "—";
}