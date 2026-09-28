renderNav("analysis");

const stockId = getSelectedStockId();
const stock = getStock(stockId);
document.getElementById("mm-title").textContent = `Analysis — ${stock.symbol}`;

let chart, series;
let candles = [];

// Field names below are guesses at the GET /price-history/{stockId} shape —
// adjust to match your actual PriceHistory DTO (date/open/high/low/close).
function toChartData(history) {
    return history
        .map((row) => ({
            time: (row.date ?? row.priceDate ?? row.timestamp ?? "").slice(0, 10),
            open: row.open ?? row.openPrice,
            high: row.high ?? row.highPrice,
            low: row.low ?? row.lowPrice,
            close: row.close ?? row.closePrice ?? row.price,
        }))
        .filter((r) => r.time && r.close != null)
        .sort((a, b) => (a.time > b.time ? 1 : -1));
}

function buildChart() {
    const el = document.getElementById("mm-chart");
    chart = LightweightCharts.createChart(el, {
        layout: { background: { color: "#0B0E14" }, textColor: "#E6E8EB", fontFamily: "IBM Plex Mono, monospace" },
        grid: { vertLines: { color: "#1B2028" }, horzLines: { color: "#1B2028" } },
        rightPriceScale: { borderColor: "#262B33" },
        timeScale: { borderColor: "#262B33" },
        width: el.clientWidth,
        height: 380,
    });
    setSeries("candlestick");
    window.addEventListener("resize", () => chart.applyOptions({ width: el.clientWidth }));
}

function setSeries(type) {
    if (series) chart.removeSeries(series);
    if (type === "candlestick") {
        series = chart.addCandlestickSeries({
            upColor: "#22C55E", downColor: "#EF4444", borderVisible: false,
            wickUpColor: "#22C55E", wickDownColor: "#EF4444",
        });
        series.setData(candles);
    } else if (type === "line") {
        series = chart.addLineSeries({ color: "#E6E8EB", lineWidth: 2 });
        series.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    } else {
        series = chart.addAreaSeries({
            lineColor: "#E6E8EB", topColor: "rgba(230,232,235,0.15)", bottomColor: "rgba(230,232,235,0.02)",
        });
        series.setData(candles.map((c) => ({ time: c.time, value: c.close })));
    }
}

document.querySelectorAll(".chart-controls button").forEach((btn) => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".chart-controls button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        setSeries(btn.dataset.type);
    });
});

async function loadChart() {
    try {
        const history = await apiGet(`/price-history/${stockId}`);
        candles = toChartData(history);
        buildChart();
    } catch (err) {
        showError(`Could not load price history: ${err.message}`);
    }
}

// --- Analyze & Predict, with 15s cooldown ---

const COOLDOWN_MS = 15000;
const btn = document.getElementById("mm-predict-btn");
const cooldownKey = () => `mm_cooldown_${stockId}`;
const historyKey = () => `mm_history_${stockId}`;

function updateButtonState() {
    const until = Number(localStorage.getItem(cooldownKey()) || 0);
    const remaining = until - Date.now();
    if (remaining > 0) {
        btn.disabled = true;
        btn.textContent = `Wait ${Math.ceil(remaining / 1000)}s`;
        setTimeout(updateButtonState, 500);
    } else {
        btn.disabled = false;
        btn.textContent = "Analyze & Predict";
    }
}

function loadHistoryTable() {
    const rows = JSON.parse(localStorage.getItem(historyKey()) || "[]");
    const body = document.getElementById("history-body");
    const empty = document.getElementById("history-empty");
    if (rows.length === 0) {
        body.innerHTML = "";
        empty.hidden = false;
        return;
    }
    empty.hidden = true;
    body.innerHTML = rows
        .slice()
        .reverse()
        .map(
            (r) => `<tr>
        <td>${new Date(r.time).toLocaleString()}</td>
        <td>${r.prediction ?? "—"}</td>
        <td>${formatPct(r.confidence)}</td>
        <td>${formatPct(r.sentiment)}</td>
        <td>${r.decision ?? "—"}</td>
      </tr>`
        )
        .join("");
}

function appendHistory(entry) {
    const rows = JSON.parse(localStorage.getItem(historyKey()) || "[]");
    rows.push(entry);
    localStorage.setItem(historyKey(), JSON.stringify(rows.slice(-25)));
    loadHistoryTable();
}

// Fallback only — used if the backend response has no explicit decision field.
function deriveDecision(prediction, sentiment) {
    if (prediction === "UP" && sentiment >= 0.5) return "BUY";
    if (prediction === "DOWN" && sentiment < 0.5) return "SELL";
    return "HOLD";
}

async function runPredict() {
    showError(null);
    btn.disabled = true;
    btn.textContent = "Analyzing…";
    try {
        // Field names below are guesses at the POST /predictions/{stockId} response
        // shape — adjust to match your actual PredictionResponse DTO.
        const result = await apiPost(`/predictions/${stockId}`);

        const prediction = result.prediction ?? result.direction;
        const confidence = result.probability ?? result.confidence;
        const sentiment = result.sentiment ?? result.sentimentScore;
        const decision = result.decision ?? deriveDecision(prediction, sentiment);
        const reason = result.reason ?? result.decisionReason ?? "";

        const predEl = document.getElementById("pred-value");
        predEl.textContent = prediction ?? "—";
        predEl.className = "result-box__value " + (prediction === "UP" ? "up" : prediction === "DOWN" ? "down" : "");
        document.getElementById("pred-sub").textContent = confidence != null ? `Confidence: ${formatPct(confidence)}` : "";

        const decEl = document.getElementById("decision-value");
        decEl.textContent = decision;
        decEl.className = "result-box__value " + (decision === "BUY" ? "up" : decision === "SELL" ? "down" : "hold");
        document.getElementById("decision-sub").textContent = reason;

        const sentPct = sentiment != null ? Math.round(sentiment * 100) : 0;
        document.getElementById("sentiment-fill").style.width = `${sentPct}%`;
        document.getElementById("sentiment-value").textContent = sentiment != null ? formatPct(sentiment) : "—";

        appendHistory({ time: Date.now(), prediction, confidence, sentiment, decision });
        localStorage.setItem(cooldownKey(), String(Date.now() + COOLDOWN_MS));
    } catch (err) {
        showError(`Prediction failed: ${err.message}`);
    } finally {
        updateButtonState();
    }
}

btn.addEventListener("click", runPredict);
window.addEventListener("mm:stock-changed", () => window.location.reload());

loadChart();
updateButtonState();
loadHistoryTable();