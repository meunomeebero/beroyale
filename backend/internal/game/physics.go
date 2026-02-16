package game

import "math"

func Distance(x1, y1, x2, y2 float64) float64 {
	dx := x2 - x1
	dy := y2 - y1
	return math.Sqrt(dx*dx + dy*dy)
}

func MoveTowards(x, y, targetX, targetY, speed, deltaTime float64) (float64, float64) {
	dx := targetX - x
	dy := targetY - y
	dist := math.Sqrt(dx*dx + dy*dy)

	if dist <= speed*deltaTime {
		return targetX, targetY
	}

	ratio := (speed * deltaTime) / dist
	return x + dx*ratio, y + dy*ratio
}

func (gs *GameState) FindNearestEnemy(unit *Unit) (targetX, targetY float64, targetID string, targetType string) {
	minDist := math.MaxFloat64

	enemyPlayer := 1
	if unit.Owner == 1 {
		enemyPlayer = 2
	}

	for _, enemy := range gs.Units {
		if enemy.Owner == enemyPlayer && enemy.IsAlive() {
			dist := Distance(unit.X, unit.Y, enemy.X, enemy.Y)
			if dist < minDist {
				minDist = dist
				targetX = enemy.X
				targetY = enemy.Y
				targetID = enemy.ID
				targetType = "unit"
			}
		}
	}

	towers := gs.Player1Towers
	if enemyPlayer == 2 {
		towers = gs.Player2Towers
	}

	for _, tower := range towers {
		if tower.IsAlive() {
			dist := Distance(unit.X, unit.Y, tower.X, tower.Y)
			if dist < minDist {
				minDist = dist
				targetX = tower.X
				targetY = tower.Y
				targetID = tower.ID
				targetType = "tower"
			}
		}
	}

	return
}

func (gs *GameState) FindNearestEnemyUnit(tower *Tower) *Unit {
	minDist := math.MaxFloat64
	var nearest *Unit

	enemyPlayer := 1
	if tower.Owner == 1 {
		enemyPlayer = 2
	}

	for _, unit := range gs.Units {
		if unit.Owner == enemyPlayer && unit.IsAlive() {
			dist := Distance(tower.X, tower.Y, unit.X, unit.Y)
			if dist < minDist && dist <= tower.Range {
				minDist = dist
				nearest = unit
			}
		}
	}

	return nearest
}

func (gs *GameState) getNextWaypoint(unit *Unit, targetX, targetY float64) (float64, float64) {
	if !gs.arena.NeedsToCrossRiver(unit.Y, targetY) {
		return targetX, targetY
	}

	bridgeCenterX := gs.arena.GetNearestBridgeCenterX(unit.X)

	unitInRiver := gs.arena.IsInRiver(unit.X, unit.Y)
	unitOnBridge := gs.arena.IsOnBridge(unit.X, unit.Y)

	if unitInRiver && unitOnBridge {
		return bridgeCenterX, targetY
	}

	if unitInRiver && !unitOnBridge {
		return bridgeCenterX, unit.Y
	}

	distToBridgeX := math.Abs(unit.X - bridgeCenterX)
	if distToBridgeX > 10 {
		return bridgeCenterX, unit.Y
	}

	if unit.Owner == 1 {
		return bridgeCenterX, RiverStartY - 10
	}
	return bridgeCenterX, RiverEndY + 10
}

func (gs *GameState) UpdateMovement(deltaTime float64) {
	for _, unit := range gs.Units {
		if !unit.IsAlive() || !unit.CanMove() {
			continue
		}

		targetX, targetY, targetID, _ := gs.FindNearestEnemy(unit)
		if targetID == "" {
			continue
		}

		dist := Distance(unit.X, unit.Y, targetX, targetY)
		if dist > unit.Range {
			waypointX, waypointY := gs.getNextWaypoint(unit, targetX, targetY)
			unit.X, unit.Y = MoveTowards(unit.X, unit.Y, waypointX, waypointY, unit.MoveSpeed, deltaTime)
		}
		unit.TargetID = targetID
	}
}

func (gs *GameState) ApplySeparation() {
	const separationDist = 25.0
	const separationForce = 5.0

	for i, u1 := range gs.Units {
		if !u1.IsAlive() || u1.IsBuilding {
			continue
		}

		for j, u2 := range gs.Units {
			if i == j || !u2.IsAlive() || u2.IsBuilding {
				continue
			}

			dist := Distance(u1.X, u1.Y, u2.X, u2.Y)
			if dist < separationDist && dist > 0 {
				dx := u1.X - u2.X
				dy := u1.Y - u2.Y
				overlap := separationDist - dist
				ratio := overlap / dist * separationForce

				u1.X += dx * ratio * 0.5
				u1.Y += dy * ratio * 0.5
				u2.X -= dx * ratio * 0.5
				u2.Y -= dy * ratio * 0.5
			}
		}
	}

	for _, unit := range gs.Units {
		if unit.X < 10 {
			unit.X = 10
		}
		if unit.X > ArenaWidth-10 {
			unit.X = ArenaWidth - 10
		}
		if unit.Y < 10 {
			unit.Y = 10
		}
		if unit.Y > ArenaHeight-10 {
			unit.Y = ArenaHeight - 10
		}
	}
}
