package protocol

type MessageType string

const (
	JoinQueue       MessageType = "JOIN_QUEUE"
	LeaveQueue      MessageType = "LEAVE_QUEUE"
	MatchFound      MessageType = "MATCH_FOUND"
	GameStart       MessageType = "GAME_START"
	SpawnUnit       MessageType = "SPAWN_UNIT"
	GameStateUpdate MessageType = "GAME_STATE"
	GameOver        MessageType = "GAME_OVER"
	Error           MessageType = "ERROR"
)

type ClientMessage struct {
	Type     MessageType `json:"type"`
	CardType string      `json:"cardType,omitempty"`
	X        float64     `json:"x,omitempty"`
	Y        float64     `json:"y,omitempty"`
}

type ServerMessage struct {
	Type       MessageType `json:"type"`
	RoomID     string      `json:"roomId,omitempty"`
	PlayerNum  int         `json:"playerNum,omitempty"`
	OpponentID string      `json:"opponentId,omitempty"`
	GameState  *GameState  `json:"gameState,omitempty"`
	Winner     int         `json:"winner,omitempty"`
	Reason     string      `json:"reason,omitempty"`
	Error      string      `json:"error,omitempty"`
}

type GameState struct {
	Tick        int                `json:"tick"`
	Player1     *PlayerState       `json:"player1"`
	Player2     *PlayerState       `json:"player2"`
	Units       []*UnitState       `json:"units"`
	Projectiles []*ProjectileState `json:"projectiles"`
}

type PlayerState struct {
	Elixir float64       `json:"elixir"`
	Towers []*TowerState `json:"towers"`
}

type TowerState struct {
	ID    string  `json:"id"`
	HP    int     `json:"hp"`
	MaxHP int     `json:"maxHp"`
	X     float64 `json:"x"`
	Y     float64 `json:"y"`
	Type  string  `json:"type"`
}

type UnitState struct {
	ID       string  `json:"id"`
	Type     string  `json:"type"`
	Owner    int     `json:"owner"`
	HP       int     `json:"hp"`
	MaxHP    int     `json:"maxHp"`
	X        float64 `json:"x"`
	Y        float64 `json:"y"`
}

type ProjectileState struct {
	ID      string  `json:"id"`
	OwnerID string  `json:"ownerId"`
	X       float64 `json:"x"`
	Y       float64 `json:"y"`
	TargetX float64 `json:"targetX"`
	TargetY float64 `json:"targetY"`
	Type    string  `json:"type"`
}
