"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const marketDataReader_1 = require("./marketDataReader");
const arbitrageEngine_1 = require("./arbitrageEngine");
const logger_1 = __importDefault(require("./logger")); // Importar o logger
const main = async () => {
    const exchangeIds = ['binance', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'mexc', 'bitget', 'bitstamp'];
    const symbol = 'BTC/USDT';
    const minSpreadPercent = 0.5;
    const tradingFeePercent = 0.1;
    const reader = new marketDataReader_1.MarketDataReader(exchangeIds);
    const engine = new arbitrageEngine_1.ArbitrageEngine();
    logger_1.default.info(`[INIT] Starting arbitrage bot for symbol: ${symbol}`);
    logger_1.default.info(`[INIT] Exchanges configured: ${exchangeIds.join(', ')}`);
    logger_1.default.info(`[INIT] Minimum spread threshold: ${minSpreadPercent}%`);
    logger_1.default.info(`[INIT] Estimated trading fee per transaction: ${tradingFeePercent}%`);
    try {
        logger_1.default.info(`[FETCH] Fetching order books for ${symbol}...`);
        const processedOrderBooks = await reader.fetchOrderBooks(symbol, 10);
        const validOrderBooks = processedOrderBooks.filter(ob => !ob.error && ob.asks.length > 0 && ob.bids.length > 0);
        if (validOrderBooks.length < 2) {
            logger_1.default.warn(`[ARBITRAGE] Not enough valid order books (found ${validOrderBooks.length}) for ${symbol} to find arbitrage opportunities. Need at least 2.`);
        }
        else {
            logger_1.default.info(`[ARBITRAGE] Finding arbitrage opportunities for ${symbol} using ${validOrderBooks.length} valid books.`);
            const opportunities = engine.findArbitrageOpportunities(validOrderBooks, symbol, minSpreadPercent, tradingFeePercent);
            if (opportunities.length > 0) {
                logger_1.default.info(`[RESULT] ARBITRAGE OPPORTUNITIES FOUND (${opportunities.length}) FOR ${symbol}:`);
                opportunities.forEach(op => {
                    logger_1.default.info(`  Opportunity: Buy at ${op.buyAtExchange} (Price: ${op.buyPrice}) ` +
                        `-> Sell at ${op.sellAtExchange} (Price: ${op.sellPrice}). ` +
                        `Potential Profit: ${op.potentialProfitPercent.toFixed(3)}% (after fees). ` +
                        `Based on data from ~${new Date(op.timestamp).toLocaleTimeString()}`);
                });
            }
            else {
                logger_1.default.info(`[RESULT] No arbitrage opportunities found for ${symbol} meeting the criteria.`);
            }
        }
        // Log de depuração para order books problemáticos
        processedOrderBooks.forEach(ob => {
            if (ob.error) {
                logger_1.default.warn(`[FETCH_DEBUG] Order book for ${ob.exchangeId} (${ob.symbol}) had an error: ${ob.error}`);
            }
            else if (ob.asks.length === 0 || ob.bids.length === 0) {
                logger_1.default.warn(`[FETCH_DEBUG] Order book for ${ob.exchangeId} (${ob.symbol}) is empty or incomplete. Asks: ${ob.asks.length}, Bids: ${ob.bids.length}`);
            }
        });
    }
    catch (error) {
        logger_1.default.error(`[FATAL_MAIN] An unexpected error occurred in main execution: ${error.message}`, { stack: error.stack });
    }
};
main().catch(error => {
    logger_1.default.error('[FATAL_GLOBAL] Unhandled error in main function execution:', { error });
});
