package main

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

type ErrConnectionDead error

func sendJson(conn *websocket.Conn, msg interface{}) error {
	bs, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ERROR: marshal error %s", err.Error())
		return err
	}
	if err := conn.WriteMessage(websocket.TextMessage, bs); err != nil {
		log.Printf("ERROR: send error %s", err.Error())
		return ErrConnectionDead(err)
	}
	return nil
}

// List of currently running tasks so we can send them to new connections.
var gRunningTasks map[string][]Signal
var gRunningTasksMux sync.Mutex

func startBackgroundReader(router *MessageRouter) {
	go func() {
		ch := router.OnSignal()
		for {
			sig := <- ch
			mapKey := sig.Key + ":" + sig.ID
			gRunningTasksMux.Lock()
			if sig.Type == "start" {
				// Add to running tasks list
				gRunningTasks[mapKey] = []Signal{sig}
			} else if sig.Type == "success" || sig.Type == "failure" {
				// Remove from running tasks list if it exists
				delete(gRunningTasks, mapKey)
			}
			gRunningTasksMux.Unlock()
		}
	}()
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
				// Read off the incoming message queue to keep the connection alive, and to know when
				// it is closed.
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
			defer router.UnregisterChannel(ch)

			// Send all currently running tasks before starting to process new messages.
			gRunningTasksMux.Lock()
			for _, sigs := range gRunningTasks {
				for _, sig := range sigs {
					if err := sendJson(conn, sig); err != nil {
						if _, ok := err.(ErrConnectionDead); ok {
							conn.Close()
						}
						return
					}
				}
			}
			gRunningTasksMux.Unlock()

			for {
				select {
				case sig := <- ch:
					if err := sendJson(conn, sig); err != nil {
						if _, ok := err.(ErrConnectionDead); ok {
							conn.Close()
						}
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
	gRunningTasks  = make(map[string][]Signal)
	startBackgroundReader(router)
	http.HandleFunc("/api/babysitter/ws", handleWs(router))
}
