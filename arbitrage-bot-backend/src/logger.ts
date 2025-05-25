import winston from 'winston';

const logger = winston.createLogger({
  level: 'info', // Nível mínimo de log a ser registrado
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }), // Para logar a stack trace de erros
    winston.format.splat(),
    winston.format.json() // Formato JSON para os logs
  ),
  defaultMeta: { service: 'arbitrage-bot' }, // Metadados padrão para todos os logs
  transports: [
    //
    // - Escrever todos os logs com importância igual ou menor que `error` para `error.log`
    // - Escrever todos os logs com importância igual ou menor que `info` para `combined.log`
    //
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

//
// Se não estivermos em produção, logar também no console
// com o formato 'simple' (nível de log, mensagem, timestamp etc.)
//
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    ),
  }));
}

export default logger;
