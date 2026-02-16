package matchmaking

import (
	"sync"
	"time"
)

type WaitingPlayer struct {
	ID        string
	JoinedAt  time.Time
	MatchChan chan *Match
}

type Match struct {
	Player1ID string
	Player2ID string
}

type Queue struct {
	mu      sync.Mutex
	players []*WaitingPlayer
}

func NewQueue() *Queue {
	return &Queue{
		players: make([]*WaitingPlayer, 0),
	}
}

func (q *Queue) Add(player *WaitingPlayer) {
	q.mu.Lock()
	defer q.mu.Unlock()
	q.players = append(q.players, player)
}

func (q *Queue) Remove(playerID string) {
	q.mu.Lock()
	defer q.mu.Unlock()
	for i, p := range q.players {
		if p.ID == playerID {
			q.players = append(q.players[:i], q.players[i+1:]...)
			return
		}
	}
}

func (q *Queue) TryMatch() *Match {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.players) < 2 {
		return nil
	}

	p1 := q.players[0]
	p2 := q.players[1]
	q.players = q.players[2:]

	match := &Match{
		Player1ID: p1.ID,
		Player2ID: p2.ID,
	}

	p1.MatchChan <- match
	p2.MatchChan <- match

	return match
}

func (q *Queue) Len() int {
	q.mu.Lock()
	defer q.mu.Unlock()
	return len(q.players)
}
