package game

type CardType string

const (
	CardTypeMelee        CardType = "melee"
	CardTypeRanged       CardType = "ranged"
	CardTypeAoE          CardType = "aoe"
	CardTypeSingleTarget CardType = "single"
	CardTypeDefense      CardType = "defense"
)

type CardStats struct {
	Type        CardType
	HP          int
	Damage      int
	MoveSpeed   float64
	Range       float64
	AttackSpeed float64
	ElixirCost  int
	AoERadius   float64
	IsBuilding  bool
	Color       string
}

var CardDefinitions = map[CardType]*CardStats{
	CardTypeMelee: {
		Type:        CardTypeMelee,
		HP:          500,
		Damage:      80,
		MoveSpeed:   60,
		Range:       30,
		AttackSpeed: 1.0,
		ElixirCost:  3,
		Color:       "#e74c3c",
	},
	CardTypeRanged: {
		Type:        CardTypeRanged,
		HP:          200,
		Damage:      60,
		MoveSpeed:   40,
		Range:       250,
		AttackSpeed: 1.2,
		ElixirCost:  3,
		Color:       "#3498db",
	},
	CardTypeAoE: {
		Type:        CardTypeAoE,
		HP:          350,
		Damage:      50,
		MoveSpeed:   50,
		Range:       150,
		AttackSpeed: 1.5,
		ElixirCost:  4,
		AoERadius:   80,
		Color:       "#9b59b6",
	},
	CardTypeSingleTarget: {
		Type:        CardTypeSingleTarget,
		HP:          150,
		Damage:      200,
		MoveSpeed:   70,
		Range:       200,
		AttackSpeed: 2.0,
		ElixirCost:  5,
		Color:       "#f1c40f",
	},
	CardTypeDefense: {
		Type:        CardTypeDefense,
		HP:          800,
		Damage:      100,
		MoveSpeed:   0,
		Range:       300,
		AttackSpeed: 1.0,
		ElixirCost:  4,
		IsBuilding:  true,
		Color:       "#2ecc71",
	},
}

func GetCardStats(cardType CardType) *CardStats {
	if stats, ok := CardDefinitions[cardType]; ok {
		return stats
	}
	return CardDefinitions[CardTypeMelee]
}
