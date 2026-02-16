package game

type TowerType string

const (
	TowerTypeLateral TowerType = "lateral"
	TowerTypeKing    TowerType = "king"
)

type Tower struct {
	ID          string
	Type        TowerType
	Owner       int
	X           float64
	Y           float64
	HP          int
	MaxHP       int
	Damage      int
	Range       float64
	AttackSpeed float64
	LastAttack  float64
	Size        float64
}

func NewLateralTower(id string, owner int, x, y float64) *Tower {
	return &Tower{
		ID:          id,
		Type:        TowerTypeLateral,
		Owner:       owner,
		X:           x,
		Y:           y,
		HP:          1500,
		MaxHP:       1500,
		Damage:      100,
		Range:       300,
		AttackSpeed: 1.0,
		LastAttack:  0,
		Size:        40,
	}
}

func NewKingTower(id string, owner int, x, y float64) *Tower {
	return &Tower{
		ID:          id,
		Type:        TowerTypeKing,
		Owner:       owner,
		X:           x,
		Y:           y,
		HP:          3000,
		MaxHP:       3000,
		Damage:      150,
		Range:       350,
		AttackSpeed: 1.0,
		LastAttack:  0,
		Size:        60,
	}
}

func (t *Tower) IsAlive() bool {
	return t.HP > 0
}

func (t *Tower) TakeDamage(damage int) {
	t.HP -= damage
	if t.HP < 0 {
		t.HP = 0
	}
}

func (t *Tower) CanAttack(currentTime float64) bool {
	return currentTime-t.LastAttack >= t.AttackSpeed
}

func (t *Tower) Attack(currentTime float64) int {
	t.LastAttack = currentTime
	return t.Damage
}
