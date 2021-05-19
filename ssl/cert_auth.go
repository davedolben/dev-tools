package main

import (
  "crypto/tls"
  "crypto/x509"
  "errors"
  "flag"
  "fmt"
  "io/ioutil"
  "log"
  "net/http"
)


func main() {
  fServerCert := flag.String("server_cert", "", "Server certificate")
  fServerKey := flag.String("server_key", "", "Server key")
  fCaCert := flag.String("ca_cert", "", "CA cert")
  flag.Parse()

  caCert, _ := ioutil.ReadFile(*fCaCert)
  caCertPool := x509.NewCertPool()
  caCertPool.AppendCertsFromPEM(caCert)

  tlsConfig := &tls.Config{
    ClientCAs: caCertPool,
    ClientAuth: tls.RequireAndVerifyClientCert,
    VerifyPeerCertificate: func(rawCerts [][]byte, verifiedChains [][]*x509.Certificate) error {
      log.Printf("Raw Client: %+v\n", rawCerts)
      log.Printf("Client: %+v\n", verifiedChains)
      for _, chain := range verifiedChains {
        for _, cert := range chain {
	  log.Printf("Cert: %+v\n", cert)
	  // TODO: this is where you'd want to actually verify the common name
	  // Since the cert has already been verified, we know it's the signed one
	  // and therefore it's trusted, so we can trust that the common name is one
	  // that was assigned by the CA. It can be used as a username.
          if cert.Issuer.CommonName != cert.Subject.CommonName {
	    return nil
	  }
        }
      }
      return errors.New("received only CA certificates")
    },
  }
  tlsConfig.BuildNameToCertificate()

  server := &http.Server{
    Addr: ":9443",
    TLSConfig: tlsConfig,
  }

  http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
    fmt.Fprintf(w, "Hello world")
  })

  log.Fatal(server.ListenAndServeTLS(*fServerCert, *fServerKey))
}
