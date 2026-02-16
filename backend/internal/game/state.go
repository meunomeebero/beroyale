package game

import (
	"bero-royale/pkg/protocol"
)

const (
	MaxElixir       = 10.0
	ElixirRegenRate = 1.0
	StartingElixir  = 5.0
	TicksPerSecond  = 60
)

type GameState struct {
	Tick          int
	GameTime      float64

	Player1Elixir float64
	Player2Elixir float64

	Player1Towers []*Tower
	Player2Towers []*Tower

	Units       []*Unit
	Projectiles []*Projectile

	arena *Arena
}

func NewGameState() *GameState {
	gs := &GameState{
		Tick:          0,
		GameTime:      0,
		Player1Elixir: StartingElixir,
		Player2Elixir: StartingElixir,
		Units:         make([]*Unit, 0),
		Projectiles:   make([]*Projectile, 0),
		arena:         NewArena(),
	}

	gs.initTowers()
	return gs
}

func (gs *GameState) initTowers() {
	gs.Player1Towers = []*Tower{
		NewLateralTower("p1_left", 1, 180, 860),
		NewLateralTower("p1_right", 1, 620, 860),
		NewKingTower("p1_king", 1, 400, 940),
	}

	gs.Player2Towers = []*Tower{
		NewLateralTower("p2_left", 2, 180, 140),
		NewLateralTower("p2_right", 2, 620, 140),
		NewKingTower("p2_king", 2, 400, 60),
	}
}

func (gs *GameState) Update() {
	gs.Tick++
	deltaTime := 1.0 / float64(TicksPerSecond)
	gs.GameTime += deltaTime

	gs.updateElixir(deltaTime)
	gs.UpdateMovement(deltaTime)
	gs.ApplySeparation()
	gs.ProcessCombat()
	gs.UpdateProjectiles(deltaTime)
	gs.RemoveDeadUnits()
}

func (gs *GameState) updateElixir(deltaTime float64) {
	gs.Player1Elixir += ElixirRegenRate * deltaTime
	if gs.Player1Elixir > MaxElixir {
		gs.Player1Elixir = MaxElixir
	}

	gs.Player2Elixir += ElixirRegenRate * deltaTime
	if gs.Player2Elixir > MaxElixir {
		gs.Player2Elixir = MaxElixir
	}
}

func (gs *GameState) SpawnUnit(playerNum int, cardType string, x, y float64) bool {
	ct := CardType(cardType)
	stats := GetCardStats(ct)

	elixir := gs.Player1Elixir
	if playerNum == 2 {
		elixir = gs.Player2Elixir
	}

	if float64(stats.ElixirCost) > elixir {
		return false
	}

	if !gs.arena.IsValidSpawnPosition(playerNum, x, y) {
		return false
	}

	unit := NewUnit(ct, playerNum, x, y)
	gs.Units = append(gs.Units, unit)

	if playerNum == 1 {
		gs.Player1Elixir -= float64(stats.ElixirCost)
	} else {
		gs.Player2Elixir -= float64(stats.ElixirCost)
	}

	return true
}

func (gs *GameState) AddProjectile(ownerID string, owner int, x, y, targetX, targetY float64, projType ProjectileType, damage int, aoeRadius float64) {
	proj := NewProjectile(ownerID, owner, x, y, targetX, targetY, projType, damage, aoeRadius)
	gs.Projectiles = append(gs.Projectiles, proj)
}

func (gs *GameState) UpdateProjectiles(deltaTime float64) {
	remaining := make([]*Projectile, 0, len(gs.Projectiles))

	for _, proj := range gs.Projectiles {
		reached := proj.Update(deltaTime)

		if reached {
			gs.applyProjectileDamage(proj)
		} else {
			remaining = append(remaining, proj)
		}
	}

	gs.Projectiles = remaining
}

func (gs *GameState) applyProjectileDamage(proj *Projectile) {
	if proj.Type == ProjectileAoE {
		gs.applyAoEDamage(proj)
		return
	}

	enemyPlayer := 1
	if proj.Owner == 1 {
		enemyPlayer = 2
	}

	for _, unit := range gs.Units {
		if unit.Owner == enemyPlayer && unit.IsAlive() {
			dist := Distance(proj.TargetX, proj.TargetY, unit.X, unit.Y)
			if dist < 30 {
				unit.TakeDamage(proj.Damage)
				return
			}
		}
	}

	towers := gs.Player1Towers
	if enemyPlayer == 2 {
		towers = gs.Player2Towers
	}

	for _, tower := range towers {
		if tower.IsAlive() {
			dist := Distance(proj.TargetX, proj.TargetY, tower.X, tower.Y)
			if dist < 50 {
				tower.TakeDamage(proj.Damage)
				return
			}
		}
	}
}

func (gs *GameState) applyAoEDamage(proj *Projectile) {
	enemyPlayer := 1
	if proj.Owner == 1 {
		enemyPlayer = 2
	}

	for _, unit := range gs.Units {
		if unit.Owner == enemyPlayer && unit.IsAlive() {
			dist := Distance(proj.TargetX, proj.TargetY, unit.X, unit.Y)
			if dist <= proj.AoERadius {
				unit.TakeDamage(proj.Damage)
			}
		}
	}

	towers := gs.Player1Towers
	if enemyPlayer == 2 {
		towers = gs.Player2Towers
	}

	for _, tower := range towers {
		if tower.IsAlive() {
			dist := Distance(proj.TargetX, proj.TargetY, tower.X, tower.Y)
			if dist <= proj.AoERadius {
				tower.TakeDamage(proj.Damage)
			}
		}
	}
}

func (gs *GameState) CheckWinner() int {
	for _, tower := range gs.Player1Towers {
		if tower.Type == TowerTypeKing && !tower.IsAlive() {
			return 2
		}
	}

	for _, tower := range gs.Player2Towers {
		if tower.Type == TowerTypeKing && !tower.IsAlive() {
			return 1
		}
	}

	return 0
}

func (gs *GameState) ToProtocol() *protocol.GameState {
	p1Towers := make([]*protocol.TowerState, len(gs.Player1Towers))
	for i, t := range gs.Player1Towers {
		p1Towers[i] = &protocol.TowerState{
			ID:    t.ID,
			HP:    t.HP,
			MaxHP: t.MaxHP,
			X:     t.X,
			Y:     t.Y,
			Type:  string(t.Type),
		}
	}

	p2Towers := make([]*protocol.TowerState, len(gs.Player2Towers))
	for i, t := range gs.Player2Towers {
		p2Towers[i] = &protocol.TowerState{
			ID:    t.ID,
			HP:    t.HP,
			MaxHP: t.MaxHP,
			X:     t.X,
			Y:     t.Y,
			Type:  string(t.Type),
		}
	}

	units := make([]*protocol.UnitState, len(gs.Units))
	for i, u := range gs.Units {
		units[i] = &protocol.UnitState{
			ID:    u.ID,
			Type:  string(u.CardType),
			Owner: u.Owner,
			HP:    u.HP,
			MaxHP: u.MaxHP,
			X:     u.X,
			Y:     u.Y,
		}
	}

	projectiles := make([]*protocol.ProjectileState, len(gs.Projectiles))
	for i, p := range gs.Projectiles {
		projectiles[i] = &protocol.ProjectileState{
			ID:      p.ID,
			OwnerID: p.OwnerID,
			X:       p.X,
			Y:       p.Y,
			TargetX: p.TargetX,
			TargetY: p.TargetY,
			Type:    string(p.Type),
		}
	}

	return &protocol.GameState{
		Tick: gs.Tick,
		Player1: &protocol.PlayerState{
			Elixir: gs.Player1Elixir,
			Towers: p1Towers,
		},
		Player2: &protocol.PlayerState{
			Elixir: gs.Player2Elixir,
			Towers: p2Towers,
		},
		Units:       units,
		Projectiles: projectiles,
	}
}
