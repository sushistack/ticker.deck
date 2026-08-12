pub mod binance;
pub mod hybrid;
pub mod provider;
pub mod yahoo;

use provider::MarketDataProvider;
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    time::{Duration, Instant},
};
use tokio::sync::RwLock;

#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Quote {
    pub symbol: String,
    pub price: f64,
    pub previous_close: f64,
    pub change: f64,
    pub change_percent: f64,
    pub timestamp: i64,
}
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct ChartPoint {
    pub timestamp: i64,
    pub price: f64,
}
#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
pub enum ChartRange {
    #[serde(rename = "1D")]
    OneDay,
    #[serde(rename = "1M")]
    OneMonth,
}
impl ChartRange {
    pub fn yahoo(self) -> (&'static str, &'static str, Duration) {
        match self {
            Self::OneDay => ("1d", "5m", Duration::from_secs(60)),
            Self::OneMonth => ("1mo", "1h", Duration::from_secs(600)),
        }
    }
}
#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct MarketSnapshot {
    pub symbol: String,
    pub quote: Option<Quote>,
    pub chart: Vec<ChartPoint>,
    pub stale: bool,
    pub error: Option<String>,
}
struct CacheEntry<T> {
    value: T,
    updated: Instant,
}
type ChartCache = HashMap<(String, ChartRange), CacheEntry<Vec<ChartPoint>>>;

pub struct MarketService<P: MarketDataProvider> {
    provider: P,
    quotes: RwLock<HashMap<String, CacheEntry<Quote>>>,
    charts: RwLock<ChartCache>,
}
impl<P: MarketDataProvider> MarketService<P> {
    pub fn new(provider: P) -> Self {
        Self {
            provider,
            quotes: Default::default(),
            charts: Default::default(),
        }
    }
    pub async fn quotes(&self, symbols: Vec<String>) -> Vec<MarketSnapshot> {
        let now = Instant::now();
        let cache = self.quotes.read().await;
        let stale_symbols: Vec<String> = symbols
            .iter()
            .filter(|symbol| {
                cache
                    .get(*symbol)
                    .is_none_or(|entry| now.duration_since(entry.updated) >= Duration::from_secs(4))
            })
            .cloned()
            .collect();
        drop(cache);
        let fetched = if stale_symbols.is_empty() {
            Vec::new()
        } else {
            self.provider.get_quotes(&stale_symbols).await
        };
        let mut cache = self.quotes.write().await;
        let mut failures = HashMap::new();
        for (symbol, result) in stale_symbols.iter().zip(fetched) {
            match result {
                Ok(quote) => {
                    cache.insert(
                        symbol.clone(),
                        CacheEntry {
                            value: quote,
                            updated: now,
                        },
                    );
                }
                Err(error) => {
                    failures.insert(symbol.clone(), error);
                }
            }
        }
        symbols
            .into_iter()
            .map(|symbol| MarketSnapshot {
                quote: cache.get(&symbol).map(|entry| entry.value.clone()),
                stale: failures.contains_key(&symbol) || !cache.contains_key(&symbol),
                error: failures
                    .get(&symbol)
                    .cloned()
                    .or_else(|| (!cache.contains_key(&symbol)).then(|| "quote unavailable".into())),
                symbol,
                chart: vec![],
            })
            .collect()
    }
    pub async fn charts(&self, symbols: Vec<String>, range: ChartRange) -> Vec<MarketSnapshot> {
        let ttl = range.yahoo().2;
        let now = Instant::now();
        let cache = self.charts.read().await;
        let stale_symbols: Vec<String> = symbols
            .iter()
            .filter(|symbol| {
                cache
                    .get(&(String::from(*symbol), range))
                    .is_none_or(|entry| now.duration_since(entry.updated) >= ttl)
            })
            .cloned()
            .collect();
        drop(cache);
        let fetched = if stale_symbols.is_empty() {
            Vec::new()
        } else {
            self.provider.get_charts(&stale_symbols, range).await
        };
        let mut cache = self.charts.write().await;
        let mut failures = HashMap::new();
        for (symbol, result) in stale_symbols.iter().zip(fetched) {
            match result {
                Ok(points) => {
                    cache.insert(
                        (symbol.clone(), range),
                        CacheEntry {
                            value: points,
                            updated: now,
                        },
                    );
                }
                Err(error) => {
                    failures.insert(symbol.clone(), error);
                }
            }
        }
        symbols
            .into_iter()
            .map(|symbol| {
                let points = cache
                    .get(&(symbol.clone(), range))
                    .map(|entry| entry.value.clone())
                    .unwrap_or_default();
                MarketSnapshot {
                    stale: failures.contains_key(&symbol) || points.is_empty(),
                    error: failures
                        .get(&symbol)
                        .cloned()
                        .or_else(|| points.is_empty().then(|| "chart unavailable".into())),
                    symbol,
                    quote: None,
                    chart: points,
                }
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;
    use std::sync::{
        atomic::{AtomicBool, AtomicUsize, Ordering},
        Arc,
    };

    struct FakeProvider {
        calls: Arc<AtomicUsize>,
        fail: Arc<AtomicBool>,
    }
    #[async_trait]
    impl MarketDataProvider for FakeProvider {
        async fn get_quotes(&self, symbols: &[String]) -> Vec<Result<Quote, String>> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            symbols
                .iter()
                .map(|symbol| {
                    if self.fail.load(Ordering::SeqCst) {
                        Err("offline".into())
                    } else {
                        Ok(Quote {
                            symbol: symbol.clone(),
                            price: 2.0,
                            previous_close: 1.0,
                            change: 1.0,
                            change_percent: 100.0,
                            timestamp: 1,
                        })
                    }
                })
                .collect()
        }
        async fn get_charts(
            &self,
            symbols: &[String],
            _range: ChartRange,
        ) -> Vec<Result<Vec<ChartPoint>, String>> {
            symbols.iter().map(|_| Ok(vec![])).collect()
        }
    }
    #[test]
    fn maps_ranges_to_sensible_yahoo_intervals() {
        assert_eq!(ChartRange::OneDay.yahoo().0, "1d");
        assert_eq!(ChartRange::OneDay.yahoo().1, "5m");
        assert_eq!(ChartRange::OneMonth.yahoo().1, "1h");
    }
    #[test]
    fn calculates_change() {
        let quote = yahoo::normalize_quote("NVDA", 182.31, 180.0, 1).unwrap();
        assert!((quote.change - 2.31).abs() < 0.001);
        assert!((quote.change_percent - 1.2833).abs() < 0.001);
    }
    #[tokio::test]
    async fn fresh_quote_cache_avoids_duplicate_prewarm_fetch() {
        let calls = Arc::new(AtomicUsize::new(0));
        let service = MarketService::new(FakeProvider {
            calls: calls.clone(),
            fail: Arc::new(AtomicBool::new(false)),
        });
        let first = service.quotes(vec!["BTC-USD".into()]).await;
        let second = service.quotes(vec!["BTC-USD".into()]).await;
        assert_eq!(calls.load(Ordering::SeqCst), 1);
        assert_eq!(first[0].quote, second[0].quote);
    }
    #[tokio::test]
    async fn failed_refresh_keeps_last_quote_and_marks_stale() {
        let fail = Arc::new(AtomicBool::new(false));
        let service = MarketService::new(FakeProvider {
            calls: Arc::new(AtomicUsize::new(0)),
            fail: fail.clone(),
        });
        let _ = service.quotes(vec!["QQQ".into()]).await;
        service.quotes.write().await.get_mut("QQQ").unwrap().updated =
            Instant::now() - Duration::from_secs(5);
        fail.store(true, Ordering::SeqCst);
        let result = service.quotes(vec!["QQQ".into()]).await;
        assert!(result[0].stale);
        assert_eq!(result[0].quote.as_ref().map(|quote| quote.price), Some(2.0));
        assert_eq!(result[0].error.as_deref(), Some("offline"));
    }
}
