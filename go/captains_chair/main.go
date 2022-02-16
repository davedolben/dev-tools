package main

import (
  "encoding/json"
  "flag"
  "fmt"
  "io/ioutil"
  "log"
  "net/http"
  "os/exec"
)

type ConfigAction struct {
  Name string `json:"name"`
  Command []string `json:"command"`
}

type ConfigFile struct {
  Actions []*ConfigAction `json:"actions"`
}

func parseConfigFile(filename string) (*ConfigFile, error) {
  bs, err := ioutil.ReadFile(filename)
  if err != nil {
    return nil, err
  }

  conf := &ConfigFile{}
  if err := json.Unmarshal(bs, conf); err != nil {
    return nil, err
  }

  return conf, nil
}

func doAction(action string, conf *ConfigFile) (string, error) {
  // Find the action
  var actionConf *ConfigAction
  for _, a := range conf.Actions {
    if a.Name == action {
      actionConf = a
      break
    }
  }

  if actionConf == nil {
    return "", fmt.Errorf("failed to find action %q in config", action)
  }

  log.Printf("executing action %q: %+v", action, actionConf)

  cmd := exec.Command(actionConf.Command[0], actionConf.Command[1:]...)
  out, err := cmd.Output()
  if err != nil {
    return "", fmt.Errorf("failed to execute command: %q", err.Error())
  }

  return string(out), nil
}

func main() {
  fDoAction := flag.String("do_action", "", "If present, immediately run the specified action and exit.")
  fConfigFile := flag.String("config", "./config.json", "Configuration file")
  fHost := flag.String("host", "", "Host to serve on")
  fPort := flag.Int("port", 8080, "Port to serve on")
  flag.Parse()

  if len(*fConfigFile) == 0 {
    log.Fatal("please specify a config file")
  }

  conf, err := parseConfigFile(*fConfigFile)
  if err != nil {
    log.Fatalf("error parsing config: %s", err.Error())
  }

  if len(*fDoAction) > 0 {
    out, err := doAction(*fDoAction, conf)
    if err != nil {
      log.Fatalf("failed to perform action: %s", err.Error())
    }
    log.Printf("%s", out)
    return
  }

  registerHandlers(conf)

  host := fmt.Sprintf("%s:%d", *fHost, *fPort)
  log.Printf("serving on %s", host)
  panic(http.ListenAndServe(host, nil))
}

