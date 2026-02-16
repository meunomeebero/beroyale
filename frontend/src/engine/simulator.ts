import {
  GameState,
  ProjectileState,
  TowerState,
  UnitState,
} from '../network/protocol';

const RIVER_START_Y = 480;
const RIVER_END_Y = 520;
const BRIDGE1_START_X = 120;
const BRIDGE1_END_X = 240;
const BRIDGE1_CENTER_X = 180;
const BRIDGE2_START_X = 560;
const BRIDGE2_END_X = 680;
const BRIDGE2_CENTER_X = 620;

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 1000;

const ELIXIR_REGEN_RATE = 1.0;
const MAX_ELIXIR = 10.0;
const PROJECTILE_SPEED = 400;

const POSITION_CORRECTION = 0.2;
const ELIXIR_CORRECTION = 0.2;
const REMOVE_MISSING_AFTER = 4;
const REVIVE_CONFIRM_FRAMES = 12;

type ProjectileKind = 'tower' | 'ranged' | 'aoe';

interface DamageEvent {
  targetId: string;
  timestamp: number;
}

interface UnitStats {
  damage: number;
  moveSpeed: number;
  range: number;
  attackSpeed: number;
  aoeRadius: number;
  isBuilding: boolean;
}

interface UnitRuntime {
  targetId: string;
  lastAttackTime: number;
}

interface LocalProjectileMeta {
  owner: number;
  damage: number;
  aoeRadius: number;
}

interface EnemyTarget {
  id: string;
  x: number;
  y: number;
  type: 'unit' | 'tower';
}

const UNIT_STATS: Record<string, UnitStats> = {
  melee: { damage: 80, moveSpeed: 60, range: 30, attackSpeed: 1.0, aoeRadius: 0, isBuilding: false },
  ranged: { damage: 60, moveSpeed: 40, range: 250, attackSpeed: 1.2, aoeRadius: 0, isBuilding: false },
  aoe: { damage: 50, moveSpeed: 50, range: 150, attackSpeed: 1.5, aoeRadius: 80, isBuilding: false },
  single: { damage: 200, moveSpeed: 70, range: 200, attackSpeed: 2.0, aoeRadius: 0, isBuilding: false },
  defense: { damage: 100, moveSpeed: 0, range: 300, attackSpeed: 1.0, aoeRadius: 0, isBuilding: true },
};

export class GameSimulator {
  private state: GameState | null = null;
  private lastUpdateTime = 0;
  private simulationTime = 0;
  private localTick = 0;

  private damageEvents: DamageEvent[] = [];
  private lastDamageById: Map<string, number> = new Map();

  private unitRuntimeById: Map<string, UnitRuntime> = new Map();
  private towerLastAttack: Map<string, number> = new Map();
  private unitMissingFrames: Map<string, number> = new Map();
  private deadTowerLocks: Set<string> = new Set();
  private towerReviveFrames: Map<string, number> = new Map();

  private projectileMetaById: Map<string, LocalProjectileMeta> = new Map();
  private nextProjectileId = 1;

  setState(serverState: GameState) {
    if (!this.state) {
      this.state = this.cloneState(serverState);
      this.lastUpdateTime = performance.now();
      this.simulationTime = serverState.tick / 60;
      this.syncRuntimeWithState();
      return;
    }

    this.reconcile(serverState);
  }

  private cloneState(state: GameState): GameState {
    return {
      tick: state.tick,
      player1: {
        elixir: state.player1.elixir,
        towers: state.player1.towers.map((t) => ({ ...t })),
      },
      player2: {
        elixir: state.player2.elixir,
        towers: state.player2.towers.map((t) => ({ ...t })),
      },
      units: state.units.map((u) => ({ ...u })),
      projectiles: [],
    };
  }

  private syncRuntimeWithState() {
    if (!this.state) return;

    const unitIds = new Set(this.state.units.map((u) => u.id));
    for (const id of this.unitRuntimeById.keys()) {
      if (!unitIds.has(id)) {
        this.unitRuntimeById.delete(id);
      }
    }
    for (const unit of this.state.units) {
      if (!this.unitRuntimeById.has(unit.id)) {
        this.unitRuntimeById.set(unit.id, { targetId: '', lastAttackTime: 0 });
      }
    }

    const towerIds = new Set([
      ...this.state.player1.towers.map((t) => t.id),
      ...this.state.player2.towers.map((t) => t.id),
    ]);
    for (const id of this.towerLastAttack.keys()) {
      if (!towerIds.has(id)) {
        this.towerLastAttack.delete(id);
      }
    }
    for (const id of towerIds) {
      if (!this.towerLastAttack.has(id)) {
        this.towerLastAttack.set(id, 0);
      }
    }
  }

  private reconcile(serverState: GameState) {
    if (!this.state) return;

    this.state.tick = Math.max(this.state.tick, serverState.tick);
    this.state.player1.elixir = this.reconcileElixir(this.state.player1.elixir, serverState.player1.elixir);
    this.state.player2.elixir = this.reconcileElixir(this.state.player2.elixir, serverState.player2.elixir);

    this.reconcileTowers(this.state.player1.towers, serverState.player1.towers);
    this.reconcileTowers(this.state.player2.towers, serverState.player2.towers);
    this.reconcileUnits(serverState.units);
  }

  private reconcileTowers(localTowers: TowerState[], serverTowers: TowerState[]) {
    for (const serverTower of serverTowers) {
      const localTower = localTowers.find((t) => t.id === serverTower.id);
      if (!localTower) continue;

      localTower.maxHp = serverTower.maxHp;
      localTower.x = this.correctPosition(localTower.x, serverTower.x);
      localTower.y = this.correctPosition(localTower.y, serverTower.y);

      if (serverTower.hp <= 0) {
        localTower.hp = 0;
        this.deadTowerLocks.add(localTower.id);
        this.towerReviveFrames.delete(localTower.id);
        continue;
      }

      if (this.deadTowerLocks.has(localTower.id)) {
        const reviveFrames = (this.towerReviveFrames.get(localTower.id) || 0) + 1;
        if (reviveFrames >= REVIVE_CONFIRM_FRAMES) {
          localTower.hp = serverTower.hp;
          this.deadTowerLocks.delete(localTower.id);
          this.towerReviveFrames.delete(localTower.id);
        } else {
          localTower.hp = 0;
          this.towerReviveFrames.set(localTower.id, reviveFrames);
        }
        continue;
      }

      if (serverTower.hp < localTower.hp) {
        this.applyDamageToTower(localTower, localTower.hp - serverTower.hp);
      }

      if (localTower.hp <= 0 && serverTower.hp > 0) {
        localTower.hp = serverTower.hp;
      }
    }
  }

  private reconcileUnits(serverUnits: UnitState[]) {
    if (!this.state) return;

    const serverUnitById = new Map(serverUnits.map((u) => [u.id, u]));
    const nextUnits: UnitState[] = [];

    for (const localUnit of this.state.units) {
      const serverUnit = serverUnitById.get(localUnit.id);
      if (!serverUnit) {
        const missing = (this.unitMissingFrames.get(localUnit.id) || 0) + 1;
        this.unitMissingFrames.set(localUnit.id, missing);

        if (missing < REMOVE_MISSING_AFTER && localUnit.hp > 0) {
          nextUnits.push(localUnit);
        } else {
          this.unitRuntimeById.delete(localUnit.id);
          this.unitMissingFrames.delete(localUnit.id);
          this.lastDamageById.delete(localUnit.id);
        }
        continue;
      }

      this.unitMissingFrames.delete(localUnit.id);

      if (serverUnit.hp < localUnit.hp) {
        this.applyDamageToUnit(localUnit, localUnit.hp - serverUnit.hp);
      }

      localUnit.type = serverUnit.type;
      localUnit.owner = serverUnit.owner;
      localUnit.maxHp = serverUnit.maxHp;
      localUnit.x = this.correctPosition(localUnit.x, serverUnit.x);
      localUnit.y = this.correctPosition(localUnit.y, serverUnit.y);

      if (localUnit.hp <= 0 && serverUnit.hp > 0) {
        localUnit.hp = serverUnit.hp;
      }

      nextUnits.push(localUnit);
      serverUnitById.delete(localUnit.id);
    }

    for (const unit of serverUnitById.values()) {
      nextUnits.push({ ...unit });
      this.unitRuntimeById.set(unit.id, { targetId: '', lastAttackTime: 0 });
    }

    this.state.units = nextUnits;
  }

  private reconcileElixir(localValue: number, serverValue: number): number {
    if (serverValue < localValue) {
      return serverValue;
    }
    return this.lerp(localValue, serverValue, ELIXIR_CORRECTION);
  }

  private lerp(from: number, to: number, factor: number): number {
    return from + (to - from) * factor;
  }

  private correctPosition(localValue: number, serverValue: number): number {
    const diff = Math.abs(localValue - serverValue);
    if (diff < 0.25) return serverValue;
    if (diff > 40) return serverValue;
    return this.lerp(localValue, serverValue, POSITION_CORRECTION);
  }

  private addDamageEvent(targetId: string) {
    const now = performance.now();
    const last = this.lastDamageById.get(targetId) || 0;
    if (now - last < 60) return;

    this.lastDamageById.set(targetId, now);
    this.damageEvents.push({ targetId, timestamp: now });
  }

  getDamageEvents(): DamageEvent[] {
    const now = performance.now();
    this.damageEvents = this.damageEvents.filter((e) => now - e.timestamp < 200);
    return this.damageEvents;
  }

  isRecentlyDamaged(id: string): boolean {
    const now = performance.now();
    return this.damageEvents.some((e) => e.targetId === id && now - e.timestamp < 200);
  }

  getDamageFade(id: string): number {
    const last = this.lastDamageById.get(id);
    if (!last) return 0;
    const age = performance.now() - last;
    const duration = 200;
    if (age >= duration) return 0;
    return 1 - age / duration;
  }

  update(): GameState | null {
    if (!this.state) return null;

    const now = performance.now();
    const deltaTime = (now - this.lastUpdateTime) / 1000;
    this.lastUpdateTime = now;

    if (deltaTime > 0.1) return this.state;

    this.localTick++;
    this.simulationTime += deltaTime;
    this.state.tick++;

    this.updateElixir(deltaTime);
    this.updateUnits(deltaTime);
    this.applySeparation();
    this.processCombat();
    this.updateProjectiles(deltaTime);
    this.removeDeadUnits();

    return this.state;
  }

  private updateElixir(deltaTime: number) {
    if (!this.state) return;

    this.state.player1.elixir = Math.min(MAX_ELIXIR, this.state.player1.elixir + ELIXIR_REGEN_RATE * deltaTime);
    this.state.player2.elixir = Math.min(MAX_ELIXIR, this.state.player2.elixir + ELIXIR_REGEN_RATE * deltaTime);
  }

  private updateUnits(deltaTime: number) {
    if (!this.state) return;

    for (const unit of this.state.units) {
      if (unit.hp <= 0) continue;

      const stats = this.getUnitStats(unit.type);
      const target = this.findNearestEnemyTarget(unit);
      const runtime = this.getUnitRuntime(unit.id);
      runtime.targetId = target?.id || '';

      if (!target) continue;
      if (stats.isBuilding || stats.moveSpeed <= 0) continue;

      const dist = this.distance(unit.x, unit.y, target.x, target.y);
      if (dist <= stats.range) continue;

      const waypoint = this.getNextWaypoint(unit, target.x, target.y);
      const moved = this.moveTowards(unit.x, unit.y, waypoint.x, waypoint.y, stats.moveSpeed, deltaTime);
      unit.x = moved.x;
      unit.y = moved.y;
    }
  }

  private processCombat() {
    if (!this.state) return;

    for (const unit of this.state.units) {
      if (unit.hp <= 0) continue;

      const stats = this.getUnitStats(unit.type);
      const runtime = this.getUnitRuntime(unit.id);
      if (!runtime.targetId) continue;
      if (this.simulationTime - runtime.lastAttackTime < stats.attackSpeed) continue;

      const target = this.findTargetById(runtime.targetId);
      if (!target) continue;

      const dist = this.distance(unit.x, unit.y, target.x, target.y);
      if (dist > stats.range) continue;

      runtime.lastAttackTime = this.simulationTime;

      if (unit.type === 'aoe') {
        this.spawnProjectile(unit.owner, unit.x, unit.y, target.x, target.y, 'aoe', stats.damage, stats.aoeRadius);
        continue;
      }

      if (unit.type === 'ranged' || unit.type === 'single') {
        this.spawnProjectile(unit.owner, unit.x, unit.y, target.x, target.y, 'ranged', stats.damage, 0);
        continue;
      }

      if (target.type === 'unit') {
        this.applyDamageToUnit(target.target, stats.damage);
      } else {
        this.applyDamageToTower(target.target, stats.damage);
      }
    }

    this.processTowerCombat(this.state.player1.towers, this.state.units);
    this.processTowerCombat(this.state.player2.towers, this.state.units);
  }

  private processTowerCombat(towers: TowerState[], units: UnitState[]) {
    const kingCanAttack = towers.some((t) => t.type === 'lateral' && t.hp <= 0);

    for (const tower of towers) {
      if (tower.hp <= 0) continue;

      if (tower.type === 'king' && !kingCanAttack) continue;

      const lastAttack = this.towerLastAttack.get(tower.id) || 0;
      if (this.simulationTime - lastAttack < 1.0) continue;

      const towerRange = tower.type === 'king' ? 350 : 300;
      const towerDamage = tower.type === 'king' ? 150 : 100;

      const enemyOwner = towers === this.state?.player1.towers ? 2 : 1;
      let nearest: UnitState | null = null;
      let minDist = Number.MAX_VALUE;

      for (const unit of units) {
        if (unit.owner !== enemyOwner || unit.hp <= 0) continue;
        const dist = this.distance(tower.x, tower.y, unit.x, unit.y);
        if (dist <= towerRange && dist < minDist) {
          minDist = dist;
          nearest = unit;
        }
      }

      if (!nearest) continue;

      this.towerLastAttack.set(tower.id, this.simulationTime);
      this.spawnProjectile(
        towers === this.state?.player1.towers ? 1 : 2,
        tower.x,
        tower.y,
        nearest.x,
        nearest.y,
        'tower',
        towerDamage,
        0,
      );
    }
  }

  private spawnProjectile(
    owner: number,
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    type: ProjectileKind,
    damage: number,
    aoeRadius: number,
  ) {
    if (!this.state) return;

    const id = `local_proj_${this.nextProjectileId++}`;
    const projectile: ProjectileState = {
      id,
      ownerId: `owner_${owner}`,
      x,
      y,
      targetX,
      targetY,
      type,
    };

    this.state.projectiles.push(projectile);
    this.projectileMetaById.set(id, { owner, damage, aoeRadius });
  }

  private updateProjectiles(deltaTime: number) {
    if (!this.state) return;

    const remaining: ProjectileState[] = [];

    for (const proj of this.state.projectiles) {
      const dist = this.distance(proj.x, proj.y, proj.targetX, proj.targetY);

      if (dist <= PROJECTILE_SPEED * deltaTime) {
        this.applyProjectileDamage(proj);
        this.projectileMetaById.delete(proj.id);
        continue;
      }

      const moved = this.moveTowards(proj.x, proj.y, proj.targetX, proj.targetY, PROJECTILE_SPEED, deltaTime);
      proj.x = moved.x;
      proj.y = moved.y;
      remaining.push(proj);
    }

    this.state.projectiles = remaining;
  }

  private applyProjectileDamage(proj: ProjectileState) {
    if (!this.state) return;

    const meta = this.projectileMetaById.get(proj.id);
    if (!meta) return;

    const enemyOwner = meta.owner === 1 ? 2 : 1;

    if (proj.type === 'aoe') {
      for (const unit of this.state.units) {
        if (unit.owner !== enemyOwner || unit.hp <= 0) continue;
        if (this.distance(proj.targetX, proj.targetY, unit.x, unit.y) <= meta.aoeRadius) {
          this.applyDamageToUnit(unit, meta.damage);
        }
      }

      const towers = enemyOwner === 1 ? this.state.player1.towers : this.state.player2.towers;
      for (const tower of towers) {
        if (tower.hp <= 0) continue;
        if (this.distance(proj.targetX, proj.targetY, tower.x, tower.y) <= meta.aoeRadius) {
          this.applyDamageToTower(tower, meta.damage);
        }
      }
      return;
    }

    for (const unit of this.state.units) {
      if (unit.owner !== enemyOwner || unit.hp <= 0) continue;
      if (this.distance(proj.targetX, proj.targetY, unit.x, unit.y) < 30) {
        this.applyDamageToUnit(unit, meta.damage);
        return;
      }
    }

    const towers = enemyOwner === 1 ? this.state.player1.towers : this.state.player2.towers;
    for (const tower of towers) {
      if (tower.hp <= 0) continue;
      if (this.distance(proj.targetX, proj.targetY, tower.x, tower.y) < 50) {
        this.applyDamageToTower(tower, meta.damage);
        return;
      }
    }
  }

  private applyDamageToUnit(unit: UnitState, damage: number) {
    const prev = unit.hp;
    unit.hp = Math.max(0, unit.hp - damage);
    if (unit.hp < prev) this.addDamageEvent(unit.id);
  }

  private applyDamageToTower(tower: TowerState, damage: number) {
    const prev = tower.hp;
    tower.hp = Math.max(0, tower.hp - damage);
    if (tower.hp < prev) {
      this.addDamageEvent(tower.id);
    }
    if (tower.hp <= 0) {
      this.deadTowerLocks.add(tower.id);
      this.towerReviveFrames.delete(tower.id);
    }
  }

  private removeDeadUnits() {
    if (!this.state) return;

    const alive = this.state.units.filter((u) => u.hp > 0);
    const aliveIds = new Set(alive.map((u) => u.id));

    for (const id of this.unitRuntimeById.keys()) {
      if (!aliveIds.has(id)) this.unitRuntimeById.delete(id);
    }
    for (const id of this.unitMissingFrames.keys()) {
      if (!aliveIds.has(id)) this.unitMissingFrames.delete(id);
    }

    this.state.units = alive;
  }

  private getUnitStats(type: string): UnitStats {
    return UNIT_STATS[type] || UNIT_STATS.melee;
  }

  private getUnitRuntime(unitId: string): UnitRuntime {
    const runtime = this.unitRuntimeById.get(unitId);
    if (runtime) return runtime;

    const created = { targetId: '', lastAttackTime: 0 };
    this.unitRuntimeById.set(unitId, created);
    return created;
  }

  private findNearestEnemyTarget(unit: UnitState): EnemyTarget | null {
    if (!this.state) return null;

    const enemyOwner = unit.owner === 1 ? 2 : 1;
    let nearest: EnemyTarget | null = null;
    let minDist = Number.MAX_VALUE;

    for (const enemy of this.state.units) {
      if (enemy.owner !== enemyOwner || enemy.hp <= 0) continue;
      const dist = this.distance(unit.x, unit.y, enemy.x, enemy.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = { id: enemy.id, x: enemy.x, y: enemy.y, type: 'unit' };
      }
    }

    const enemyTowers = enemyOwner === 1 ? this.state.player1.towers : this.state.player2.towers;
    for (const tower of enemyTowers) {
      if (tower.hp <= 0) continue;
      const dist = this.distance(unit.x, unit.y, tower.x, tower.y);
      if (dist < minDist) {
        minDist = dist;
        nearest = { id: tower.id, x: tower.x, y: tower.y, type: 'tower' };
      }
    }

    return nearest;
  }

  private findTargetById(targetId: string): { type: 'unit'; target: UnitState; x: number; y: number } | { type: 'tower'; target: TowerState; x: number; y: number } | null {
    if (!this.state) return null;

    for (const unit of this.state.units) {
      if (unit.id === targetId && unit.hp > 0) {
        return { type: 'unit', target: unit, x: unit.x, y: unit.y };
      }
    }

    for (const tower of this.state.player1.towers) {
      if (tower.id === targetId && tower.hp > 0) {
        return { type: 'tower', target: tower, x: tower.x, y: tower.y };
      }
    }

    for (const tower of this.state.player2.towers) {
      if (tower.id === targetId && tower.hp > 0) {
        return { type: 'tower', target: tower, x: tower.x, y: tower.y };
      }
    }

    return null;
  }

  private getNextWaypoint(unit: UnitState, targetX: number, targetY: number): { x: number; y: number } {
    const needsCrossRiver = this.needsToCrossRiver(unit.y, targetY);
    if (!needsCrossRiver) {
      return { x: targetX, y: targetY };
    }

    const bridgeCenterX = this.getNearestBridgeCenterX(unit.x);
    const onBridge = this.isOnBridge(unit.x, unit.y);
    const inRiver = this.isInRiver(unit.y);

    if (inRiver && onBridge) {
      return { x: bridgeCenterX, y: targetY };
    }

    if (inRiver && !onBridge) {
      return { x: bridgeCenterX, y: unit.y };
    }

    const distToBridgeX = Math.abs(unit.x - bridgeCenterX);
    if (distToBridgeX > 10) {
      return { x: bridgeCenterX, y: unit.y };
    }

    if (unit.owner === 1) {
      return { x: bridgeCenterX, y: RIVER_START_Y - 10 };
    }
    return { x: bridgeCenterX, y: RIVER_END_Y + 10 };
  }

  private applySeparation() {
    if (!this.state) return;

    const separationDist = 25;
    const separationForce = 5;

    for (let i = 0; i < this.state.units.length; i++) {
      const u1 = this.state.units[i];
      if (u1.hp <= 0 || this.getUnitStats(u1.type).isBuilding) continue;

      for (let j = 0; j < this.state.units.length; j++) {
        if (i === j) continue;

        const u2 = this.state.units[j];
        if (u2.hp <= 0 || this.getUnitStats(u2.type).isBuilding) continue;

        const dist = this.distance(u1.x, u1.y, u2.x, u2.y);
        if (dist <= 0 || dist >= separationDist) continue;

        const dx = u1.x - u2.x;
        const dy = u1.y - u2.y;
        const overlap = separationDist - dist;
        const ratio = (overlap / dist) * separationForce;

        u1.x += dx * ratio * 0.5;
        u1.y += dy * ratio * 0.5;
        u2.x -= dx * ratio * 0.5;
        u2.y -= dy * ratio * 0.5;
      }
    }

    for (const unit of this.state.units) {
      unit.x = Math.max(10, Math.min(ARENA_WIDTH - 10, unit.x));
      unit.y = Math.max(10, Math.min(ARENA_HEIGHT - 10, unit.y));
    }
  }

  private needsToCrossRiver(fromY: number, toY: number): boolean {
    if (fromY > RIVER_END_Y && toY < RIVER_START_Y) return true;
    if (fromY < RIVER_START_Y && toY > RIVER_END_Y) return true;
    return false;
  }

  private isInRiver(y: number): boolean {
    return y >= RIVER_START_Y && y <= RIVER_END_Y;
  }

  private isOnBridge(x: number, y: number): boolean {
    if (!this.isInRiver(y)) return false;
    return (x >= BRIDGE1_START_X && x <= BRIDGE1_END_X) || (x >= BRIDGE2_START_X && x <= BRIDGE2_END_X);
  }

  private getNearestBridgeCenterX(x: number): number {
    const dist1 = Math.abs(x - BRIDGE1_CENTER_X);
    const dist2 = Math.abs(x - BRIDGE2_CENTER_X);
    return dist1 < dist2 ? BRIDGE1_CENTER_X : BRIDGE2_CENTER_X;
  }

  private distance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private moveTowards(
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    speed: number,
    deltaTime: number,
  ): { x: number; y: number } {
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= speed * deltaTime) {
      return { x: targetX, y: targetY };
    }

    const ratio = (speed * deltaTime) / dist;
    return { x: x + dx * ratio, y: y + dy * ratio };
  }

  getState(): GameState | null {
    return this.state;
  }

  getElixir(playerNum: number): number {
    if (!this.state) return 0;
    return playerNum === 1 ? this.state.player1.elixir : this.state.player2.elixir;
  }

  reset() {
    this.state = null;
    this.lastUpdateTime = 0;
    this.simulationTime = 0;
    this.localTick = 0;

    this.damageEvents = [];
    this.lastDamageById.clear();
    this.unitRuntimeById.clear();
    this.towerLastAttack.clear();
    this.unitMissingFrames.clear();
    this.deadTowerLocks.clear();
    this.towerReviveFrames.clear();
    this.projectileMetaById.clear();
    this.nextProjectileId = 1;
  }
}
