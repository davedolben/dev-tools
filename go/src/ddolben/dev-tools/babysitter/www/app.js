(function() {

let appRoot = document.querySelector("#container");
let logRoot = appRoot.querySelector("#log");

function onSignal(data) {
  let newDiv = document.createElement("div");
  newDiv.innerHTML = "[" + data.type + "] " + data.key;
  logRoot.appendChild(newDiv);
}

function connect() {
  let ws = new WebSocket("ws://" + window.location.host + "/api/babysitter/ws");
  ws.onopen = (e) => {
    console.log("Websocket open");
  };
  ws.onmessage = (e) => {
    console.log(e);
    let data = JSON.parse(e.data);
    onSignal(data);
  };
  ws.onerror = (e) => {
    console.error(e);
  };
  ws.onclose = (e) => {
    console.log("Websocket closed");
    setTimeout(() => {
      connect();
    }, 1000)
  };
}

connect();

})();