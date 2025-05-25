import axios, { AxiosInstance } from 'axios';

// Interfaces para as respostas da API (podem ser expandidas conforme necessário)
// Estas devem idealmente corresponder às estruturas de dados definidas no backend
// ou serem um subconjunto delas.

interface BotStatusInfo {
  status: string;
  since: number; // Assumindo que 'since' é um timestamp (number)
  message?: string;
}

export interface BotStatusResponse {
  status: string; // Ou um enum se tivermos estados bem definidos
  since: string; // A API pode retornar como string ISO ou timestamp
  message?: string;
  // Adicionando uma forma de lidar com a estrutura que a API realmente retorna
  // Se a API retorna { status: BotStatusInfo }, então:
  // statusDetails?: BotStatusInfo; 
}

// Baseado na interface ArbitrageOpportunity do backend
export interface ArbitrageOpportunity {
  symbol: string;
  buyAtExchange: string;
  sellAtExchange: string;
  buyPrice: number;
  sellPrice: number;
  potentialProfitPercent: number;
  timestamp: number; 
}

export interface OpportunitiesResponse {
  opportunities: ArbitrageOpportunity[];
}

export interface ControlResponse {
  success: boolean;
  message: string;
}

// Configuração da instância do Axios
// A URL base da API deve vir de uma variável de ambiente
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Funções do serviço de API
export const getStatus = async (): Promise<BotStatusResponse> => {
  try {
    const response = await apiClient.get<BotStatusResponse>('/status');
    // A API do backend retorna { status: { status: 'stopped', since: 1716588009821, message: 'Bot service initialized.' } }
    // Ajustar para retornar o objeto status interno diretamente se a API tiver essa estrutura aninhada.
    // Se a API retorna diretamente { status: 'stopped', since: ...}, o mapeamento abaixo não é necessário.
    // Assumindo que a API retorna a estrutura que definimos em BotStatusResponse
    return response.data; 
  } catch (error) {
    console.error('Error fetching bot status:', error);
    throw error; // Re-throw para que o componente possa tratar
  }
};

export const getLatestOpportunities = async (): Promise<OpportunitiesResponse> => {
  try {
    const response = await apiClient.get<OpportunitiesResponse>('/opportunities/latest');
    return response.data;
  } catch (error) {
    console.error('Error fetching latest opportunities:', error);
    throw error;
  }
};

export const startBot = async (): Promise<ControlResponse> => {
  try {
    const response = await apiClient.post<ControlResponse>('/control/start');
    return response.data;
  } catch (error) {
    console.error('Error starting bot:', error);
    throw error;
  }
};

export const pauseBot = async (): Promise<ControlResponse> => {
  try {
    const response = await apiClient.post<ControlResponse>('/control/pause');
    return response.data;
  } catch (error) {
    console.error('Error pausing bot:', error);
    throw error;
  }
};

// Exportar o apiClient se for necessário para chamadas mais complexas ou configuração em outros lugares
export default apiClient;
