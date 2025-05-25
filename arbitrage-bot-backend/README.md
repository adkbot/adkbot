# Bot de Arbitragem - Backend

Este backend é responsável pela lógica de arbitragem, comunicação com as exchanges de criptomoedas e por servir a API para o frontend.

## Configuração

### 1. Variáveis de Ambiente

Crie um arquivo `.env` na raiz da pasta `arbitrage-bot-backend` com as seguintes variáveis. Substitua os valores de exemplo pelos seus dados reais.

```
# Porta para a API do backend
API_PORT=3001

# Configurações do Bot de Arbitragem
# IDs das exchanges suportadas pelo CCXT (ex: 'kraken', 'kucoin', 'binance') separadas por vírgula
EXCHANGE_IDS=kraken,kucoin
SYMBOL=BTC/USDT         # Par de moedas para arbitragem
MIN_SPREAD_PERCENT=0.5  # Spread mínimo percentual para considerar uma oportunidade (ex: 0.5 para 0.5%)
TRADING_FEE_PERCENT=0.1 # Taxa de negociação estimada por transação (ex: 0.1 para 0.1%)
AMOUNT_TO_INVEST_USDT=10 # Valor em USDT (ou moeda de cotação) a ser usado por trade de arbitragem
PAUSE_DURATION_MINUTES=2 # Duração da pausa em minutos após uma execução de trade
CYCLE_INTERVAL_MINUTES=1 # Intervalo em minutos entre os ciclos de busca por oportunidades

# Auto-start bot (true or false)
AUTO_START_BOT=false

# Chaves API (Exemplos - substitua ou adicione conforme necessário para as exchanges em EXCHANGE_IDS)
# Certifique-se de que as chaves tenham as permissões necessárias (consultar saldo, criar ordens)
# e que medidas de segurança como IP Whitelisting estejam ativadas na exchange.

# Kraken
KRAKEN_API_KEY=sua_kraken_api_key
KRAKEN_API_SECRET=sua_kraken_api_secret

# KuCoin
KUCOIN_API_KEY=sua_kucoin_api_key
KUCOIN_API_SECRET=sua_kucoin_api_secret
KUCOIN_API_PASSWORD=sua_kucoin_api_password_de_negociacao

# Binance (Exemplo, se for usar)
# BINANCE_API_KEY=sua_binance_api_key
# BINANCE_API_SECRET=sua_binance_api_secret

# Para testes em ambiente sandbox da Binance (se aplicável e configurado no código)
# SANDBOX_MODE=true
# DRY_RUN_ORDERS=true # Para simular ordens via CCXT (se a exchange e ccxt suportarem 'test': true)
```

**Nota Importante sobre Chaves API:**
- A execução de ordens reais (`OrderExecutor.ts`) tentará usar essas chaves.
- Se as chaves estiverem ausentes ou incorretas, as funcionalidades autenticadas (consulta de saldo, execução de ordens) falharão para a respectiva exchange. O bot ainda tentará rodar com dados públicos se possível.
- **SEGURANÇA:** Nunca exponha suas chaves API publicamente. Use este arquivo `.env` localmente. Em produção, use segredos do ambiente de hospedagem.

### 2. Instalar Dependências

Navegue até a pasta `arbitrage-bot-backend` e execute:
```bash
npm install
```

## Execução

### 1. Compilar o Código TypeScript
```bash
npm run build
```

### 2. Iniciar o Servidor e o Bot
```bash
npm start
```
O servidor da API estará disponível em `http://localhost:<API_PORT>` (ex: `http://localhost:3001`).
O bot começará a operar conforme a configuração `AUTO_START_BOT` ou aguardará um comando da API.

## Endpoints da API (Principais)

- `GET /api/status`: Retorna o estado atual do bot.
- `GET /api/opportunities/latest`: Retorna as últimas oportunidades de arbitragem detectadas.
- `GET /api/trades`: Retorna o histórico de trades executados (simulados ou reais).
- `GET /api/exchanges/balances`: Retorna os saldos de USDT nas exchanges configuradas.
- `POST /api/control/start`: Inicia o bot.
- `POST /api/control/pause`: Pausa o bot.

Veja `src/apiServer.ts` para mais detalhes sobre os endpoints.
