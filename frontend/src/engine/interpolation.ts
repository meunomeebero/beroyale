import { GameState, TowerState, UnitState } from '../network/protocol';

export class Interpolator {
  private currentState: GameState | null = null;
  private interpolatedPositions: Map<string, { x: number; y: number }> = new Map();
  private interpolatedHP: Map<string, number> = new Map();
  private readonly lerpFactor = 0.3;
  private readonly projectileLerpFactor = 0.5;
  private readonly hpLerpFactor = 0.2;

  update(newState: GameState) {
    this.currentState = newState;
  }

  getInterpolatedState(): GameState | null {
    if (!this.currentState) return null;

    const interpolated: GameState = {
      ...this.currentState,
      player1: {
        ...this.currentState.player1,
        towers: this.currentState.player1.towers.map(tower => this.interpolateTower(tower)),
      },
      player2: {
        ...this.currentState.player2,
        towers: this.currentState.player2.towers.map(tower => this.interpolateTower(tower)),
      },
      units: this.currentState.units.map(unit => this.interpolateUnit(unit)),
      projectiles: (this.currentState.projectiles || []).map(proj => ({
        ...proj,
        x: this.interpolateValue(`proj_${proj.id}_x`, proj.x, this.projectileLerpFactor),
        y: this.interpolateValue(`proj_${proj.id}_y`, proj.y, this.projectileLerpFactor),
      })),
    };

    return interpolated;
  }

  private interpolateTower(tower: TowerState): TowerState {
    const hpKey = `tower_${tower.id}_hp`;
    const interpolatedHp = this.interpolateHP(hpKey, tower.hp, tower.maxHp);
    
    return {
      ...tower,
      hp: interpolatedHp,
    };
  }

  private interpolateUnit(unit: UnitState): UnitState {
    const xKey = `unit_${unit.id}_x`;
    const yKey = `unit_${unit.id}_y`;
    const hpKey = `unit_${unit.id}_hp`;

    return {
      ...unit,
      x: this.interpolateValue(xKey, unit.x, this.lerpFactor),
      y: this.interpolateValue(yKey, unit.y, this.lerpFactor),
      hp: this.interpolateHP(hpKey, unit.hp, unit.maxHp),
    };
  }

  private interpolateValue(key: string, targetValue: number, factor: number): number {
    const current = this.interpolatedPositions.get(key);

    if (!current) {
      this.interpolatedPositions.set(key, { x: targetValue, y: targetValue });
      return targetValue;
    }

    const interpolated = current.x + (targetValue - current.x) * factor;
    current.x = interpolated;

    return interpolated;
  }

  private interpolateHP(key: string, targetHP: number, _maxHP: number): number {
    const current = this.interpolatedHP.get(key);

    if (current === undefined) {
      this.interpolatedHP.set(key, targetHP);
      return targetHP;
    }

    if (targetHP >= current) {
      this.interpolatedHP.set(key, targetHP);
      return targetHP;
    }

    const interpolated = current + (targetHP - current) * this.hpLerpFactor;
    const result = Math.max(targetHP, Math.round(interpolated));
    this.interpolatedHP.set(key, result);

    return result;
  }

  reset() {
    this.currentState = null;
    this.interpolatedPositions.clear();
    this.interpolatedHP.clear();
  }
}
