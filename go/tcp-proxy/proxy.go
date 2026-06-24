package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"time"
)

func handleConnection(clientConn net.Conn, remoteAddr string) {
	clientAddr := clientConn.RemoteAddr().String()
	log.Printf("Connection opened from %s", clientAddr)
	defer func() {
		log.Printf("Connection closed from %s", clientAddr)
		clientConn.Close()
	}()

	remoteConn, err := net.Dial("tcp", remoteAddr)
	if err != nil {
		log.Printf("Failed to connect to remote: %v", err)
		return
	}
	defer remoteConn.Close()

	// Use channels to detect when either side closes
	done := make(chan struct{}, 2)

	go func() {
		io.Copy(remoteConn, clientConn)
		log.Printf("Remote connection closed")
		done <- struct{}{}
	}()
	go func() {
		io.Copy(clientConn, remoteConn)
		log.Printf("Client connection closed")
		done <- struct{}{}
	}()

	// Wait for either copy to finish (client or remote disconnects)
	<-done
}

type udpSession struct {
	conn       *net.UDPConn
	lastActive time.Time
}

func handleUDP(localConn *net.UDPConn, remoteAddr string) {
	sessions := make(map[string]*udpSession)
	var sessionsMutex sync.Mutex
	buffer := make([]byte, 65536)

	// Session timeout cleanup
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			sessionsMutex.Lock()
			now := time.Now()
			for addr, session := range sessions {
				if now.Sub(session.lastActive) > 2*time.Minute {
					log.Printf("UDP session timeout for %s", addr)
					session.conn.Close()
					delete(sessions, addr)
				}
			}
			sessionsMutex.Unlock()
		}
	}()

	for {
		n, clientAddr, err := localConn.ReadFromUDP(buffer)
		if err != nil {
			log.Printf("Failed to read from UDP: %v", err)
			continue
		}

		clientAddrStr := clientAddr.String()
		log.Printf("Received %d bytes from %s", n, clientAddrStr)

		sessionsMutex.Lock()
		session, exists := sessions[clientAddrStr]
		if !exists {
			// Create new session for this client
			remoteUDPAddr, err := net.ResolveUDPAddr("udp", remoteAddr)
			if err != nil {
				log.Printf("Failed to resolve remote address: %v", err)
				sessionsMutex.Unlock()
				continue
			}

			remoteConn, err := net.DialUDP("udp", nil, remoteUDPAddr)
			if err != nil {
				log.Printf("Failed to connect to remote: %v", err)
				sessionsMutex.Unlock()
				continue
			}

			session = &udpSession{
				conn:       remoteConn,
				lastActive: time.Now(),
			}
			sessions[clientAddrStr] = session
			log.Printf("Created new UDP session for %s", clientAddrStr)

			// Start goroutine to read responses from remote
			go func(sess *udpSession, cAddr *net.UDPAddr) {
				responseBuffer := make([]byte, 65536)
				for {
					n, err := sess.conn.Read(responseBuffer)
					if err != nil {
						log.Printf("Remote connection closed for %s", cAddr.String())
						sessionsMutex.Lock()
						delete(sessions, cAddr.String())
						sessionsMutex.Unlock()
						return
					}

					sessionsMutex.Lock()
					sess.lastActive = time.Now()
					sessionsMutex.Unlock()

					log.Printf("Forwarding %d bytes back to %s", n, cAddr.String())
					_, err = localConn.WriteToUDP(responseBuffer[:n], cAddr)
					if err != nil {
						log.Printf("Failed to write to client: %v", err)
					}
				}
			}(session, clientAddr)
		}
		session.lastActive = time.Now()
		sessionsMutex.Unlock()

		// Forward packet to remote
		_, err = session.conn.Write(buffer[:n])
		if err != nil {
			log.Printf("Failed to write to remote: %v", err)
		}
	}
}

func main() {
	fInputPort := flag.Int("input-port", 8080, "Input port to listen on")
	fRemoteAddr := flag.String("remote-addr", "example.com:80", "Remote address to proxy to")
	fUDP := flag.Bool("udp", false, "Use UDP protocol instead of TCP")
	flag.Parse()

	listenAddr := fmt.Sprintf(":%d", *fInputPort) // Local port to listen on
	remoteAddr := *fRemoteAddr                    // Remote address to proxy to

	if *fUDP {
		// UDP mode
		udpAddr, err := net.ResolveUDPAddr("udp", listenAddr)
		if err != nil {
			log.Fatalf("Failed to resolve UDP address: %v", err)
		}

		conn, err := net.ListenUDP("udp", udpAddr)
		if err != nil {
			log.Fatalf("Failed to listen on UDP: %v", err)
		}
		defer conn.Close()

		log.Printf("UDP proxy listening on %s, forwarding to %s", listenAddr, remoteAddr)
		handleUDP(conn, remoteAddr)
	} else {
		// TCP mode
		ln, err := net.Listen("tcp", listenAddr)
		if err != nil {
			log.Fatalf("Failed to listen: %v", err)
		}
		log.Printf("TCP proxy listening on %s, forwarding to %s", listenAddr, remoteAddr)

		for {
			clientConn, err := ln.Accept()
			if err != nil {
				log.Printf("Failed to accept: %v", err)
				continue
			}
			go handleConnection(clientConn, remoteAddr)
		}
	}
}
