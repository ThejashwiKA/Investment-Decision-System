renderNav("home");

async function loadWatchlist() {
  const mount = document.getElementById("stock-list");
  mount.innerHTML = STOCKS.map(
    (s) => `<div class="stock-row" data-id="${s.id}">
      <div><span class="stock-row__name">${s.name}</span><span class="stock-row__symbol">${s.symbol}</span></div>
      <div class="stock-row__price mono" id="price-${s.id}">…</div>
    </div>`
  ).join("");

  mount.querySelectorAll(".stock-row").forEach((row) => {
    row.style.cursor = "pointer";
    row.addEventListener("click", () => {
      setSelectedStockId(row.dataset.id);
      window.location.href = "analysis.html";
    });
  });

  for (const s of STOCKS) {
    try {
      const history = await apiGet(`/price-history/${s.id}`);
      const last = Array.isArray(history) ? history[history.length - 1] : null;
      // Field name is a guess — adjust to match your actual price-history DTO
      // (e.g. close / closePrice / price).
      const price = last ? last.close ?? last.closePrice ?? last.price : null;
      document.getElementById(`price-${s.id}`).textContent = formatPrice(price);
    } catch (err) {
      document.getElementById(`price-${s.id}`).textContent = "—";
    }
  }
}

loadWatchlist().catch((err) => showError(err.message));