renderNav("news");

const stockId = getSelectedStockId();
const stock = getStock(stockId);
document.getElementById("mm-title").textContent = `News — ${stock.symbol}`;

// Field names below are guesses at the GET /news/{stockId} item shape —
// adjust to match your actual News DTO.
function renderNews(items) {
  const grid = document.getElementById("news-grid");
  const empty = document.getElementById("news-empty");
  if (!items || items.length === 0) {
    grid.innerHTML = "";
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  grid.innerHTML = items
    .map(
      (n) => `<article class="news-item">
        <div class="news-item__headline">${n.title ?? n.headline ?? "Untitled"}</div>
        <div class="news-item__meta">${n.source ?? ""} ${n.publishedAt ? "· " + new Date(n.publishedAt).toLocaleDateString() : ""}</div>
        <div class="news-item__body">${n.content ?? n.summary ?? ""}</div>
      </article>`
    )
    .join("");
}

async function loadNews() {
  try {
    const items = await apiGet(`/news/${stockId}`);
    renderNews(items);
  } catch (err) {
    showError(`Could not load news: ${err.message}`);
  }
}

document.getElementById("refresh-btn").addEventListener("click", async () => {
  showError(null);
  const btn = document.getElementById("refresh-btn");
  btn.disabled = true;
  btn.textContent = "Refreshing…";
  try {
    await apiPost(`/news/${stockId}`);
    await loadNews();
  } catch (err) {
    showError(`Refresh failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = "Refresh";
  }
});

window.addEventListener("mm:stock-changed", () => window.location.reload());

loadNews();