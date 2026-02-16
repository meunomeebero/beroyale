package game

import (
	"github.com/google/uuid"
)

const (
	ProjectileSpeed = 400.0
)

type ProjectileType string

const (
	ProjectileTower  ProjectileType = "tower"
	ProjectileRanged ProjectileType = "ranged"
	ProjectileAoE    ProjectileType = "aoe"
)

type Projectile struct {
	ID        string
	OwnerID   string
	TargetID  string
	X         float64
	Y         float64
	TargetX   float64
	TargetY   float64
	Type      ProjectileType
	Damage    int
	AoERadius float64
	Owner     int
}

func NewProjectile(ownerID string, owner int, x, y, targetX, targetY float64, projType ProjectileType, damage int, aoeRadius float64) *Projectile {
	return &Projectile{
		ID:        uuid.New().String(),
		OwnerID:   ownerID,
		Owner:     owner,
		X:         x,
		Y:         y,
		TargetX:   targetX,
		TargetY:   targetY,
		Type:      projType,
		Damage:    damage,
		AoERadius: aoeRadius,
	}
}

func (p *Projectile) Update(deltaTime float64) bool {
	dx := p.TargetX - p.X
	dy := p.TargetY - p.Y
	dist := Distance(p.X, p.Y, p.TargetX, p.TargetY)

	if dist <= ProjectileSpeed*deltaTime {
		p.X = p.TargetX
		p.Y = p.TargetY
		return true
	}

	ratio := (ProjectileSpeed * deltaTime) / dist
	p.X += dx * ratio
	p.Y += dy * ratio
	return false
}

func (p *Projectile) HasReachedTarget() bool {
	return Distance(p.X, p.Y, p.TargetX, p.TargetY) < 5
}
