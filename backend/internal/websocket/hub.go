package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"bero-royale/internal/matchmaking"
	"bero-royale/internal/room"
	"bero-royale/pkg/protocol"
)

type Hub struct {
	clients     map[string]*Client
	register    chan *Client
	unregister  chan *Client
	mu          sync.RWMutex
	
	matchmaker  *matchmaking.Matcher
	roomManager *room.Manager
	
	playerMatches map[string]chan *matchmaking.Match
}

func NewHub(matchmaker *matchmaking.Matcher, roomManager *room.Manager) *Hub {
	return &Hub{
		clients:       make(map[string]*Client),
		register:      make(chan *Client),
		unregister:    make(chan *Client),
		matchmaker:    matchmaker,
		roomManager:   roomManager,
		playerMatches: make(map[string]chan *matchmaking.Match),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("Client registered: %s", client.ID)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				close(client.send)
				
				if client.RoomID != "" {
					h.roomManager.RemoveRoom(client.RoomID)
				}
				
				h.matchmaker.RemoveFromQueue(client.ID)
			}
			h.mu.Unlock()
			log.Printf("Client unregistered: %s", client.ID)
		}
	}
}

func (h *Hub) GetClient(id string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.clients[id]
}

func (h *Hub) HandleMessage(client *Client, msg *protocol.ClientMessage) {
	switch msg.Type {
	case protocol.JoinQueue:
		h.handleJoinQueue(client)
	case protocol.LeaveQueue:
		h.handleLeaveQueue(client)
	case protocol.SpawnUnit:
		h.handleSpawnUnit(client, msg)
	}
}

func (h *Hub) handleJoinQueue(client *Client) {
	matchChan := h.matchmaker.AddToQueue(client.ID)
	
	h.mu.Lock()
	h.playerMatches[client.ID] = matchChan
	h.mu.Unlock()
	
	go func() {
		match := <-matchChan
		if match == nil {
			return
		}
		
		h.mu.RLock()
		player1 := h.clients[match.Player1ID]
		player2 := h.clients[match.Player2ID]
		h.mu.RUnlock()
		
		if player1 == nil || player2 == nil {
			return
		}
		
		gameRoom := h.roomManager.CreateRoom(match.Player1ID, match.Player2ID)
		
		player1.SetRoomID(gameRoom.ID)
		player2.SetRoomID(gameRoom.ID)
		
		go h.forwardRoomMessages(gameRoom, player1, player2)
		
		msg1 := &protocol.ServerMessage{
			Type:      protocol.MatchFound,
			RoomID:    gameRoom.ID,
			PlayerNum: 1,
		}
		msg2 := &protocol.ServerMessage{
			Type:      protocol.MatchFound,
			RoomID:    gameRoom.ID,
			PlayerNum: 2,
		}
		
		player1.Send(msg1)
		player2.Send(msg2)
		
		gameRoom.Start()
	}()
}

func (h *Hub) forwardRoomMessages(gameRoom *room.Room, player1, player2 *Client) {
	go func() {
		for data := range gameRoom.Player1Send {
			select {
			case player1.send <- data:
			default:
			}
		}
	}()
	
	go func() {
		for data := range gameRoom.Player2Send {
			select {
			case player2.send <- data:
			default:
			}
		}
	}()
}

func (h *Hub) handleLeaveQueue(client *Client) {
	h.matchmaker.RemoveFromQueue(client.ID)
	
	h.mu.Lock()
	if ch, ok := h.playerMatches[client.ID]; ok {
		close(ch)
		delete(h.playerMatches, client.ID)
	}
	h.mu.Unlock()
}

func (h *Hub) handleSpawnUnit(client *Client, msg *protocol.ClientMessage) {
	roomID := client.GetRoomID()
	if roomID == "" {
		return
	}
	
	gameRoom := h.roomManager.GetRoom(roomID)
	if gameRoom == nil {
		return
	}
	
	gameRoom.HandleCommand(client.ID, msg)
}

func encodeMessage(msg *protocol.ServerMessage) ([]byte, error) {
	return json.Marshal(msg)
}
