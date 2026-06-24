package babysitter

const (
	SignalTypeStart   = "start"
	SignalTypeSuccess = "success"
	SignalTypeFailure = "failure"
)

type Signal struct {
	Type string `json:"type"`
	Key  string `json:"key"`
	ID   string `json:"id"`
	Cmd  string `json:"cmd"`
	Cwd  string `json:"cwd"`
}
