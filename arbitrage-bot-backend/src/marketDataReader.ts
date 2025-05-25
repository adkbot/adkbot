import ccxt, { Exchange as CcxtExchange, OrderBook } from 'ccxt';
import logger from './logger'; // Importar o logger

interface OrderBookEntry {
  price: number;
  amount: number;
}

export interface ProcessedOrderBook {
  exchangeId: string;
  symbol: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  timestamp: number;
  error?: string;
}

export class MarketDataReader {
  private exchanges: { [key: string]: CcxtExchange } = {};
  private exchangeIds: string[];

  constructor(exchangeIds: string[]) {
    this.exchangeIds = exchangeIds;
    this.exchangeIds.forEach(id => {
      if (ccxt.exchanges.includes(id)) {
        try {
            this.exchanges[id] = new (ccxt as any)[id]();
        } catch (error: any) {
            logger.warn(`Error initializing exchange ${id}: ${error.message}. Skipping.`);
        }
      } else {
        logger.warn(`Exchange ID ${id} not supported by CCXT or is invalid. Skipping.`);
      }
    });
  }

  public async fetchOrderBooks(symbol: string, defaultLimit: number = 5): Promise<ProcessedOrderBook[]> {
    const results: ProcessedOrderBook[] = [];
    
    for (const id of this.exchangeIds) {
      const exchange = this.exchanges[id];
      if (!exchange) { 
        logger.warn(`Exchange ${id} was not initialized. Skipping fetchOrderBooks for ${symbol}.`);
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
      let errorMsg: string | undefined = undefined;
      let parsedBids: OrderBookEntry[] = [];
      let parsedAsks: OrderBookEntry[] = [];

      try {
        if (!exchange.has['fetchOrderBook']) {
          errorMsg = `Exchange ${id} does not support fetchOrderBook for ${symbol}.`;
          logger.warn(errorMsg);
        } else {
          timestamp = exchange.milliseconds();
          let fetchLimit = defaultLimit;
          if (id === 'kucoin') {
            if (defaultLimit < 20) fetchLimit = 20;
            else if (defaultLimit > 20 && defaultLimit < 100) fetchLimit = 20;
            else if (defaultLimit > 100) fetchLimit = 100;
            if (fetchLimit !== defaultLimit) logger.info(`Adjusting limit for KuCoin for ${symbol} from ${defaultLimit} to ${fetchLimit}`);
          }
          
          logger.debug(`Fetching order book for ${symbol} from ${id} with limit ${fetchLimit}`);
          const orderbook: OrderBook = await exchange.fetchOrderBook(symbol, fetchLimit);
          timestamp = orderbook.timestamp || timestamp;

          if (orderbook.bids) {
              orderbook.bids.forEach((b: (number | undefined)[]) => {
                  if (typeof b[0] === 'number' && typeof b[1] === 'number') {
                      parsedBids.push({ price: b[0], amount: b[1] });
                  }
              });
          }

          if (orderbook.asks) {
              orderbook.asks.forEach((a: (number | undefined)[]) => {
                  if (typeof a[0] === 'number' && typeof a[1] === 'number') {
                      parsedAsks.push({ price: a[0], amount: a[1] });
                  }
              });
          }
          logger.debug(`Successfully fetched order book for ${symbol} from ${id}`);
        }
      } catch (error: any) {
        errorMsg = `Error fetching order book from ${id} for ${symbol}: ${error.message}`;
        logger.error(errorMsg);
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
