import os

import requests
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
from model import predict_stock
from sentiment import analyze_sentiment

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this to your actual frontend origin in production
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

SYMBOL_MAP = {1: "AAPL", 4: "GOOGL", 5: "MSFT", 6: "AMZN"}
FINNHUB_KEY = os.getenv("FINNHUB_API_KEY", "")


class PredictionRequest(BaseModel):
    stockId: int
    newsTitle: str = ""
    newsContent: str = ""


class PredictionResponse(BaseModel):
    prediction: str
    probability: float


class SentimentResponse(BaseModel):
    sentiment: float


@app.get("/")
def root():
    return {"message": "ML Service Running"}


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):

    prediction, probability = predict_stock(request.stockId)

    return PredictionResponse(
        prediction=prediction,
        probability=probability
    )


@app.post("/sentiment", response_model=SentimentResponse)
def sentiment(request: PredictionRequest):

    score = analyze_sentiment(
        request.newsTitle,
        request.newsContent
    )

    return SentimentResponse(
        sentiment=score
    )


@app.get("/live-price/{stock_id}")
def get_live_price(stock_id: int):
    symbol = SYMBOL_MAP.get(stock_id)
    if not symbol:
        return {"error": "Unknown stock ID"}

    data = yf.Ticker(symbol).history(period="1d", interval="1m")
    if data.empty:
        return {"error": "No data available"}

    last = data.iloc[-1]
    return {
        "time": data.index[-1].strftime("%Y-%m-%d %H:%M:%S"),
        "open": float(last["Open"]),
        "high": float(last["High"]),
        "low": float(last["Low"]),
        "close": float(last["Close"]),
    }


@app.get("/live-chart/{stock_id}")
def get_live_chart(stock_id: int):
    symbol = SYMBOL_MAP.get(stock_id)
    if not symbol:
        return {"error": "Unknown stock ID"}

    data = yf.Ticker(symbol).history(period="5d", interval="5m")
    if data.empty:
        return {"error": "No data available"}

    bars = []
    for ts, row in data.iterrows():
        bars.append({
            "time": int(ts.timestamp()),
            "open": float(row["Open"]),
            "high": float(row["High"]),
            "low": float(row["Low"]),
            "close": float(row["Close"]),
        })
    return bars


@app.get("/quote/{stock_id}")
def get_quote(stock_id: int):
    symbol = SYMBOL_MAP.get(stock_id)
    if not symbol:
        return {"error": "Unknown stock ID"}
    if not FINNHUB_KEY:
        return {"error": "FINNHUB_API_KEY is not set"}

    r = requests.get(
        "https://finnhub.io/api/v1/quote",
        params={"symbol": symbol, "token": FINNHUB_KEY},
        timeout=10,
    )
    if r.status_code != 200:
        return {"error": f"Finnhub returned {r.status_code}"}

    q = r.json()
    if not q.get("c"):
        return {"error": "No price returned"}

    # c = current price, t = time of the last trade (unix seconds)
    return {"price": q["c"], "time": q["t"]}