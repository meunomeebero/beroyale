package room

import (
	"log"
	"sync"

	"github.com/google/uuid"
)

type Manager struct {
	mu    sync.RWMutex
	rooms map[string]*Room
}

func NewManager() *Manager {
	return &Manager{
		rooms: make(map[string]*Room),
	}
}

func (m *Manager) CreateRoom(player1ID, player2ID string) *Room {
	m.mu.Lock()
	defer m.mu.Unlock()

	roomID := uuid.New().String()
	room := NewRoom(roomID, player1ID, player2ID)
	m.rooms[roomID] = room

	log.Printf("Room created: %s with players %s and %s", roomID, player1ID, player2ID)
	return room
}

func (m *Manager) GetRoom(roomID string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.rooms[roomID]
}

func (m *Manager) GetRoomByPlayer(playerID string) *Room {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, room := range m.rooms {
		if room.Player1ID == playerID || room.Player2ID == playerID {
			return room
		}
	}
	return nil
}

func (m *Manager) RemoveRoom(roomID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if room, exists := m.rooms[roomID]; exists {
		room.Stop()
		delete(m.rooms, roomID)
		log.Printf("Room removed: %s", roomID)
	}
}
