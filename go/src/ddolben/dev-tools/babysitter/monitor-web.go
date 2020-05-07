package main

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func handleWs(router *MessageRouter) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
				log.Println(err)
				return
		}

		log.Printf("opened websocket from %s", r.RemoteAddr)

		closeCh := make(chan struct{})
		go func() {
			for {
				_, _, err := conn.ReadMessage()
				if err != nil {
					log.Printf("ERROR: connection error %s", err.Error())
					conn.Close()
					close(closeCh)
					return
				}
			}
		}()

		go func() {
			ch := router.OnSignal()
			for {
				select {
				case sig := <- ch:
					bs, err := json.Marshal(sig)
					if err != nil {
						log.Printf("ERROR: marshal error %s", err.Error())
						return
					}
					if err := conn.WriteMessage(websocket.TextMessage, bs); err != nil {
						log.Printf("ERROR: send error %s", err.Error())
						conn.Close()
						return
					}
				case <- closeCh:
					log.Printf("closing websocket connection routines for %s", r.RemoteAddr)
					return
				}
			}
		}()
	}
}

func registerHandlers(router *MessageRouter) {
	http.HandleFunc("/api/babysitter/ws", handleWs(router))
}
