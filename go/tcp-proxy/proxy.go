package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"net"
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

func main() {
	fInputPort := flag.Int("input-port", 8080, "Input port to listen on")
	fRemoteAddr := flag.String("remote-addr", "example.com:80", "Remote address to proxy to")
	flag.Parse()

	listenAddr := fmt.Sprintf(":%d", *fInputPort) // Local port to listen on
	remoteAddr := *fRemoteAddr                    // Remote address to proxy to

	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}
	log.Printf("Proxy listening on %s, forwarding to %s", listenAddr, remoteAddr)

	for {
		clientConn, err := ln.Accept()
		if err != nil {
			log.Printf("Failed to accept: %v", err)
			continue
		}
		go handleConnection(clientConn, remoteAddr)
	}
}
