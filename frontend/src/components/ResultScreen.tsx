import { useGameStore } from '../store/gameStore';

export function ResultScreen() {
  const { winner, playerNum, reset, setScreen } = useGameStore();
  
  const isVictory = winner === playerNum;

  const handlePlayAgain = () => {
    reset();
    setScreen('menu');
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '30px',
      padding: '40px',
      minHeight: '400px',
    }}>
      <h1 style={{
        fontSize: '64px',
        margin: 0,
        color: isVictory ? '#27ae60' : '#e74c3c',
        textShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}>
        {isVictory ? 'VITORIA!' : 'DERROTA'}
      </h1>
      
      <p style={{ fontSize: '18px', color: '#7f8c8d' }}>
        {isVictory 
          ? 'Voce destruiu a torre central inimiga!' 
          : 'Sua torre central foi destruida.'}
      </p>

      <button
        onClick={handlePlayAgain}
        style={{
          padding: '15px 50px',
          fontSize: '20px',
          background: 'linear-gradient(135deg, #3498db, #2980b9)',
          color: '#fff',
          border: 'none',
          borderRadius: '12px',
          cursor: 'pointer',
          fontWeight: 'bold',
        }}
      >
        Jogar Novamente
      </button>
    </div>
  );
}
