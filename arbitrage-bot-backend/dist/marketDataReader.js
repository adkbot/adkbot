"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketDataReader = void 0;
const ccxt_1 = __importDefault(require("ccxt"));
const logger_1 = __importDefault(require("./logger")); // Importar o logger
class MarketDataReader {
    constructor(exchangeIds) {
        this.exchanges = {};
        this.exchangeIds = exchangeIds;
        this.exchangeIds.forEach(id => {
            if (ccxt_1.default.exchanges.includes(id)) {
                try {
                    this.exchanges[id] = new ccxt_1.default[id]();
                }
                catch (error) {
                    logger_1.default.warn(`Error initializing exchange ${id}: ${error.message}. Skipping.`);
                }
            }
            else {
                logger_1.default.warn(`Exchange ID ${id} not supported by CCXT or is invalid. Skipping.`);
            }
        });
    }
    async fetchOrderBooks(symbol, defaultLimit = 5) {
        const results = [];
        for (const id of this.exchangeIds) {
            const exchange = this.exchanges[id];
            if (!exchange) {
                logger_1.default.warn(`Exchange ${id} was not initialized. Skipping fetchOrderBooks for ${symbol}.`);
                results.push({
                    exchangeId: id,
                    symbol: symbol,
                    bids: [],
                    asks: [],
                    timestamp: Date.now(),
                    error: `Exchange ${id} not initialized`,
                });
                continue;
            }
            let timestamp = Date.now();
            let errorMsg = undefined;
            let parsedBids = [];
            let parsedAsks = [];
            try {
                if (!exchange.has['fetchOrderBook']) {
                    errorMsg = `Exchange ${id} does not support fetchOrderBook for ${symbol}.`;
                    logger_1.default.warn(errorMsg);
                }
                else {
                    timestamp = exchange.milliseconds();
                    let fetchLimit = defaultLimit;
                    if (id === 'kucoin') {
                        if (defaultLimit < 20)
                            fetchLimit = 20;
                        else if (defaultLimit > 20 && defaultLimit < 100)
                            fetchLimit = 20;
                        else if (defaultLimit > 100)
                            fetchLimit = 100;
                        if (fetchLimit !== defaultLimit)
                            logger_1.default.info(`Adjusting limit for KuCoin for ${symbol} from ${defaultLimit} to ${fetchLimit}`);
                    }
                    logger_1.default.debug(`Fetching order book for ${symbol} from ${id} with limit ${fetchLimit}`);
                    const orderbook = await exchange.fetchOrderBook(symbol, fetchLimit);
                    timestamp = orderbook.timestamp || timestamp;
                    if (orderbook.bids) {
                        orderbook.bids.forEach((b) => {
                            if (typeof b[0] === 'number' && typeof b[1] === 'number') {
                                parsedBids.push({ price: b[0], amount: b[1] });
                            }
                        });
                    }
                    if (orderbook.asks) {
                        orderbook.asks.forEach((a) => {
                            if (typeof a[0] === 'number' && typeof a[1] === 'number') {
                                parsedAsks.push({ price: a[0], amount: a[1] });
                            }
                        });
                    }
                    logger_1.default.debug(`Successfully fetched order book for ${symbol} from ${id}`);
                }
            }
            catch (error) {
                errorMsg = `Error fetching order book from ${id} for ${symbol}: ${error.message}`;
                logger_1.default.error(errorMsg);
            }
            results.push({
                exchangeId: id,
                symbol: symbol,
                bids: parsedBids,
                asks: parsedAsks,
                timestamp: timestamp,
                error: errorMsg,
            });
        }
        return results;
    }
}
exports.MarketDataReader = MarketDataReader;
