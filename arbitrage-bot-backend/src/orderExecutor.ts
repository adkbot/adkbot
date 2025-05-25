import ccxt, { Exchange as CcxtExchange, Order, Balances, Market } from 'ccxt';
import logger from './logger';
import { ArbitrageOpportunity } from './arbitrageEngine';

export interface OrderExecutionResult {
  success: boolean;
  message: string;
  symbol: string; // Adicionado para o histórico
  timestamp: number; // Adicionado: Timestamp da execução/simulação
  profitReal?: number;
  buyOrderId?: string;
  sellOrderId?: string;
  buyOrderDetails?: ccxt.Order;
  sellOrderDetails?: ccxt.Order;
  buyAtExchange: string; // Já presente na ArbitrageOpportunity, mas bom ter aqui
  sellAtExchange: string; // Já presente na ArbitrageOpportunity, mas bom ter aqui
  buyPrice?: number; // Preço médio real de compra
  sellPrice?: number; // Preço médio real de venda
  amountBought?: number; // Quantidade de ativo base transacionada
}

export class OrderExecutor {
  private exchanges: { [key: string]: CcxtExchange } = {};
  private exchangeIds: string[];

  constructor(exchangeIds: string[]) {
    this.exchangeIds = exchangeIds;
    logger.info(`[OrderExecutor] Initializing for exchanges: ${exchangeIds.join(', ')}`);

    this.exchangeIds.forEach(id => {
      const apiKey = process.env[`${id.toUpperCase()}_API_KEY`];
      const secret = process.env[`${id.toUpperCase()}_API_SECRET`];
      const password = process.env[`${id.toUpperCase()}_API_PASSWORD`];
      const uid = process.env[`${id.toUpperCase()}_UID`]; 
      
      let exchangeConfig: { [key: string]: any } = {};
      if (apiKey) exchangeConfig.apiKey = apiKey;
      if (secret) exchangeConfig.secret = secret;
      if (password) exchangeConfig.password = password;
      if (uid) exchangeConfig.uid = uid;

      if (process.env.SANDBOX_MODE === 'true') {
        logger.info(`[OrderExecutor] SANDBOX_MODE is true. Configuring ${id} for testnet if supported.`);
        if (id === 'binance') {
            exchangeConfig.urls = { 'api': 'https://testnet.binance.vision/api' };
            exchangeConfig.options = { ...exchangeConfig.options, defaultType: 'spot' }; 
            logger.info(`[OrderExecutor] Specific testnet URL configured for Binance.`);
        }
      }

      if (ccxt.exchanges.includes(id)) {
        try {
          this.exchanges[id] = new (ccxt as any)[id](exchangeConfig);
          if (process.env.SANDBOX_MODE === 'true' && typeof (this.exchanges[id] as any).setSandboxMode === 'function') {
                logger.info(`[OrderExecutor] Calling setSandboxMode(true) for ${id}`);
                (this.exchanges[id] as any).setSandboxMode(true);
          }
          logger.info(`[OrderExecutor] Initialized CCXT instance for ${id}. API Key provided: ${!!apiKey}. Sandbox mode: ${process.env.SANDBOX_MODE === 'true'}`);
          if (!apiKey && process.env.SANDBOX_MODE !== 'true') { 
             logger.warn(`[OrderExecutor] CRITICAL: API Key for ${id} is missing and not in SANDBOX_MODE. Real trading/balance operations will fail.`);
          } else if (!apiKey && process.env.SANDBOX_MODE === 'true') {
             logger.info(`[OrderExecutor] API Key for ${id} is missing, running in SANDBOX_MODE. Operations requiring API keys will use testnet/sandbox credentials if set, or fail for ${id}.`);
          }
        } catch (error: any) {
            logger.error(`[OrderExecutor] Error initializing exchange ${id}: ${error.message}. Skipping.`);
        }
      } else {
        logger.warn(`[OrderExecutor] Exchange ID ${id} not supported by CCXT or is invalid. Skipping.`);
      }
    });
  }

  public async fetchBalance(exchangeId: string, currencyCode: string = 'USDT'): Promise<{ free: number | undefined, total: number | undefined }> {
    const exchange = this.exchanges[exchangeId];
    if (!exchange) { logger.error(`[fetchBalance] Exchange ${exchangeId} not initialized.`); return { free: undefined, total: undefined }; }
    if (!exchange.has['fetchBalance']) { logger.warn(`[fetchBalance] Exchange ${exchangeId} does not support fetchBalance.`); return { free: undefined, total: undefined }; }
    if (!exchange.apiKey || exchange.apiKey === '') { logger.warn(`[fetchBalance] API Key for ${exchangeId} is missing.`); return { free: undefined, total: undefined }; }
    try {
      const balance: Balances = await exchange.fetchBalance();
      const currencyBalance = balance[currencyCode];
      if (currencyBalance) { 
        logger.info(`[fetchBalance] Balance for ${currencyCode} on ${exchangeId}: Free=${currencyBalance.free}, Total=${currencyBalance.total}`);
        return { free: currencyBalance.free, total: currencyBalance.total };
      } else {
        logger.warn(`[fetchBalance] Currency ${currencyCode} not found in balance for ${exchangeId}.`); return { free: 0, total: 0 };
      }
    } catch (error: any) { 
      logger.error(`[fetchBalance] Error fetching balance from ${exchangeId} for ${currencyCode}: ${error.message}`, { stack: error.stack, exchange: exchangeId }); 
      return { free: undefined, total: undefined };
    }
  }

  public async executeMarketOrder(exchangeId: string, symbol: string, side: 'buy' | 'sell', amountOrCost: number): Promise<ccxt.Order | undefined> {
    const exchange = this.exchanges[exchangeId];
    if (!exchange) { logger.error(`[executeMarketOrder] Exchange ${exchangeId} not initialized.`); return undefined; }
    if (!exchange.apiKey || exchange.apiKey === '') { logger.error(`[executeMarketOrder] API Key for ${exchangeId} is missing.`); return undefined; }
    try {
      await exchange.loadMarkets();
      const market: Market | undefined = exchange.markets[symbol];
      if (!market) { logger.error(`[executeMarketOrder] Symbol ${symbol} not found on ${exchangeId}.`); return undefined; }
      let order: Order; const params: { [key: string]: any } = {};
      if (process.env.DRY_RUN_ORDERS === 'true' && exchange.has['test']) { logger.info(`[executeMarketOrder] DRY_RUN_ORDERS is true. Using 'test' param for ${exchangeId}.`); params['test'] = true; }
      if (side === 'buy') {
        if (exchange.has['createMarketBuyOrderWithCost']) {
          logger.info(`[executeMarketOrder] Using createMarketBuyOrderWithCost for ${symbol} on ${exchangeId}. Cost: ${amountOrCost} ${market.quote}`);
          order = await exchange.createMarketBuyOrderWithCost(symbol, amountOrCost, params);
        } else if (exchange.options?.createMarketBuyOrderRequiresPrice === false || ['binance', 'kucoin', 'gateio', 'okx', 'bybit', 'mexc', 'bitget'].includes(exchange.id)) { 
          logger.info(`[executeMarketOrder] Using createOrder with 'cost' param for ${symbol} on ${exchangeId}. Cost: ${amountOrCost} ${market.quote}`);
          const costParam = exchange.costToPrecision(symbol, amountOrCost);
          order = await exchange.createOrder(symbol, 'market', side, undefined, undefined, { 'cost': parseFloat(costParam) , ...params });
        } else {
          logger.info(`[executeMarketOrder] Fallback: Calculating base asset amount for ${symbol} on ${exchangeId} to spend ~${amountOrCost} ${market.quote}.`);
          const ticker = await exchange.fetchTicker(symbol);
          if (!ticker || !ticker.ask || ticker.ask === 0) { logger.error(`[executeMarketOrder] Could not fetch valid ticker.ask price for ${symbol} on ${exchangeId}.`); return undefined; }
          const price = ticker.ask; const baseAmount = amountOrCost / price; 
          const amountPrecise = exchange.amountToPrecision(symbol, baseAmount);
          logger.info(`[executeMarketOrder] Estimated base amount: ${amountPrecise} ${market.base} for ${symbol} on ${exchangeId} at price ${price}.`);
          if (market.limits?.amount?.min && parseFloat(amountPrecise) < market.limits.amount.min) { logger.error(`[executeMarketOrder] Calculated amount ${amountPrecise} < min ${market.limits.amount.min}.`); return undefined; }
          order = await exchange.createMarketOrder(symbol, side, parseFloat(amountPrecise), undefined, params);
        }
      } else { 
        const amountPrecise = exchange.amountToPrecision(symbol, amountOrCost);
        logger.info(`[executeMarketOrder] Using createMarketOrder for ${symbol} on ${exchangeId}. Amount: ${amountPrecise} ${market.base}`);
        if (market.limits?.amount?.min && parseFloat(amountPrecise) < market.limits.amount.min) { logger.error(`[executeMarketOrder] Sell amount ${amountPrecise} < min ${market.limits.amount.min}.`); return undefined; }
        order = await exchange.createMarketOrder(symbol, side, parseFloat(amountPrecise), undefined, params);
      }
      logger.info(`[executeMarketOrder] Order request sent to ${exchangeId} for ${symbol}. ID: ${order.id}`, { order });
      return order;
    } catch (error: any) { 
      logger.error(`[executeMarketOrder] Error placing ${side} order on ${exchangeId} for ${symbol}: ${error.message}`, { stack: error.stack, amountOrCost, symbol, exchange_response: (error as any).message }); 
      return undefined; 
    }
  }

  public async executeArbitrage(
    opportunity: ArbitrageOpportunity,
    amountToInvestQuote: number 
  ): Promise<OrderExecutionResult> {
    const executionTimestamp = Date.now();
    const quoteCurrency = opportunity.symbol.split('/')[1]; 
    const baseCurrency = opportunity.symbol.split('/')[0]; 
    
    const baseReturn: Partial<OrderExecutionResult> = { // Usado para retornar em caso de falha parcial
      symbol: opportunity.symbol,
      timestamp: executionTimestamp,
      buyAtExchange: opportunity.buyAtExchange,
      sellAtExchange: opportunity.sellAtExchange,
    };
    
    logger.info(`[EXECUTE_ARBITRAGE] Attempting: ${opportunity.symbol}, Buy on ${opportunity.buyAtExchange}, Sell on ${opportunity.sellAtExchange}, Invest: ${amountToInvestQuote} ${quoteCurrency}`, { opportunity });

    if (amountToInvestQuote <= 0) {
      const msg = `Amount to invest ${quoteCurrency} is ${amountToInvestQuote.toFixed(2)} <= 0.`;
      logger.error(`[EXECUTE_ARBITRAGE_FAIL] ${msg}`);
      return { success: false, message: msg, ...baseReturn };
    }
    
    const buyOrder = await this.executeMarketOrder(opportunity.buyAtExchange, opportunity.symbol, 'buy', amountToInvestQuote);
    if (!buyOrder || (buyOrder.status !== 'closed' && buyOrder.status !== 'filled') || !(buyOrder.filled && buyOrder.filled > 0)) {
      const message = `Buy order on ${opportunity.buyAtExchange} for ${opportunity.symbol} failed, canceled, or not filled. Status: ${buyOrder?.status}, Filled: ${buyOrder?.filled}.`;
      logger.error(`[EXECUTE_ARBITRAGE_FAIL] ${message}`, { buyOrderDetails: buyOrder });
      return { success: false, message, ...baseReturn, buyOrderDetails: buyOrder, buyPrice: opportunity.buyPrice };
    }
    logger.info(`[EXECUTE_ARBITRAGE_BUY_SUCCESS] ID: ${buyOrder.id}, Filled: ${buyOrder.filled} ${baseCurrency}, AvgPrice: ${buyOrder.average}, Cost: ${buyOrder.cost} ${quoteCurrency}`);

    const amountBought = buyOrder.filled; 
    const actualBuyCostInQuote = buyOrder.cost || (buyOrder.average && buyOrder.filled ? buyOrder.average * buyOrder.filled : 0); 

    if (!amountBought || amountBought <= 0) {
        const message = `No amount of ${baseCurrency} reported as bought on ${opportunity.buyAtExchange}.`;
        logger.error(`[EXECUTE_ARBITRAGE_FAIL] ${message}`);
        return { success: false, message, ...baseReturn, buyOrderDetails: buyOrder, buyPrice: buyOrder.average || opportunity.buyPrice, amountBought: 0 };
    }

    await new Promise(resolve => setTimeout(resolve, 3000)); 

    const sellOrder = await this.executeMarketOrder(opportunity.sellAtExchange, opportunity.symbol, 'sell', amountBought);
    if (!sellOrder || (sellOrder.status !== 'closed' && sellOrder.status !== 'filled') || !(sellOrder.filled && sellOrder.filled > 0)) {
      const message = `CRITICAL: Sell order on ${opportunity.sellAtExchange} for ${amountBought} ${baseCurrency} failed, canceled, or not filled AFTER buying. Manual intervention may be required. Status: ${sellOrder?.status}, Filled: ${sellOrder?.filled}.`;
      logger.error(`[EXECUTE_ARBITRAGE_CRITICAL_FAIL] ${message}`, { sellOrderDetails: sellOrder });
      return { 
        success: false, message, ...baseReturn, 
        buyOrderDetails: buyOrder, sellOrderDetails: sellOrder, 
        buyPrice: buyOrder.average || opportunity.buyPrice, amountBought,
        sellPrice: opportunity.sellPrice // Preço de venda esperado, já que a ordem falhou
      };
    }
    logger.info(`[EXECUTE_ARBITRAGE_SELL_SUCCESS] ID: ${sellOrder.id}, Filled: ${sellOrder.filled} ${baseCurrency}, AvgPrice: ${sellOrder.average}, Revenue: ${sellOrder.cost} ${quoteCurrency}`);
    
    const actualSellRevenueInQuote = sellOrder.cost || (sellOrder.average && sellOrder.filled ? sellOrder.average * sellOrder.filled : 0);

    let profitReal = 0;
    let buyFeeCostInQuote = 0;
    if (buyOrder.fee?.cost) {
        buyFeeCostInQuote = (buyOrder.fee.currency === quoteCurrency || buyOrder.fee.currency === quoteCurrency.toUpperCase()) 
                            ? buyOrder.fee.cost 
                            : (buyOrder.fee.cost * (buyOrder.average || opportunity.buyPrice)); 
    }
    
    let sellFeeCostInQuote = 0;
    if (sellOrder.fee?.cost) {
        sellFeeCostInQuote = (sellOrder.fee.currency === quoteCurrency || sellOrder.fee.currency === quoteCurrency.toUpperCase()) 
                             ? sellOrder.fee.cost 
                             : (sellOrder.fee.cost * (sellOrder.average || opportunity.sellPrice)); 
    }
    
    profitReal = (actualSellRevenueInQuote - sellFeeCostInQuote) - (actualBuyCostInQuote + buyFeeCostInQuote);
    
    if (isNaN(profitReal) || (actualBuyCostInQuote === 0 && amountToInvestQuote > 0)) { 
        logger.warn("[EXECUTE_ARBITRAGE_PROFIT_CALC_WARN] Could not determine precise real profit due to missing/NaN order details. Profit calculation may be inaccurate.");
        profitReal = actualSellRevenueInQuote - amountToInvestQuote; // Fallback
    }
    
    const finalRealProfitPercentage = amountToInvestQuote > 0 ? (profitReal / amountToInvestQuote) * 100 : 0;

    const resultMessage = `[EXECUTE_ARBITRAGE_FINAL_RESULT] Arbitrage for ${opportunity.symbol} resulted in: ` +
                          `Real Net Profit: ${profitReal.toFixed(2)} ${quoteCurrency} (${finalRealProfitPercentage.toFixed(3)}%).`;
    logger.info(resultMessage, { buyOrder, sellOrder, profitReal, finalRealProfitPercentage});

    return {
      success: true,
      message: resultMessage,
      symbol: opportunity.symbol,
      timestamp: executionTimestamp,
      profitReal: profitReal,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyOrderDetails: buyOrder,
      sellOrderDetails: sellOrder,
      buyAtExchange: opportunity.buyAtExchange,
      sellAtExchange: opportunity.sellAtExchange,
      buyPrice: buyOrder.average || opportunity.buyPrice,
      sellPrice: sellOrder.average || opportunity.sellPrice,
      amountBought: amountBought
    };
  }
}
