package game

import "math"

const (
	ArenaWidth  = 800
	ArenaHeight = 1000

	RiverY       = 500
	RiverStartY  = 480
	RiverEndY    = 520
	RiverHeight  = 40

	Bridge1StartX = 120
	Bridge1EndX   = 240
	Bridge1CenterX = 180

	Bridge2StartX = 560
	Bridge2EndX   = 680
	Bridge2CenterX = 620
)

type Arena struct {
	Width  float64
	Height float64
}

func NewArena() *Arena {
	return &Arena{
		Width:  ArenaWidth,
		Height: ArenaHeight,
	}
}

func (a *Arena) IsValidSpawnPosition(playerNum int, x, y float64) bool {
	if x < 0 || x > a.Width || y < 0 || y > a.Height {
		return false
	}

	if playerNum == 1 {
		return y > RiverEndY
	}
	return y < RiverStartY
}

func (a *Arena) IsInRiver(x, y float64) bool {
	return y >= RiverStartY && y <= RiverEndY
}

func (a *Arena) IsOnBridge(x, y float64) bool {
	if !a.IsInRiver(x, y) {
		return false
	}
	return (x >= Bridge1StartX && x <= Bridge1EndX) || (x >= Bridge2StartX && x <= Bridge2EndX)
}

func (a *Arena) GetNearestBridgeCenterX(x float64) float64 {
	distToBridge1 := math.Abs(x - Bridge1CenterX)
	distToBridge2 := math.Abs(x - Bridge2CenterX)

	if distToBridge1 < distToBridge2 {
		return Bridge1CenterX
	}
	return Bridge2CenterX
}

func (a *Arena) NeedsToCrossRiver(fromY, toY float64) bool {
	if fromY > RiverEndY && toY < RiverStartY {
		return true
	}
	if fromY < RiverStartY && toY > RiverEndY {
		return true
	}
	return false
}

func (a *Arena) CanPassThrough(x, y float64) bool {
	if a.IsInRiver(x, y) {
		return a.IsOnBridge(x, y)
	}
	return true
}
