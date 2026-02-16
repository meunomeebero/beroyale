package main

import (
	"log"
	"net/http"

	"bero-royale/internal/matchmaking"
	"bero-royale/internal/room"
	"bero-royale/internal/websocket"
)

func main() {
	roomManager := room.NewManager()
	matchmaker := matchmaking.NewMatcher(roomManager)
	hub := websocket.NewHub(matchmaker, roomManager)

	go hub.Run()
	go matchmaker.Run()

	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w)
		websocket.ServeWs(hub, w, r)
	})

	http.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		enableCORS(w)
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	log.Println("Server starting on :8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal("ListenAndServe: ", err)
	}
}

func enableCORS(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}
