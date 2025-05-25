"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArbitrageEngine = void 0;
const logger_1 = __importDefault(require("./logger")); // Importar o logger
class ArbitrageEngine {
    constructor() {
        logger_1.default.debug('ArbitrageEngine initialized');
    }
    findArbitrageOpportunities(processedOrderBooks, symbol, minSpreadPercent, tradingFeePercent) {
        const opportunities = [];
        const validOrderBooks = processedOrderBooks.filter(ob => {
            if (ob.error) {
                logger_1.default.warn(`Excluding ${ob.exchangeId} for ${symbol} due to previous error: ${ob.error}`);
                return false;
            }
            if (ob.asks.length === 0 || ob.bids.length === 0) {
                logger_1.default.warn(`Excluding ${ob.exchangeId} for ${symbol} due to empty asks or bids.`);
                return false;
            }
            if (ob.symbol !== symbol) {
                logger_1.default.warn(`Excluding ${ob.exchangeId} for ${symbol} due to symbol mismatch: ${ob.symbol}`);
                return false;
            }
            return true;
        });
        if (validOrderBooks.length < 2) {
            logger_1.default.info(`Not enough valid order books (found ${validOrderBooks.length}) for ${symbol} to find arbitrage opportunities.`);
            return opportunities;
        }
        logger_1.default.debug(`Finding arbitrage opportunities for ${symbol} using ${validOrderBooks.length} valid order books.`);
        for (let i = 0; i < validOrderBooks.length; i++) {
            for (let j = 0; j < validOrderBooks.length; j++) {
                if (i === j) {
                    continue;
                }
                const exchangeA = validOrderBooks[i];
                const exchangeB = validOrderBooks[j];
                const bestAskA = exchangeA.asks[0].price;
                const bestBidB = exchangeB.bids[0].price;
                if (bestAskA > 0 && bestBidB > 0) {
                    if (bestBidB > bestAskA) {
                        const spreadPercent = ((bestBidB - bestAskA) / bestAskA) * 100;
                        const profitPercent = spreadPercent - (2 * tradingFeePercent);
                        logger_1.default.debug(`Potential opportunity: Buy ${symbol} on ${exchangeA.exchangeId} at ${bestAskA}, ` +
                            `Sell on ${exchangeB.exchangeId} at ${bestBidB}. ` +
                            `Spread: ${spreadPercent.toFixed(3)}%, ` +
                            `Profit after fees: ${profitPercent.toFixed(3)}%`);
                        if (profitPercent > minSpreadPercent) {
                            const opportunity = {
                                symbol: symbol,
                                buyAtExchange: exchangeA.exchangeId,
                                sellAtExchange: exchangeB.exchangeId,
                                buyPrice: bestAskA,
                                sellPrice: bestBidB,
                                potentialProfitPercent: profitPercent,
                                timestamp: Math.max(exchangeA.timestamp, exchangeB.timestamp),
                            };
                            opportunities.push(opportunity);
                            logger_1.default.info(`Arbitrage opportunity found: ${JSON.stringify(opportunity)}`);
                        }
                    }
                }
                else {
                    logger_1.default.warn(`Invalid prices for arbitrage check between ${exchangeA.exchangeId} and ${exchangeB.exchangeId} for ${symbol}: bestAskA=${bestAskA}, bestBidB=${bestBidB}`);
                }
            }
        }
        logger_1.default.debug(`Found ${opportunities.length} arbitrage opportunities for ${symbol} meeting criteria.`);
        return opportunities;
    }
}
exports.ArbitrageEngine = ArbitrageEngine;
