# Bot de Arbitragem - Frontend

Esta é a interface de usuário (painel) para interagir com o Bot de Arbitragem.

## Configuração

### 1. Variável de Ambiente

Crie um arquivo `.env.development` (ou `.env.production` para builds de produção) na raiz da pasta `arbitrage-bot-frontend` com a seguinte variável:

```
VITE_API_BASE_URL=http://localhost:3001/api
```
Substitua `http://localhost:3001/api` pela URL correta onde o backend do bot de arbitragem está sendo executado, se for diferente.

### 2. Instalar Dependências

Navegue até a pasta `arbitrage-bot-frontend` e execute:
```bash
npm install
```

## Execução em Desenvolvimento

```bash
npm run dev
```
O frontend estará disponível em `http://localhost:5173` (ou outra porta indicada pelo Vite).
Certifique-se de que o Backend do Bot de Arbitragem esteja rodando e acessível na URL configurada em `VITE_API_BASE_URL`.

## Funcionalidades

- Visualizar o status atual do bot.
- Iniciar e pausar o bot.
- Ver as últimas oportunidades de arbitragem detectadas.
- Consultar o histórico de trades realizados.
- Visualizar os saldos de USDT nas exchanges configuradas no backend.
