package game

import (
	"github.com/google/uuid"
)

type Unit struct {
	ID          string
	CardType    CardType
	Owner       int
	X           float64
	Y           float64
	HP          int
	MaxHP       int
	Damage      int
	MoveSpeed   float64
	Range       float64
	AttackSpeed float64
	LastAttack  float64
	AoERadius   float64
	IsBuilding  bool
	TargetID    string
	Size        float64
}

func NewUnit(cardType CardType, owner int, x, y float64) *Unit {
	stats := GetCardStats(cardType)
	return &Unit{
		ID:          uuid.New().String(),
		CardType:    cardType,
		Owner:       owner,
		X:           x,
		Y:           y,
		HP:          stats.HP,
		MaxHP:       stats.HP,
		Damage:      stats.Damage,
		MoveSpeed:   stats.MoveSpeed,
		Range:       stats.Range,
		AttackSpeed: stats.AttackSpeed,
		LastAttack:  0,
		AoERadius:   stats.AoERadius,
		IsBuilding:  stats.IsBuilding,
		Size:        20,
	}
}

func (u *Unit) IsAlive() bool {
	return u.HP > 0
}

func (u *Unit) TakeDamage(damage int) {
	u.HP -= damage
	if u.HP < 0 {
		u.HP = 0
	}
}

func (u *Unit) CanAttack(currentTime float64) bool {
	return currentTime-u.LastAttack >= u.AttackSpeed
}

func (u *Unit) Attack(currentTime float64) int {
	u.LastAttack = currentTime
	return u.Damage
}

func (u *Unit) CanMove() bool {
	return !u.IsBuilding && u.MoveSpeed > 0
}
