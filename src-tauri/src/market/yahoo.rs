use super::{provider::MarketDataProvider, ChartPoint, ChartRange, Quote};
use async_trait::async_trait;
use futures::future::join_all;
use reqwest::{Client, StatusCode};
use serde::Deserialize;

#[derive(Clone)]
pub struct YahooFinanceProvider {
    client: Client,
    base_url: String,
}
impl YahooFinanceProvider {
    pub fn new() -> Self {
        Self {
            client: Client::builder()
                .user_agent("Mozilla/5.0 TickerDeck/0.1")
                .timeout(std::time::Duration::from_secs(8))
                .build()
                .expect("HTTP client"),
            // query1 is frequently rate-limited for anonymous desktop clients;
            // query2 serves the same chart API and is more reliable here.
            base_url: "https://query2.finance.yahoo.com".into(),
        }
    }
    async fn chart(
        &self,
        symbol: &str,
        range: &str,
        interval: &str,
    ) -> Result<YahooResult, String> {
        let url = format!(
            "{}/v8/finance/chart/{}?range={}&interval={}&includePrePost=false&events=div%2Csplits",
            self.base_url,
            urlencoding::encode(symbol),
            range,
            interval
        );
        let response = self
            .client
            .get(url)
            .send()
            .await
            .map_err(|error| format!("network: {error}"))?;
        if response.status() == StatusCode::TOO_MANY_REQUESTS {
            return Err("Yahoo rate limited request".into());
        }
        if !response.status().is_success() {
            return Err(format!("Yahoo HTTP {}", response.status()));
        }
        let body: YahooResponse = response
            .json()
            .await
            .map_err(|error| format!("malformed Yahoo response: {error}"))?;
        body.chart
            .result
            .and_then(|mut values| values.pop())
            .ok_or_else(|| {
                body.chart
                    .error
                    .and_then(|error| error.description)
                    .unwrap_or_else(|| "symbol unavailable".into())
            })
    }
}
#[async_trait]
impl MarketDataProvider for YahooFinanceProvider {
    async fn get_quotes(&self, symbols: &[String]) -> Vec<Result<Quote, String>> {
        join_all(symbols.iter().map(|symbol| async move {
            let result = self.chart(symbol, "1d", "1m").await?;
            normalize_quote(
                symbol,
                result.meta.regular_market_price.ok_or("missing price")?,
                result
                    .meta
                    .chart_previous_close
                    .or(result.meta.previous_close)
                    .ok_or("missing previous close")?,
                result.meta.regular_market_time.unwrap_or_default(),
            )
        }))
        .await
    }
    async fn get_charts(
        &self,
        symbols: &[String],
        range: ChartRange,
    ) -> Vec<Result<Vec<ChartPoint>, String>> {
        let (period, interval, _) = range.yahoo();
        join_all(symbols.iter().map(|symbol| async move {
            let result = self.chart(symbol, period, interval).await?;
            normalize_chart(result)
        }))
        .await
    }
}
pub fn normalize_quote(
    symbol: &str,
    price: f64,
    previous_close: f64,
    timestamp: i64,
) -> Result<Quote, String> {
    if !price.is_finite() || !previous_close.is_finite() || previous_close <= 0.0 {
        return Err("invalid quote values".into());
    }
    let change = price - previous_close;
    Ok(Quote {
        symbol: symbol.into(),
        price,
        previous_close,
        change,
        change_percent: change / previous_close * 100.0,
        timestamp,
    })
}
fn normalize_chart(result: YahooResult) -> Result<Vec<ChartPoint>, String> {
    let prices = result
        .indicators
        .quote
        .first()
        .and_then(|quote| quote.close.as_ref())
        .ok_or("missing candles")?;
    let points = result
        .timestamp
        .unwrap_or_default()
        .into_iter()
        .zip(prices)
        .filter_map(|(timestamp, price)| {
            price
                .filter(|value| value.is_finite())
                .map(|price| ChartPoint { timestamp, price })
        })
        .collect::<Vec<_>>();
    if points.len() < 2 {
        Err("insufficient candles".into())
    } else {
        Ok(points)
    }
}

#[derive(Deserialize)]
struct YahooResponse {
    chart: YahooChart,
}
#[derive(Deserialize)]
struct YahooChart {
    result: Option<Vec<YahooResult>>,
    error: Option<YahooError>,
}
#[derive(Deserialize)]
struct YahooError {
    description: Option<String>,
}
#[derive(Deserialize)]
struct YahooResult {
    meta: YahooMeta,
    timestamp: Option<Vec<i64>>,
    indicators: YahooIndicators,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct YahooMeta {
    regular_market_price: Option<f64>,
    regular_market_time: Option<i64>,
    chart_previous_close: Option<f64>,
    previous_close: Option<f64>,
}
#[derive(Deserialize)]
struct YahooIndicators {
    #[serde(default)]
    quote: Vec<YahooQuote>,
}
#[derive(Deserialize)]
struct YahooQuote {
    close: Option<Vec<Option<f64>>>,
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn normalizes_missing_candles_without_fabrication() {
        let json = r#"{"meta":{"regularMarketPrice":2,"chartPreviousClose":1},"timestamp":[1,2,3],"indicators":{"quote":[{"close":[1.0,null,2.0]}]}}"#;
        let value: YahooResult = serde_json::from_str(json).unwrap();
        assert_eq!(
            normalize_chart(value).unwrap(),
            vec![
                ChartPoint {
                    timestamp: 1,
                    price: 1.0
                },
                ChartPoint {
                    timestamp: 3,
                    price: 2.0
                }
            ]
        );
    }
    #[test]
    fn rejects_bad_quote_values() {
        assert!(normalize_quote("BAD", f64::NAN, 1.0, 0).is_err());
        assert!(normalize_quote("BAD", 1.0, 0.0, 0).is_err());
    }
    #[test]
    fn normalizes_chart_metadata_as_quote() {
        let quote = normalize_quote("NVDA", 182.31, 180.0, 42).unwrap();
        assert_eq!(quote.symbol, "NVDA");
        assert!((quote.change - 2.31).abs() < 0.001);
    }
}
