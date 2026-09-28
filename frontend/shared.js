// shared.js — MarketMind: navigation, stock selector, and API helpers
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

// Renders the shared masthead + nav + stock selector into #mm-nav.
// activePage is one of "home" | "analysis" | "news".
function renderNav(activePage) {
  const mount = document.getElementById("mm-nav");
  if (!mount) return;

  const selected = getSelectedStockId();
  const options = STOCKS.map(
    (s) =>
      `<option value="${s.id}" ${s.id === selected ? "selected" : ""}>${s.symbol} — ${s.name}</option>`
  ).join("");

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
      <label class="stock-select">
        <span>Watching</span>
        <select id="mm-stock-select">${options}</select>
      </label>
    </div>
  `;

  document.getElementById("mm-stock-select").addEventListener("change", (e) => {
    setSelectedStockId(e.target.value);
    window.dispatchEvent(new CustomEvent("mm:stock-changed", { detail: Number(e.target.value) }));
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