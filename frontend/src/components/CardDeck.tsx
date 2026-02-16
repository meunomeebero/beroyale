import { useGameStore } from '../store/gameStore';
import { CARD_DEFINITIONS } from '../network/protocol';

export function CardDeck() {
  const { selectedCard, setSelectedCard } = useGameStore();
  const elixirInt = useGameStore(state => state.clientElixir);

  return (
    <div style={{
      display: 'flex',
      gap: '6px',
      padding: '10px',
      background: '#2c3e50',
      borderRadius: '8px',
      justifyContent: 'center',
      flexShrink: 0,
      boxShadow: '0 -2px 10px rgba(0,0,0,0.3)',
    }}>
      {CARD_DEFINITIONS.map((card) => {
        const canAfford = elixirInt >= card.elixirCost;
        const isSelected = selectedCard === card.type;

        return (
          <button
            key={card.type}
            onClick={() => setSelectedCard(card.type)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px',
              background: isSelected ? '#2980b9' : '#1a1a2e',
              border: isSelected ? '2px solid #3498db' : '2px solid #34495e',
              borderRadius: '6px',
              cursor: 'pointer',
              opacity: canAfford ? 1 : 0.4,
              minWidth: '60px',
              outline: 'none',
              transition: 'opacity 0.1s',
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              background: card.color,
              borderRadius: '4px',
              marginBottom: '4px',
              boxShadow: isSelected ? '0 0 8px ' + card.color : 'none',
            }} />
            <span style={{ 
              fontSize: '10px', 
              fontWeight: 'bold',
              color: '#bdc3c7',
              marginBottom: '2px'
            }}>
              {card.name}
            </span>
            <span style={{
              fontSize: '12px',
              color: canAfford ? '#9b59b6' : '#666',
              fontWeight: 'bold',
            }}>
              {card.elixirCost}
            </span>
          </button>
        );
      })}
    </div>
  );
}
