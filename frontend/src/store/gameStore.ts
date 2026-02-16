import { create } from 'zustand';
import { GameState, CardType, CARD_DEFINITIONS } from '../network/protocol';

type GameScreen = 'menu' | 'matchmaking' | 'game' | 'result';

interface GameStore {
  screen: GameScreen;
  setScreen: (screen: GameScreen) => void;
  
  connected: boolean;
  setConnected: (connected: boolean) => void;
  
  playerNum: number;
  setPlayerNum: (num: number) => void;
  
  roomId: string | null;
  setRoomId: (id: string | null) => void;
  
  gameState: GameState | null;
  setGameState: (state: GameState | null) => void;
  
  selectedCard: CardType | null;
  setSelectedCard: (card: CardType | null) => void;
  
  winner: number | null;
  setWinner: (winner: number | null) => void;

  clientElixir: number;
  setClientElixir: (value: number) => void;
  
  getMyElixir: () => number;
  getMyElixirInt: () => number;
  getMyTowers: () => GameState['player1']['towers'];
  getEnemyTowers: () => GameState['player1']['towers'];
  
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'menu',
  setScreen: (screen) => set({ screen }),
  
  connected: false,
  setConnected: (connected) => set({ connected }),
  
  playerNum: 0,
  setPlayerNum: (playerNum) => set({ playerNum }),
  
  roomId: null,
  setRoomId: (roomId) => set({ roomId }),
  
  gameState: null,
  setGameState: (gameState) => set({ gameState }),
  
  selectedCard: CARD_DEFINITIONS[0].type,
  setSelectedCard: (selectedCard) => set({ selectedCard }),
  
  winner: null,
  setWinner: (winner) => set({ winner }),

  clientElixir: 0,
  setClientElixir: (clientElixir) => set({ clientElixir }),
  
  getMyElixir: () => {
    const { gameState, playerNum } = get();
    if (!gameState) return 0;
    const elixir = playerNum === 1 ? gameState.player1.elixir : gameState.player2.elixir;
    return Math.floor(elixir * 10) / 10;
  },
  
  getMyElixirInt: () => {
    const { gameState, playerNum } = get();
    if (!gameState) return 0;
    const elixir = playerNum === 1 ? gameState.player1.elixir : gameState.player2.elixir;
    return Math.floor(elixir);
  },
  
  getMyTowers: () => {
    const { gameState, playerNum } = get();
    if (!gameState) return [];
    return playerNum === 1 ? gameState.player1.towers : gameState.player2.towers;
  },
  
  getEnemyTowers: () => {
    const { gameState, playerNum } = get();
    if (!gameState) return [];
    return playerNum === 1 ? gameState.player2.towers : gameState.player1.towers;
  },
  
  reset: () => set({
    screen: 'menu',
    playerNum: 0,
    roomId: null,
    gameState: null,
    selectedCard: CARD_DEFINITIONS[0].type,
    winner: null,
    clientElixir: 0,
  }),
}));
