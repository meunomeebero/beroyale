import { 
  GameState, 
  TowerState, 
  UnitState, 
  ProjectileState,
  CARD_DEFINITIONS,
  ARENA_WIDTH,
  ARENA_HEIGHT,
  RIVER_Y,
  GRID_SIZE
} from '../network/protocol';
import { GameSimulator } from './simulator';

const RIVER_HEIGHT = 40;
const BRIDGE1_START_X = 120;
const BRIDGE1_END_X = 240;
const BRIDGE2_START_X = 560;
const BRIDGE2_END_X = 680;

const COLORS = {
  ally: '#3498db',
  allyDark: '#2980b9',
  allyLight: '#5dade2',
  enemy: '#e74c3c',
  enemyDark: '#c0392b',
  enemyLight: '#ec7063',
  damage: '#ff0000',
};

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private playerNum: number = 1;
  private simulator: GameSimulator | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.imageSmoothingEnabled = false;
    this.canvas.width = ARENA_WIDTH;
    this.canvas.height = ARENA_HEIGHT;
  }

  setPlayerNum(num: number) {
    this.playerNum = num;
  }

  setSimulator(simulator: GameSimulator) {
    this.simulator = simulator;
  }

  private transformY(y: number): number {
    if (this.playerNum === 2) {
      return ARENA_HEIGHT - y;
    }
    return y;
  }

  private snap(value: number): number {
    return Math.floor(value);
  }

  render(state: GameState | null) {
    this.clear();
    this.drawArena();
    this.drawGrid();
    this.drawRiver();

    if (state) {
      this.drawTowers(state.player1.towers, 1);
      this.drawTowers(state.player2.towers, 2);
      this.drawUnits(state.units);
      if (state.projectiles) {
        this.drawProjectiles(state.projectiles);
      }
    }
  }

  private clear() {
    this.ctx.fillStyle = '#3d5c5c';
    this.ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
  }

  private drawArena() {
    const myFieldStart = this.snap(this.transformY(RIVER_Y + RIVER_HEIGHT / 2));
    const enemyFieldEnd = this.snap(this.transformY(RIVER_Y - RIVER_HEIGHT / 2));

    this.ctx.fillStyle = '#4a6b6b';
    if (this.playerNum === 1) {
      this.ctx.fillRect(0, myFieldStart, ARENA_WIDTH, ARENA_HEIGHT - myFieldStart);
    } else {
      this.ctx.fillRect(0, 0, ARENA_WIDTH, myFieldStart);
    }

    this.ctx.fillStyle = '#5c4a4a';
    if (this.playerNum === 1) {
      this.ctx.fillRect(0, 0, ARENA_WIDTH, enemyFieldEnd);
    } else {
      this.ctx.fillRect(0, enemyFieldEnd, ARENA_WIDTH, ARENA_HEIGHT - enemyFieldEnd);
  }
  }

  private drawGrid() {
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.ctx.lineWidth = 1;

    for (let x = 0; x <= ARENA_WIDTH; x += GRID_SIZE) {
      const sx = this.snap(x);
      this.ctx.beginPath();
      this.ctx.moveTo(sx, 0);
      this.ctx.lineTo(sx, ARENA_HEIGHT);
      this.ctx.stroke();
    }

    for (let y = 0; y <= ARENA_HEIGHT; y += GRID_SIZE) {
      const sy = this.snap(y);
      this.ctx.beginPath();
      this.ctx.moveTo(0, sy);
      this.ctx.lineTo(ARENA_WIDTH, sy);
      this.ctx.stroke();
    }
  }

  private drawRiver() {
    const riverCenterY = this.snap(this.transformY(RIVER_Y));
    const riverTop = riverCenterY - RIVER_HEIGHT / 2;
    const riverBottom = riverCenterY + RIVER_HEIGHT / 2;
    const actualTop = this.snap(Math.min(riverTop, riverBottom));
    const actualHeight = this.snap(Math.abs(riverBottom - riverTop));

    this.ctx.fillStyle = '#2980b9';
    this.ctx.fillRect(0, actualTop, ARENA_WIDTH, actualHeight);

    this.ctx.fillStyle = '#1a5276';
    this.ctx.fillRect(0, actualTop, ARENA_WIDTH, 3);
    this.ctx.fillRect(0, actualTop + actualHeight - 3, ARENA_WIDTH, 3);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < 8; i++) {
      const waveX = this.snap((i * 100 + (Date.now() / 50) % 100) % ARENA_WIDTH);
      this.ctx.fillRect(waveX, actualTop + actualHeight / 2 - 2, 30, 4);
    }

    this.drawBridge(BRIDGE1_START_X, actualTop, BRIDGE1_END_X - BRIDGE1_START_X, actualHeight);
    this.drawBridge(BRIDGE2_START_X, actualTop, BRIDGE2_END_X - BRIDGE2_START_X, actualHeight);
  }

  private drawBridge(x: number, y: number, width: number, height: number) {
    const sx = this.snap(x);
    const sy = this.snap(y);
    const sw = this.snap(width);
    const sh = this.snap(height);

    this.ctx.fillStyle = '#8b4513';
    this.ctx.fillRect(sx, sy - 5, sw, sh + 10);

    this.ctx.fillStyle = '#654321';
    this.ctx.fillRect(sx, sy - 5, sw, 3);
    this.ctx.fillRect(sx, sy + sh + 2, sw, 3);

    this.ctx.fillStyle = '#5d3a1a';
    const plankWidth = 8;
    for (let px = sx + 5; px < sx + sw - 5; px += 15) {
      this.ctx.fillRect(this.snap(px), sy, plankWidth, sh);
    }

    this.ctx.fillStyle = '#4a2a10';
    this.ctx.fillRect(sx, sy - 5, 5, sh + 10);
    this.ctx.fillRect(sx + sw - 5, sy - 5, 5, sh + 10);
  }

  private getDamageFade(id: string): number {
    return this.simulator?.getDamageFade(id) || 0;
  }

  private drawDamageOverlay(x: number, y: number, width: number, height: number, intensity: number) {
    const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 35);
    const alpha = Math.min(0.85, 0.25 + intensity * 0.55 * pulse);
    this.ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
    this.ctx.fillRect(this.snap(x), this.snap(y), this.snap(width), this.snap(height));
  }

  private drawTowers(towers: TowerState[], owner: number) {
    const isAlly = owner === this.playerNum;
    const baseColor = isAlly ? COLORS.ally : COLORS.enemy;
    const darkColor = isAlly ? COLORS.allyDark : COLORS.enemyDark;

    for (const tower of towers) {
      if (tower.hp <= 0) continue;

      const size = tower.type === 'king' ? 60 : 40;
      const transformedY = this.snap(this.transformY(tower.y));
      const x = this.snap(tower.x) - size / 2;
      const y = transformedY - size / 2;

      const damageFade = this.getDamageFade(tower.id);

      this.ctx.fillStyle = darkColor;
      this.ctx.fillRect(x + 3, y + 3, size, size);

      this.ctx.fillStyle = baseColor;
      this.ctx.fillRect(x, y, size, size);

      if (damageFade > 0) {
        this.drawDamageOverlay(x, y, size, size, damageFade);
      }

      this.ctx.strokeStyle = isAlly ? '#5dade2' : '#f1948a';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, size, size);

      if (tower.type === 'king') {
        this.ctx.fillStyle = '#f1c40f';
        this.ctx.beginPath();
        this.ctx.moveTo(this.snap(tower.x), this.snap(transformedY - 18));
        this.ctx.lineTo(this.snap(tower.x - 12), this.snap(transformedY));
        this.ctx.lineTo(this.snap(tower.x + 12), this.snap(transformedY));
        this.ctx.closePath();
        this.ctx.fill();

        this.ctx.strokeStyle = '#d4ac0d';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
      } else {
        this.ctx.fillStyle = '#2c3e50';
        this.ctx.beginPath();
        this.ctx.arc(this.snap(tower.x), transformedY, 8, 0, Math.PI * 2);
        this.ctx.fill();
      }

      this.drawHealthBar(this.snap(tower.x), transformedY - size / 2 - 12, size, tower.hp, tower.maxHp, isAlly);
    }
  }

  private drawUnits(units: UnitState[]) {
    for (const unit of units) {
      if (unit.hp <= 0) continue;

      const cardDef = CARD_DEFINITIONS.find(c => c.type === unit.type);
      const color = cardDef?.color || '#ffffff';
      const size = 24;
      const transformedY = this.snap(this.transformY(unit.y));
      const x = this.snap(unit.x) - size / 2;
      const y = transformedY - size / 2;

      const isAlly = unit.owner === this.playerNum;
      const damageFade = this.getDamageFade(unit.id);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      this.ctx.fillRect(x + 2, y + 2, size, size);

      this.ctx.fillStyle = color;
      this.ctx.fillRect(x, y, size, size);

      if (damageFade > 0) {
        this.drawDamageOverlay(x, y, size, size, damageFade);
      }

      this.ctx.strokeStyle = isAlly ? COLORS.ally : COLORS.enemy;
      this.ctx.lineWidth = 3;
      this.ctx.strokeRect(x, y, size, size);

      this.ctx.fillStyle = isAlly ? COLORS.allyLight : COLORS.enemyLight;
      this.ctx.fillRect(x + 2, y + 2, 4, 4);

      this.drawHealthBar(this.snap(unit.x), transformedY - size / 2 - 8, size, unit.hp, unit.maxHp, isAlly);
    }
  }

  private drawProjectiles(projectiles: ProjectileState[]) {
    for (const proj of projectiles) {
      const transformedY = this.snap(this.transformY(proj.y));
      const projX = this.snap(proj.x);

      let projColor = '#ffffff';
      let projSize = 5;

      if (proj.type === 'tower') {
        projColor = '#f39c12';
        projSize = 6;
      } else if (proj.type === 'ranged') {
        projColor = '#3498db';
        projSize = 4;
      } else if (proj.type === 'aoe') {
        projColor = '#9b59b6';
        projSize = 7;
      }

      this.ctx.shadowColor = projColor;
      this.ctx.shadowBlur = 10;

      this.ctx.fillStyle = projColor;
      this.ctx.beginPath();
      this.ctx.arc(projX, transformedY, projSize, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.shadowBlur = 0;

      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.beginPath();
      this.ctx.arc(projX - 1, transformedY - 1, projSize / 3, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  private drawHealthBar(x: number, y: number, width: number, hp: number, maxHp: number, isAlly: boolean) {
    const barHeight = 6;
    const barX = this.snap(x - width / 2);
    const barY = this.snap(y);
    const healthPercent = Math.max(0, Math.min(1, hp / maxHp));
    const filledWidth = hp > 0 ? Math.max(1, this.snap(width * healthPercent)) : 0;

    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(barX - 1, barY - 1, width + 2, barHeight + 2);

    this.ctx.fillStyle = '#333';
    this.ctx.fillRect(barX, barY, width, barHeight);

    const healthColor = isAlly ? COLORS.ally : COLORS.enemy;
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(barX, barY, filledWidth, barHeight);

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    this.ctx.fillRect(barX, barY, filledWidth, this.snap(barHeight / 3));
  }

  getCanvasCoordinates(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = ARENA_WIDTH / rect.width;
    const scaleY = ARENA_HEIGHT / rect.height;

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (this.playerNum === 2) {
      y = ARENA_HEIGHT - y;
    }

    return { x, y };
  }

  isValidSpawnPosition(y: number): boolean {
    if (this.playerNum === 1) {
      return y > RIVER_Y + RIVER_HEIGHT / 2;
    }
    if (this.playerNum === 2) {
      return y < RIVER_Y - RIVER_HEIGHT / 2;
    }
    return y > RIVER_Y + RIVER_HEIGHT / 2;
  }
}
