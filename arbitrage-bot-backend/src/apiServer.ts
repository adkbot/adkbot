import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import logger from './logger';
import { ArbitrageBotService } from './arbitrageBotService'; // Importação direta da classe

let botServiceInstance: ArbitrageBotService | null = null; 

export const injectBotService = (service: ArbitrageBotService) => {
    botServiceInstance = service;
    logger.info('[APIServer] ArbitrageBotService injected into API Server.');
};

const app: Express = express();
const port = process.env.API_PORT || 3001;

app.use(cors()); 
app.use(express.json()); 

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`[APIServer] Received ${req.method} request for ${req.url} from ${req.ip}`);
  next();
});

// --- Endpoints ---

app.get('/api/status', (req: Request, res: Response) => {
  if (!botServiceInstance) {
    logger.warn('[APIServer] /api/status called but botServiceInstance is null.');
    return res.status(503).json({ error: 'Bot service not available' });
  }
  res.json(botServiceInstance.getStatus()); 
});

app.get('/api/opportunities/latest', (req: Request, res: Response) => {
  if (!botServiceInstance) {
    logger.warn('[APIServer] /api/opportunities/latest called but botServiceInstance is null.');
    return res.status(503).json({ error: 'Bot service not available' });
  }
  res.json({ opportunities: botServiceInstance.getLatestOpportunities() });
});

app.get('/api/trades', (req: Request, res: Response) => {
  if (!botServiceInstance) {
    logger.warn('[APIServer] /api/trades called but botServiceInstance is null.');
    return res.status(503).json({ error: 'Bot service not available' });
  }
  res.json({ trades: botServiceInstance.getExecutedTrades() }); 
});

// Endpoint para saldos das exchanges
app.get('/api/exchanges/balances', async (req: Request, res: Response) => {
    if (!botServiceInstance) {
      logger.warn('[APIServer] /api/exchanges/balances called but botServiceInstance is null.');
      return res.status(503).json({ error: 'Bot service not available' });
    }
    try {
      // Por padrão, busca saldos USDT. Pode ser parametrizado com req.query.currency se necessário.
      const currencyToFetch = (req.query.currency as string) || 'USDT';
      const balances = await botServiceInstance.getExchangeBalances(currencyToFetch);
      res.json({ balances });
    } catch (error: any) {
      logger.error(`[APIServer] Error fetching exchange balances: ${error.message}`, { stack: error.stack });
      res.status(500).json({ success: false, message: 'Failed to fetch exchange balances.' });
    }
  });

app.post('/api/control/start', async (req: Request, res: Response) => {
  if (!botServiceInstance) {
    logger.warn('[APIServer] /api/control/start called but botServiceInstance is null.');
    return res.status(503).json({ error: 'Bot service not available' });
  }
  try {
    await botServiceInstance.startBot();
    logger.info('[APIServer] Bot start command received and processed.');
    res.json({ success: true, message: 'Bot started successfully.' });
  } catch (error: any) {
    logger.error(`[APIServer] Error processing start command: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to start bot.' });
  }
});

app.post('/api/control/pause', async (req: Request, res: Response) => {
  if (!botServiceInstance) {
    logger.warn('[APIServer] /api/control/pause called but botServiceInstance is null.');
    return res.status(503).json({ error: 'Bot service not available' });
  }
  try {
    botServiceInstance.pauseBot(); 
    logger.info('[APIServer] Bot pause command received and processed.');
    res.json({ success: true, message: 'Bot paused successfully.' });
  } catch (error: any) {
    logger.error(`[APIServer] Error processing pause command: ${error.message}`, { stack: error.stack });
    res.status(500).json({ success: false, message: 'Failed to pause bot.' });
  }
});

export const startApiServer = () => {
  app.listen(port, () => {
    logger.info(`[APIServer] Express server listening on port ${port}`);
  });
};

if (require.main === module) {
  logger.info('[APIServer] Running apiServer.ts directly. API server will start with placeholder bot service (botServiceInstance will be null).');
  startApiServer();
}
