package room

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"bero-royale/internal/game"
	"bero-royale/pkg/protocol"
)

const (
	TickRate       = 60
	TickDuration   = time.Second / TickRate
	ElixirPerTick  = 1.0 / float64(TickRate)
)

type Room struct {
	ID        string
	Player1ID string
	Player2ID string

	gameState *game.GameState
	
	mu       sync.RWMutex
	running  bool
	stopChan chan struct{}

	Player1Send chan []byte
	Player2Send chan []byte

	commandChan chan *PlayerCommand
}

type PlayerCommand struct {
	PlayerNum int
	Command   *protocol.ClientMessage
}

func NewRoom(id, player1ID, player2ID string) *Room {
	return &Room{
		ID:          id,
		Player1ID:   player1ID,
		Player2ID:   player2ID,
		gameState:   game.NewGameState(),
		stopChan:    make(chan struct{}),
		Player1Send: make(chan []byte, 256),
		Player2Send: make(chan []byte, 256),
		commandChan: make(chan *PlayerCommand, 100),
	}
}

func (r *Room) Start() {
	r.mu.Lock()
	if r.running {
		r.mu.Unlock()
		return
	}
	r.running = true
	r.mu.Unlock()

	go r.gameLoop()
	log.Printf("Room %s started", r.ID)
}

func (r *Room) Stop() {
	r.mu.Lock()
	if !r.running {
		r.mu.Unlock()
		return
	}
	r.running = false
	r.mu.Unlock()

	close(r.stopChan)
	log.Printf("Room %s stopped", r.ID)
}

func (r *Room) IsRunning() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.running
}

func (r *Room) HandleCommand(playerID string, cmd *protocol.ClientMessage) {
	playerNum := 0
	if playerID == r.Player1ID {
		playerNum = 1
	} else if playerID == r.Player2ID {
		playerNum = 2
	}

	if playerNum == 0 {
		return
	}

	r.commandChan <- &PlayerCommand{
		PlayerNum: playerNum,
		Command:   cmd,
	}
}

func (r *Room) gameLoop() {
	ticker := time.NewTicker(TickDuration)
	defer ticker.Stop()

	for {
		select {
		case <-r.stopChan:
			return
		case cmd := <-r.commandChan:
			r.processCommand(cmd)
		case <-ticker.C:
			r.update()
			r.broadcast()
			
			if winner := r.gameState.CheckWinner(); winner != 0 {
				r.broadcastGameOver(winner)
				r.Stop()
				return
			}
		}
	}
}

func (r *Room) processCommand(cmd *PlayerCommand) {
	if cmd.Command.Type == protocol.SpawnUnit {
		r.gameState.SpawnUnit(cmd.PlayerNum, cmd.Command.CardType, cmd.Command.X, cmd.Command.Y)
	}
}

func (r *Room) update() {
	r.gameState.Update()
}

func (r *Room) broadcast() {
	state := r.gameState.ToProtocol()
	
	msg1 := &protocol.ServerMessage{
		Type:      protocol.GameStateUpdate,
		GameState: state,
	}
	msg2 := &protocol.ServerMessage{
		Type:      protocol.GameStateUpdate,
		GameState: state,
	}

	if data, err := encodeMessage(msg1); err == nil {
		select {
		case r.Player1Send <- data:
		default:
		}
	}
	if data, err := encodeMessage(msg2); err == nil {
		select {
		case r.Player2Send <- data:
		default:
		}
	}
}

func (r *Room) broadcastGameOver(winner int) {
	reason := "king_tower_destroyed"
	
	msg := &protocol.ServerMessage{
		Type:   protocol.GameOver,
		Winner: winner,
		Reason: reason,
	}

	if data, err := encodeMessage(msg); err == nil {
		select {
		case r.Player1Send <- data:
		default:
		}
		select {
		case r.Player2Send <- data:
		default:
		}
	}
}

func encodeMessage(msg *protocol.ServerMessage) ([]byte, error) {
	return json.Marshal(msg)
}
