package game

func (gs *GameState) ProcessCombat() {
	gs.processUnitCombat()
	gs.processTowerCombat()
}

func (gs *GameState) processUnitCombat() {
	for _, unit := range gs.Units {
		if !unit.IsAlive() || !unit.CanAttack(gs.GameTime) {
			continue
		}

		if unit.TargetID == "" {
			continue
		}

		if unit.CardType == CardTypeAoE {
			gs.processAoEAttack(unit)
		} else if unit.CardType == CardTypeRanged || unit.CardType == CardTypeSingleTarget {
			gs.processRangedAttack(unit)
		} else {
			gs.processMeleeAttack(unit)
		}
	}
}

func (gs *GameState) processMeleeAttack(unit *Unit) {
	for _, enemy := range gs.Units {
		if enemy.ID == unit.TargetID && enemy.IsAlive() {
			dist := Distance(unit.X, unit.Y, enemy.X, enemy.Y)
			if dist <= unit.Range {
				damage := unit.Attack(gs.GameTime)
				enemy.TakeDamage(damage)
			}
			return
		}
	}

	towers := gs.Player1Towers
	if unit.Owner == 1 {
		towers = gs.Player2Towers
	}

	for _, tower := range towers {
		if tower.ID == unit.TargetID && tower.IsAlive() {
			dist := Distance(unit.X, unit.Y, tower.X, tower.Y)
			if dist <= unit.Range {
				damage := unit.Attack(gs.GameTime)
				tower.TakeDamage(damage)
			}
			return
		}
	}
}

func (gs *GameState) processRangedAttack(unit *Unit) {
	var targetX, targetY float64
	found := false

	for _, enemy := range gs.Units {
		if enemy.ID == unit.TargetID && enemy.IsAlive() {
			targetX = enemy.X
			targetY = enemy.Y
			found = true
			break
		}
	}

	if !found {
		towers := gs.Player1Towers
		if unit.Owner == 1 {
			towers = gs.Player2Towers
		}

		for _, tower := range towers {
			if tower.ID == unit.TargetID && tower.IsAlive() {
				targetX = tower.X
				targetY = tower.Y
				found = true
				break
			}
		}
	}

	if !found {
		return
	}

	dist := Distance(unit.X, unit.Y, targetX, targetY)
	if dist > unit.Range {
		return
	}

	damage := unit.Attack(gs.GameTime)
	gs.AddProjectile(unit.ID, unit.Owner, unit.X, unit.Y, targetX, targetY, ProjectileRanged, damage, 0)
}

func (gs *GameState) processAoEAttack(unit *Unit) {
	var targetX, targetY float64

	for _, enemy := range gs.Units {
		if enemy.ID == unit.TargetID {
			targetX = enemy.X
			targetY = enemy.Y
			break
		}
	}

	if targetX == 0 && targetY == 0 {
		targetX, targetY, _, _ = gs.FindNearestEnemy(unit)
	}

	dist := Distance(unit.X, unit.Y, targetX, targetY)
	if dist > unit.Range {
		return
	}

	damage := unit.Attack(gs.GameTime)
	gs.AddProjectile(unit.ID, unit.Owner, unit.X, unit.Y, targetX, targetY, ProjectileAoE, damage, unit.AoERadius)
}

func (gs *GameState) processTowerCombat() {
	gs.processTowersForPlayer(gs.Player1Towers)
	gs.processTowersForPlayer(gs.Player2Towers)
}

func (gs *GameState) processTowersForPlayer(towers []*Tower) {
	kingCanAttack := false
	for _, t := range towers {
		if t.Type == TowerTypeLateral && !t.IsAlive() {
			kingCanAttack = true
			break
		}
	}

	for _, tower := range towers {
		if !tower.IsAlive() || !tower.CanAttack(gs.GameTime) {
			continue
		}

		if tower.Type == TowerTypeKing && !kingCanAttack {
			continue
		}

		target := gs.FindNearestEnemyUnit(tower)
		if target != nil {
			damage := tower.Attack(gs.GameTime)
			gs.AddProjectile(tower.ID, tower.Owner, tower.X, tower.Y, target.X, target.Y, ProjectileTower, damage, 0)
		}
	}
}

func (gs *GameState) RemoveDeadUnits() {
	alive := make([]*Unit, 0, len(gs.Units))
	for _, unit := range gs.Units {
		if unit.IsAlive() {
			alive = append(alive, unit)
		}
	}
	gs.Units = alive
}
