package matchmaking

import (
	"log"
	"time"

	"bero-royale/internal/room"
)

type Matcher struct {
	queue       *Queue
	roomManager *room.Manager
	matchChan   chan *Match
}

func NewMatcher(roomManager *room.Manager) *Matcher {
	return &Matcher{
		queue:       NewQueue(),
		roomManager: roomManager,
		matchChan:   make(chan *Match, 100),
	}
}

func (m *Matcher) Run() {
	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for range ticker.C {
		if match := m.queue.TryMatch(); match != nil {
			log.Printf("Match found: %s vs %s", match.Player1ID, match.Player2ID)
			m.matchChan <- match
		}
	}
}

func (m *Matcher) AddToQueue(playerID string) chan *Match {
	matchChan := make(chan *Match, 1)
	player := &WaitingPlayer{
		ID:        playerID,
		JoinedAt:  time.Now(),
		MatchChan: matchChan,
	}
	m.queue.Add(player)
	log.Printf("Player %s joined queue. Queue size: %d", playerID, m.queue.Len())
	return matchChan
}

func (m *Matcher) RemoveFromQueue(playerID string) {
	m.queue.Remove(playerID)
	log.Printf("Player %s left queue", playerID)
}

func (m *Matcher) GetMatchChan() chan *Match {
	return m.matchChan
}
