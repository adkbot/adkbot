import logger from './logger';
import { MarketDataReader, ProcessedOrderBook } from './marketDataReader';
import { ArbitrageEngine, ArbitrageOpportunity } from './arbitrageEngine';
import { OrderExecutor, OrderExecutionResult } from './orderExecutor';

type BotStatus = 'stopped' | 'running' | 'paused' | 'error';

export interface ExchangeBalanceInfo {
  exchangeId: string;
  currency: string;
  free: number | undefined;
  total: number | undefined;
  error?: string;
}

export class ArbitrageBotService {
  private marketDataReader: MarketDataReader;
  private arbitrageEngine: ArbitrageEngine;
  private orderExecutor: OrderExecutor;
  
  private status: BotStatus = 'stopped';
  private statusSince: number = Date.now();
  private statusMessage: string = 'Bot initialized.';
  
  private latestOpportunities: ArbitrageOpportunity[] = [];
  private executedTrades: OrderExecutionResult[] = []; 

  private readonly symbol: string;
  private readonly exchangeIds: string[];
  private readonly minSpreadPercent: number;
  private readonly tradingFeePercent: number;
  private readonly amountToInvest: number; 
  private readonly pauseDurationMinutes: number;

  private isLoopRunning: boolean = false;
  private runInterval: NodeJS.Timeout | null = null;
  private cycleIntervalMinutes: number;

  constructor(
    exchangeIds: string[],
    symbol: string,
    minSpreadPercent: number,
    tradingFeePercent: number,
    amountToInvest: number, 
    pauseDurationMinutes: number = 2,
    cycleIntervalMinutes: number = 1 
  ) {
    this.exchangeIds = exchangeIds;
    this.symbol = symbol;
    this.minSpreadPercent = minSpreadPercent;
    this.tradingFeePercent = tradingFeePercent;
    this.amountToInvest = amountToInvest;
    this.pauseDurationMinutes = pauseDurationMinutes;
    this.cycleIntervalMinutes = cycleIntervalMinutes;

    this.marketDataReader = new MarketDataReader(this.exchangeIds);
    this.arbitrageEngine = new ArbitrageEngine();
    this.orderExecutor = new OrderExecutor(this.exchangeIds); 
    
    this.setStatus('stopped', 'Bot service initialized.');
    logger.info('[BotService] ArbitrageBotService initialized.', { config: { symbol, exchangeIds, minSpreadPercent, tradingFeePercent, amountToInvest }});
  }

  private setStatus(status: BotStatus, message?: string) {
    this.status = status;
    this.statusSince = Date.now();
    this.statusMessage = message || `${status.charAt(0).toUpperCase() + status.slice(1)}.`;
    logger.info(`[BotService] Status changed: ${this.status} - ${this.statusMessage}`);
  }

  public getStatus(): { status: BotStatus; since: number; message: string } {
    return {
      status: this.status,
      since: this.statusSince,
      message: this.statusMessage,
    };
  }

  public getLatestOpportunities(count: number = 5): ArbitrageOpportunity[] {
    return this.latestOpportunities.slice(0, count);
  }
  
  public getExecutedTrades(count: number = 10): OrderExecutionResult[] {
    return this.executedTrades.slice(0, count);
  }

  public async getExchangeBalances(currency: string = 'USDT'): Promise<ExchangeBalanceInfo[]> {
    const balanceResults: ExchangeBalanceInfo[] = [];
    logger.info(`[BotService] Fetching ${currency} balances for all configured exchanges...`);
    for (const exchangeId of this.exchangeIds) {
      try {
        const balance = await this.orderExecutor.fetchBalance(exchangeId, currency);
        balanceResults.push({
          exchangeId,
          currency,
          free: balance.free,
          total: balance.total,
        });
      } catch (error: any) {
        logger.error(`[BotService] Error fetching balance for ${currency} from ${exchangeId}: ${error.message}`);
        balanceResults.push({
          exchangeId,
          currency,
          free: undefined,
          total: undefined,
          error: error.message,
        });
      }
    }
    return balanceResults;
  }

  public async startBot(): Promise<void> {
    if (this.isLoopRunning) {
      logger.warn('[BotService] Bot is already running.');
      this.setStatus('running', 'Bot is already running.'); 
      return;
    }
    this.isLoopRunning = true;
    this.setStatus('running', 'Bot started and performing initial cycle.');
    await this.runArbitrageCycle(); 

    if (this.isLoopRunning) { 
        this.runInterval = setInterval(async () => {
            if (this.status === 'running') {
                await this.runArbitrageCycle();
            } else {
                logger.info(`[BotService] Loop cycle skipped due to status: ${this.status}`);
            }
        }, this.cycleIntervalMinutes * 60 * 1000);
        logger.info(`[BotService] Arbitrage cycle scheduled every ${this.cycleIntervalMinutes} minutes.`);
    }
  }

  public pauseBot(): void {
    if (!this.isLoopRunning && this.status !== 'running') { // Apenas loga se não estiver rodando
      logger.warn('[BotService] Bot is not running or already paused/stopped, cannot pause.');
      return;
    }
    this.isLoopRunning = false; 
    if (this.runInterval) {
      clearInterval(this.runInterval);
      this.runInterval = null;
    }
    this.setStatus('paused', 'Bot has been paused.');
  }
  
  public stopBot(): void { 
    this.pauseBot(); // Chama pauseBot para parar o loop e limpar o intervalo
    this.setStatus('stopped', 'Bot has been stopped.');
  }

  private async runArbitrageCycle(): Promise<void> {
    if (!this.isLoopRunning) {
        logger.info('[BotService] Arbitrage cycle aborted as bot is no longer running.');
        return;
    }
    logger.info(`[BotService] Starting new arbitrage cycle for ${this.symbol}...`);
    try {
      const processedOrderBooks: ProcessedOrderBook[] = await this.marketDataReader.fetchOrderBooks(this.symbol, 10);
      const validOrderBooks = processedOrderBooks.filter(
        ob => !ob.error && ob.asks.length > 0 && ob.bids.length > 0
      );

      if (validOrderBooks.length < 2) {
        logger.warn(`[BotService] Not enough valid order books for ${this.symbol} to find opportunities. Valid: ${validOrderBooks.length}/${processedOrderBooks.length}`);
        this.latestOpportunities = []; 
        return;
      }

      const opportunities: ArbitrageOpportunity[] = this.arbitrageEngine.findArbitrageOpportunities(
        validOrderBooks,
        this.symbol,
        this.minSpreadPercent,
        this.tradingFeePercent
      );

      this.latestOpportunities = opportunities.sort((a,b) => b.potentialProfitPercent - a.potentialProfitPercent);

      if (opportunities.length > 0) {
        logger.info(`[BotService] ${opportunities.length} arbitrage opportunities found for ${this.symbol}.`);
        const bestOpportunity = this.latestOpportunities[0]; 
        
        logger.info(`[BotService] Attempting to execute best opportunity for ${this.symbol}: Buy on ${bestOpportunity.buyAtExchange} at ${bestOpportunity.buyPrice}, Sell on ${bestOpportunity.sellAtExchange} at ${bestOpportunity.sellPrice}`);
        
        const executionResult: OrderExecutionResult = await this.orderExecutor.executeArbitrage(
          bestOpportunity,
          this.amountToInvest 
        );
        
        this.executedTrades.unshift(executionResult); 
        if (this.executedTrades.length > 20) this.executedTrades.pop(); 

        if (executionResult.success) {
          logger.info(`[BotService] Arbitrage execution successful for ${this.symbol}. Pausing for ${this.pauseDurationMinutes} minutes.`);
          this.setStatus('paused', `Execution successful. Paused for ${this.pauseDurationMinutes} min.`);
          
          if (this.runInterval) clearInterval(this.runInterval);
          this.isLoopRunning = false; 
          
          setTimeout(() => {
            if (this.status === 'paused') { 
              this.setStatus('running', 'Resuming after pause.');
              this.startBot(); 
            }
          }, this.pauseDurationMinutes * 60 * 1000);
        } else {
            logger.warn(`[BotService] Arbitrage execution failed for ${this.symbol}: ${executionResult.message}`);
        }

      } else {
        logger.info(`[BotService] No arbitrage opportunities found for ${this.symbol} meeting criteria.`);
      }
    } catch (error: any) {
      logger.error(`[BotService] Error during arbitrage cycle for ${this.symbol}: ${error.message}`, { stack: error.stack });
      this.setStatus('error', `Error in cycle: ${error.message}`);
    }
    logger.info(`[BotService] Arbitrage cycle finished for ${this.symbol}.`);
  }
}
