import logger from './logger';
import { ArbitrageBotService } from './arbitrageBotService';
import { startApiServer, injectBotService } from './apiServer'; // Importar funções do apiServer

const main = async () => {
  // Configurações principais do Bot
  const exchangeIds = process.env.EXCHANGE_IDS?.split(',') || ['binance', 'kraken', 'kucoin', 'bybit', 'okx', 'gateio', 'mexc', 'bitget', 'bitstamp'];
  const symbol = process.env.SYMBOL || 'BTC/USDT';
  const minSpreadPercent = parseFloat(process.env.MIN_SPREAD_PERCENT || '0.5');
  const tradingFeePercent = parseFloat(process.env.TRADING_FEE_PERCENT || '0.1');
  const amountToInvest = parseFloat(process.env.AMOUNT_TO_INVEST_USDT || '10'); // Ex: 10 USDT por trade
  const pauseDurationMinutes = parseInt(process.env.PAUSE_DURATION_MINUTES || '2', 10);
  const cycleIntervalMinutes = parseInt(process.env.CYCLE_INTERVAL_MINUTES || '1', 10);
  const autoStartBot = process.env.AUTO_START_BOT === 'true';

  // Simulação de chaves de API para ambiente de teste (se não definidas externamente)
  // Para produção, estas devem ser configuradas de forma segura no ambiente.
  if (process.env.NODE_ENV !== 'production') {
    exchangeIds.forEach(id => {
      const idUpper = id.toUpperCase();
      if (!process.env[`${idUpper}_API_KEY`]) process.env[`${idUpper}_API_KEY`] = `dummy_key_${id}`;
      if (!process.env[`${idUpper}_API_SECRET`]) process.env[`${idUpper}_API_SECRET`] = `dummy_secret_${id}`;
      if (id === 'kucoin' && !process.env.KUCOIN_API_PASSWORD) process.env.KUCOIN_API_PASSWORD = 'dummy_password_kucoin';
      // Adicionar UID para OKX se necessário para teste
      if (id === 'okx' && !process.env.OKX_UID) process.env.OKX_UID = 'dummy_uid_okx';
    });
    // Para testar a execução de ordens sem risco financeiro real:
    // process.env.SANDBOX_MODE = 'true'; // Habilita o modo sandbox/testnet nas exchanges que o suportam
    // process.env.DRY_RUN_ORDERS = 'true'; // Tenta usar o parâmetro 'test' do CCXT para simular ordens
  }


  logger.info('[Main] Initializing ArbitrageBotService...');
  const botService = new ArbitrageBotService(
    exchangeIds,
    symbol,
    minSpreadPercent,
    tradingFeePercent,
    amountToInvest,
    pauseDurationMinutes,
    cycleIntervalMinutes
  );

  logger.info('[Main] Injecting BotService into API Server...');
  injectBotService(botService); // Fornece a instância do bot para o servidor API

  logger.info('[Main] Starting API Server...');
  startApiServer(); // Inicia o servidor Express

  if (autoStartBot) {
    logger.info('[Main] AUTO_START_BOT is true. Starting bot automatically.');
    try {
      await botService.startBot();
    } catch (error: any) {
      logger.error(`[Main] Error auto-starting bot: ${error.message}`, { stack: error.stack });
    }
  } else {
    logger.info('[Main] AUTO_START_BOT is false or not set. Bot will not start automatically. Use API endpoint /api/control/start to start.');
  }

  // O loop principal do bot agora é gerenciado dentro do ArbitrageBotService
  // e pode ser controlado pelos endpoints da API.
  // Se não houver servidor API, botService.startBot() iniciaria o bot para execução única ou contínua via CLI.
};

main().catch(error => {
  logger.error('[Main] Unhandled critical error in main application execution:', { errorName: error.name, errorMessage: error.message, stack: error.stack });
  process.exit(1); // Termina o processo em caso de erro não tratado na inicialização
});
