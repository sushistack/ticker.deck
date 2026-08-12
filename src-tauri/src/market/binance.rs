use super::{provider::MarketDataProvider, ChartPoint, ChartRange, Quote};
use async_trait::async_trait;
use futures::future::join_all;
use reqwest::Client;
use serde::Deserialize;

#[derive(Clone)]
pub struct BinanceProvider {
    client: Client,
    base_url: String,
}

impl BinanceProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("TickerDeck/0.1")
                .timeout(std::time::Duration::from_secs(8))
                .build()
                .expect("HTTP client"),
            base_url: "https://api.binance.com".into(),
        }
    }

    async fn ticker(&self, symbol: &str) -> Result<Quote, String> {
        let pair = binance_pair(symbol)?;
        let response = self
            .client
            .get(format!("{}/api/v3/ticker/24hr", self.base_url))
            .query(&[("symbol", pair)])
            .send()
            .await
            .map_err(|error| format!("Binance network: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("Binance HTTP {}", response.status()));
        }
        let ticker: BinanceTicker = response
            .json()
            .await
            .map_err(|error| format!("malformed Binance ticker: {error}"))?;
        normalize_ticker(symbol, ticker)
    }

    async fn klines(&self, symbol: &str, range: ChartRange) -> Result<Vec<ChartPoint>, String> {
        let pair = binance_pair(symbol)?;
        let (interval, limit) = match range {
            ChartRange::OneDay => ("5m", "288"),
            ChartRange::OneMonth => ("1h", "720"),
        };
        let response = self
            .client
            .get(format!("{}/api/v3/klines", self.base_url))
            .query(&[("symbol", pair), ("interval", interval), ("limit", limit)])
            .send()
            .await
            .map_err(|error| format!("Binance network: {error}"))?;
        if !response.status().is_success() {
            return Err(format!("Binance HTTP {}", response.status()));
        }
        let rows: Vec<Vec<serde_json::Value>> = response
            .json()
            .await
            .map_err(|error| format!("malformed Binance klines: {error}"))?;
        normalize_klines(rows)
    }
}

#[async_trait]
impl MarketDataProvider for BinanceProvider {
    async fn get_quotes(&self, symbols: &[String]) -> Vec<Result<Quote, String>> {
        join_all(symbols.iter().map(|symbol| self.ticker(symbol))).await
    }

    async fn get_charts(
        &self,
        symbols: &[String],
        range: ChartRange,
    ) -> Vec<Result<Vec<ChartPoint>, String>> {
        join_all(symbols.iter().map(|symbol| self.klines(symbol, range))).await
    }
}

pub fn binance_pair(symbol: &str) -> Result<&str, String> {
    symbol
        .strip_suffix("-USD")
        .filter(|base| !base.is_empty())
        .map(|base| match base {
            "BTC" => "BTCUSDT",
            "ETH" => "ETHUSDT",
            "SOL" => "SOLUSDT",
            "XRP" => "XRPUSDT",
            "DOGE" => "DOGEUSDT",
            "ZEC" => "ZECUSDT",
            "BNB" => "BNBUSDT",
            "ADA" => "ADAUSDT",
            "LINK" => "LINKUSDT",
            "AVAX" => "AVAXUSDT",
            _ => "",
        })
        .filter(|pair| !pair.is_empty())
        .ok_or_else(|| format!("unsupported Binance symbol: {symbol}"))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct BinanceTicker {
    last_price: String,
    price_change: String,
    price_change_percent: String,
    close_time: i64,
}

fn normalize_ticker(symbol: &str, ticker: BinanceTicker) -> Result<Quote, String> {
    let price = parse_number(&ticker.last_price)?;
    let change = parse_number(&ticker.price_change)?;
    let change_percent = parse_number(&ticker.price_change_percent)?;
    let previous_close = price - change;
    if previous_close <= 0.0 {
        return Err("invalid Binance previous close".into());
    }
    Ok(Quote {
        symbol: symbol.into(),
        price,
        previous_close,
        change,
        change_percent,
        timestamp: ticker.close_time / 1000,
    })
}

fn normalize_klines(rows: Vec<Vec<serde_json::Value>>) -> Result<Vec<ChartPoint>, String> {
    let points = rows
        .into_iter()
        .filter_map(|row| {
            let timestamp = row.first()?.as_i64()? / 1000;
            let price = row.get(4)?.as_str()?.parse::<f64>().ok()?;
            price.is_finite().then_some(ChartPoint { timestamp, price })
        })
        .collect::<Vec<_>>();
    if points.len() < 2 {
        Err("insufficient Binance candles".into())
    } else {
        Ok(points)
    }
}

fn parse_number(value: &str) -> Result<f64, String> {
    value
        .parse::<f64>()
        .ok()
        .filter(|number| number.is_finite())
        .ok_or_else(|| format!("invalid Binance number: {value}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_ui_symbols_to_usdt_pairs() {
        assert_eq!(binance_pair("BTC-USD").unwrap(), "BTCUSDT");
        assert_eq!(binance_pair("ZEC-USD").unwrap(), "ZECUSDT");
        assert_eq!(binance_pair("AVAX-USD").unwrap(), "AVAXUSDT");
        assert!(binance_pair("NVDA").is_err());
    }

    #[test]
    fn normalizes_24_hour_ticker() {
        let quote = normalize_ticker(
            "BTC-USD",
            BinanceTicker {
                last_price: "120.5".into(),
                price_change: "2.5".into(),
                price_change_percent: "2.118".into(),
                close_time: 1_700_000_000_000,
            },
        )
        .unwrap();
        assert_eq!(quote.price, 120.5);
        assert_eq!(quote.previous_close, 118.0);
        assert_eq!(quote.timestamp, 1_700_000_000);
    }

    #[test]
    fn parses_kline_close_values() {
        let rows = vec![
            vec![
                serde_json::json!(1_000),
                serde_json::Value::Null,
                serde_json::Value::Null,
                serde_json::Value::Null,
                serde_json::json!("10.5"),
            ],
            vec![
                serde_json::json!(2_000),
                serde_json::Value::Null,
                serde_json::Value::Null,
                serde_json::Value::Null,
                serde_json::json!("11.0"),
            ],
        ];
        let points = normalize_klines(rows).unwrap();
        assert_eq!(points[1].price, 11.0);
    }
}
