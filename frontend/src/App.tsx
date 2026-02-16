import { useEffect } from 'react';
import { useGameStore } from './store/gameStore';
import { wsClient } from './network/websocket';
import { ServerMessage } from './network/protocol';
import { MatchmakingUI } from './components/MatchmakingUI';
import { Arena } from './components/Arena';
import { CardDeck } from './components/CardDeck';
import { ResultScreen } from './components/ResultScreen';

function App() {
  const { screen, connected, setConnected, setScreen, setPlayerNum, setRoomId, setGameState, setWinner } = useGameStore();

  useEffect(() => {
    const wsUrl = window.location.hostname === 'localhost'
      ? 'ws://localhost:8080/ws'
      : 'wss://beroyale.shardweb.app/ws';

    wsClient.connect(wsUrl)
      .then(() => setConnected(true))
      .catch((err) => console.error('Failed to connect:', err));

    const handleMessage = (msg: ServerMessage) => {
      switch (msg.type) {
        case 'MATCH_FOUND':
          setRoomId(msg.roomId || null);
          setPlayerNum(msg.playerNum || 1);
          setScreen('game');
          break;
        case 'GAME_STATE':
          if (msg.gameState) {
            setGameState(msg.gameState);
          }
          break;
        case 'GAME_OVER':
          setWinner(msg.winner || 0);
          setScreen('result');
          break;
      }
    };

    wsClient.on('*', handleMessage);

    return () => {
      wsClient.off('*', handleMessage);
      wsClient.disconnect();
    };
  }, [setConnected, setGameState, setPlayerNum, setRoomId, setScreen, setWinner]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100dvh',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
      padding: '10px',
      boxSizing: 'border-box',
      background: '#1a1a2e',
    }}>
      {!connected && (
        <div style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          padding: '10px 20px',
          background: '#e74c3c',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 100,
        }}>
          Conectando...
        </div>
      )}

      {screen === 'menu' && <MatchmakingUI />}
      {screen === 'matchmaking' && <MatchmakingUI />}
      {screen === 'game' && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '10px',
          height: '100%',
          width: '100%',
          alignItems: 'center',
        }}>
          <Arena />
          <CardDeck />
        </div>
      )}
      {screen === 'result' && <ResultScreen />}
    </div>
  );
}

export default App;
