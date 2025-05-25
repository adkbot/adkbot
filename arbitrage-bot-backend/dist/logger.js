"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const winston_1 = __importDefault(require("winston"));
const logger = winston_1.default.createLogger({
    level: 'info', // Nível mínimo de log a ser registrado
    format: winston_1.default.format.combine(winston_1.default.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss'
    }), winston_1.default.format.errors({ stack: true }), // Para logar a stack trace de erros
    winston_1.default.format.splat(), winston_1.default.format.json() // Formato JSON para os logs
    ),
    defaultMeta: { service: 'arbitrage-bot' }, // Metadados padrão para todos os logs
    transports: [
        //
        // - Escrever todos os logs com importância igual ou menor que `error` para `error.log`
        // - Escrever todos os logs com importância igual ou menor que `info` para `combined.log`
        //
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' }),
    ],
});
//
// Se não estivermos em produção, logar também no console
// com o formato 'simple' (nível de log, mensagem, timestamp etc.)
//
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.combine(winston_1.default.format.colorize(), winston_1.default.format.simple()),
    }));
}
exports.default = logger;
