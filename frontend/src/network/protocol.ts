export type MessageType = 
  | 'JOIN_QUEUE'
  | 'LEAVE_QUEUE'
  | 'MATCH_FOUND'
  | 'GAME_START'
  | 'SPAWN_UNIT'
  | 'GAME_STATE'
  | 'GAME_OVER'
  | 'ERROR';

export type CardType = 'melee' | 'ranged' | 'aoe' | 'single' | 'defense';

export interface ClientMessage {
  type: MessageType;
  cardType?: CardType;
  x?: number;
  y?: number;
}

export interface ServerMessage {
  type: MessageType;
  roomId?: string;
  playerNum?: number;
  opponentId?: string;
  gameState?: GameState;
  winner?: number;
  reason?: string;
  error?: string;
}

export interface GameState {
  tick: number;
  player1: PlayerState;
  player2: PlayerState;
  units: UnitState[];
  projectiles: ProjectileState[];
}

export interface PlayerState {
  elixir: number;
  towers: TowerState[];
}

export interface TowerState {
  id: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  type: string;
}

export interface UnitState {
  id: string;
  type: CardType;
  owner: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
}

export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  type: 'tower' | 'ranged' | 'aoe';
}

export interface CardDefinition {
  type: CardType;
  name: string;
  elixirCost: number;
  color: string;
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  { type: 'melee', name: 'Guerreiro', elixirCost: 3, color: '#e74c3c' },
  { type: 'ranged', name: 'Arqueiro', elixirCost: 3, color: '#3498db' },
  { type: 'aoe', name: 'Mago', elixirCost: 4, color: '#9b59b6' },
  { type: 'single', name: 'Assassino', elixirCost: 5, color: '#f1c40f' },
  { type: 'defense', name: 'Canhao', elixirCost: 4, color: '#2ecc71' },
];

export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 1000;
export const RIVER_Y = 500;
export const GRID_SIZE = 40;
