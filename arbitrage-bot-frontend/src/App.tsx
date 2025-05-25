import React from 'react';
import BotDashboard from './components/BotDashboard';
import './App.css'; // Você pode remover ou modificar isso conforme necessário

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Arbitrage Bot Control Panel</h1>
      </header>
      <main>
        <BotDashboard />
      </main>
    </div>
  );
}

export default App;
