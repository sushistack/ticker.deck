use super::{ChartPoint, ChartRange, Quote};
use async_trait::async_trait;

#[async_trait]
pub trait MarketDataProvider: Send + Sync + 'static {
    async fn get_quotes(&self, symbols: &[String]) -> Vec<Result<Quote, String>>;
    async fn get_charts(
        &self,
        symbols: &[String],
        range: ChartRange,
    ) -> Vec<Result<Vec<ChartPoint>, String>>;
}
