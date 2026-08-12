use super::{
    binance::BinanceProvider, provider::MarketDataProvider, yahoo::YahooFinanceProvider,
    ChartPoint, ChartRange, Quote,
};
use async_trait::async_trait;
use std::collections::HashMap;

#[derive(Clone)]
pub struct HybridMarketProvider {
    binance: BinanceProvider,
    yahoo: YahooFinanceProvider,
}

impl HybridMarketProvider {
    pub fn new() -> Self {
        Self {
            binance: BinanceProvider::new(),
            yahoo: YahooFinanceProvider::new(),
        }
    }
}

fn is_crypto(symbol: &str) -> bool {
    symbol.ends_with("-USD")
}

async fn route<T>(
    symbols: &[String],
    binance_results: Vec<Result<T, String>>,
    yahoo_results: Vec<Result<T, String>>,
) -> Vec<Result<T, String>> {
    let crypto_symbols = symbols.iter().filter(|symbol| is_crypto(symbol));
    let stock_symbols = symbols.iter().filter(|symbol| !is_crypto(symbol));
    let mut results = HashMap::new();
    for (symbol, result) in crypto_symbols.zip(binance_results) {
        results.insert(symbol.clone(), result);
    }
    for (symbol, result) in stock_symbols.zip(yahoo_results) {
        results.insert(symbol.clone(), result);
    }
    symbols
        .iter()
        .map(|symbol| {
            results
                .remove(symbol)
                .unwrap_or_else(|| Err("provider returned no result".into()))
        })
        .collect()
}

#[async_trait]
impl MarketDataProvider for HybridMarketProvider {
    async fn get_quotes(&self, symbols: &[String]) -> Vec<Result<Quote, String>> {
        let crypto = symbols
            .iter()
            .filter(|symbol| is_crypto(symbol))
            .cloned()
            .collect::<Vec<_>>();
        let stocks = symbols
            .iter()
            .filter(|symbol| !is_crypto(symbol))
            .cloned()
            .collect::<Vec<_>>();
        let (binance, yahoo) = tokio::join!(
            self.binance.get_quotes(&crypto),
            self.yahoo.get_quotes(&stocks)
        );
        route(symbols, binance, yahoo).await
    }

    async fn get_charts(
        &self,
        symbols: &[String],
        range: ChartRange,
    ) -> Vec<Result<Vec<ChartPoint>, String>> {
        let crypto = symbols
            .iter()
            .filter(|symbol| is_crypto(symbol))
            .cloned()
            .collect::<Vec<_>>();
        let stocks = symbols
            .iter()
            .filter(|symbol| !is_crypto(symbol))
            .cloned()
            .collect::<Vec<_>>();
        let (binance, yahoo) = tokio::join!(
            self.binance.get_charts(&crypto, range),
            self.yahoo.get_charts(&stocks, range)
        );
        route(symbols, binance, yahoo).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn restores_original_mixed_symbol_order() {
        let symbols = vec!["NVDA".into(), "BTC-USD".into(), "QQQ".into()];
        let result = route(&symbols, vec![Ok(2)], vec![Ok(1), Err("closed".into())]).await;
        assert_eq!(result[0].as_ref().unwrap(), &1);
        assert_eq!(result[1].as_ref().unwrap(), &2);
        assert_eq!(result[2].as_ref().unwrap_err(), "closed");
    }
}
