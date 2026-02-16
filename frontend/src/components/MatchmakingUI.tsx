import { useGameStore } from '../store/gameStore';
import { wsClient } from '../network/websocket';

export function MatchmakingUI() {
  const { screen } = useGameStore();

  const handleFindMatch = () => {
    useGameStore.getState().setScreen('matchmaking');
    wsClient.send({ type: 'JOIN_QUEUE' });
  };

  const handleCancel = () => {
    useGameStore.getState().setScreen('menu');
    wsClient.send({ type: 'LEAVE_QUEUE' });
  };

  if (screen === 'matchmaking') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
        padding: '40px',
      }}>
        <div style={{ 
          width: '60px', 
          height: '60px',
          border: '4px solid #3498db',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
        <h2>Buscando partida...</h2>
        <button
          onClick={handleCancel}
          style={{
            padding: '10px 30px',
            fontSize: '16px',
            background: '#e74c3c',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '30px',
      padding: '40px',
    }}>
      <h1 style={{ fontSize: '48px', margin: 0 }}>BERO ROYALE</h1>
      <p style={{ color: '#7f8c8d' }}>Jogo multiplayer em tempo real</p>
      <button
        onClick={handleFindMatch}
        style={{
          padding: '15px 50px',
          fontSize: '20px',
          background: 'linear-gradient(135deg, #3498db, #2980b9)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: 'bold',
          boxShadow: '0 4px 15px rgba(52, 152, 219, 0.4)',
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        Buscar Partida
      </button>
    </div>
  );
}
