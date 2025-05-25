import React, { useState, useEffect, useCallback } from 'react';
import * as apiService from '../services/apiService'; 
import TradesHistory from './TradesHistory'; // Assumindo que será criado ou já existe

const BotDashboard: React.FC = () => {
  const [status, setStatus] = useState<apiService.BotStatusResponse | null>(null);
  const [opportunities, setOpportunities] = useState<apiService.ArbitrageOpportunity[]>([]);
  const [tradesHistory, setTradesHistory] = useState<apiService.ExecutedTrade[]>([]); // Para TradesHistory
  // const [exchangeBalances, setExchangeBalances] = useState<apiService.ExchangeBalance[]>([]); // Para ExchangeBalances (Parte 2)

  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [loadingOpportunities, setLoadingOpportunities] = useState<boolean>(true);
  const [loadingTradesHistory, setLoadingTradesHistory] = useState<boolean>(true); // Para TradesHistory
  // const [loadingBalances, setLoadingBalances] = useState<boolean>(true); // Para ExchangeBalances (Parte 2)

  const [actionMessage, setActionMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fetchStatus = useCallback(async () => {
    setLoadingStatus(true);
    // Não limpar errorMessage aqui para que erros de outras fetches não sejam sobrescritos
    try {
      const statusData = await apiService.getStatus();
      setStatus(statusData);
    } catch (error) {
      console.error('Failed to fetch status', error);
      setErrorMessage('Failed to fetch bot status.');
      setStatus(null);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  const fetchOpportunities = useCallback(async () => {
    setLoadingOpportunities(true);
    try {
      const opportunitiesData = await apiService.getLatestOpportunities();
      setOpportunities(opportunitiesData.opportunities || []);
    } catch (error) {
      console.error('Failed to fetch opportunities', error);
      setErrorMessage('Failed to fetch opportunities.');
      setOpportunities([]);
    } finally {
      setLoadingOpportunities(false);
    }
  }, []);

  // Função para buscar histórico de trades (será usada pela Parte 2 da tarefa também)
  const fetchTradesHistory = useCallback(async () => {
    setLoadingTradesHistory(true);
    try {
      const tradesData = await apiService.getExecutedTrades(); // Supondo que esta função existe em apiService
      setTradesHistory(tradesData.trades || []);
    } catch (error) {
      console.error('Failed to fetch trades history', error);
      setErrorMessage('Failed to fetch trades history.');
      setTradesHistory([]);
    } finally {
      setLoadingTradesHistory(false);
    }
  }, []);
  
  // Função para buscar saldos (Parte 2)
  // const fetchExchangeBalances = useCallback(async () => { ... });

  useEffect(() => {
    fetchStatus();
    fetchOpportunities();
    fetchTradesHistory(); // Adicionado para buscar histórico de trades
    // fetchExchangeBalances(); // Será adicionado na Parte 2

    const intervalId = setInterval(() => {
      fetchStatus();
      fetchOpportunities();
      fetchTradesHistory(); // Adicionado
      // fetchExchangeBalances(); // Será adicionado na Parte 2
    }, 30000); 

    return () => clearInterval(intervalId);
  }, [fetchStatus, fetchOpportunities, fetchTradesHistory /*, fetchExchangeBalances (Parte 2)*/]);

  const handleStartBot = async () => {
    setActionMessage('Starting bot...');
    setErrorMessage('');
    try {
      const response = await apiService.startBot();
      setActionMessage(response.message);
      fetchStatus(); 
    } catch (error) {
      console.error('Failed to start bot', error);
      setActionMessage('');
      setErrorMessage('Failed to start bot.');
    }
  };

  const handlePauseBot = async () => {
    setActionMessage('Pausing bot...');
    setErrorMessage('');
    try {
      const response = await apiService.pauseBot();
      setActionMessage(response.message);
      fetchStatus(); 
    } catch (error) {
      console.error('Failed to pause bot', error);
      setActionMessage('');
      setErrorMessage('Failed to pause bot.');
    }
  };
  
  const refreshAllData = () => {
    setActionMessage('Refreshing data...');
    fetchStatus();
    fetchOpportunities();
    fetchTradesHistory();
    // fetchExchangeBalances(); // Será adicionado na Parte 2
    setActionMessage('Data refresh initiated.');
    setTimeout(() => setActionMessage(''), 3000);
  };

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      <h1>Bot Dashboard</h1>

      {errorMessage && <p style={{ color: 'red', border: '1px solid red', padding: '10px' }}>Error: {errorMessage}</p>}
      {actionMessage && <p style={{ color: 'blue', border: '1px solid blue', padding: '10px' }}>Action: {actionMessage}</p>}

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
        <h2>Status do Bot</h2>
        {loadingStatus ? (
          <p>Carregando status...</p>
        ) : status ? (
          <div>
            <p><strong>Status Atual:</strong> <span style={{ fontWeight: 'bold', color: status.status === 'running' ? 'green' : (status.status === 'paused' ? 'orange' : 'red') }}>{status.status.toUpperCase()}</span></p>
            <p><strong>Desde:</strong> {new Date(status.since).toLocaleString()}</p>
            <p><strong>Mensagem:</strong> {status.message || 'N/A'}</p>
          </div>
        ) : (
          <p>Não foi possível carregar o status do bot.</p>
        )}
        <div>
          <button onClick={handleStartBot} disabled={loadingStatus || status?.status === 'running'} style={{ marginRight: '10px', padding: '8px 15px' }}>
            Start Bot
          </button>
          <button onClick={handlePauseBot} disabled={loadingStatus || status?.status !== 'running'} style={{ marginRight: '10px', padding: '8px 15px' }}>
            Pause Bot
          </button>
          <button onClick={refreshAllData} disabled={loadingStatus || loadingOpportunities || loadingTradesHistory} style={{ padding: '8px 15px' }}>
            Atualizar Dados
          </button>
        </div>
      </section>

      <section style={{ marginBottom: '30px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
        <h2>Últimas Oportunidades de Arbitragem (Top 5)</h2>
        {loadingOpportunities ? (
          <p>Carregando oportunidades...</p>
        ) : opportunities.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>Símbolo</th>
                <th style={tableHeaderStyle}>Comprar Em</th>
                <th style={tableHeaderStyle}>Preço Compra</th>
                <th style={tableHeaderStyle}>Vender Em</th>
                <th style={tableHeaderStyle}>Preço Venda</th>
                <th style={tableHeaderStyle}>Lucro Pot. (%)</th>
                <th style={tableHeaderStyle}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {opportunities.slice(0, 5).map((op, index) => (
                <tr key={index} style={index % 2 === 0 ? tableRowEvenStyle : tableRowOddStyle}>
                  <td style={tableCellStyle}>{op.symbol}</td>
                  <td style={tableCellStyle}>{op.buyAtExchange}</td>
                  <td style={tableCellStyle}>{op.buyPrice.toFixed(2)}</td>
                  <td style={tableCellStyle}>{op.sellAtExchange}</td>
                  <td style={tableCellStyle}>{op.sellPrice.toFixed(2)}</td>
                  <td style={tableCellStyle}>{op.potentialProfitPercent.toFixed(3)}%</td>
                  <td style={tableCellStyle}>{new Date(op.timestamp).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Nenhuma oportunidade de arbitragem detectada recentemente ou não foi possível buscar os dados.</p>
        )}
      </section>
      
      {/* Seção para TradesHistory (a ser implementada ou já existente) */}
      <TradesHistory trades={tradesHistory} loading={loadingTradesHistory} />

      {/* Seção para ExchangeBalances (Parte 2) */}
      {/* <ExchangeBalances balances={exchangeBalances} loading={loadingBalances} /> */}

    </div>
  );
};

// Estilos para a tabela (exemplo simples)
const tableHeaderStyle: React.CSSProperties = {
  borderBottom: '2px solid #ddd',
  padding: '8px',
  textAlign: 'left',
  backgroundColor: '#f7f7f7'
};

const tableCellStyle: React.CSSProperties = {
  borderBottom: '1px solid #eee',
  padding: '8px',
  textAlign: 'left'
};

const tableRowEvenStyle: React.CSSProperties = {
  backgroundColor: '#fdfdfd'
};

const tableRowOddStyle: React.CSSProperties = {
  backgroundColor: '#f9f9f9'
};

export default BotDashboard;
