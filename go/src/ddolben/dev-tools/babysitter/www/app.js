(function() {

class TaskTracker {
  constructor(rootElem, name) {
    this.rootElem = rootElem;
    this.name = name;

    this.rootElem.classList.add("task");

    let nameElem = document.createElement("span");
    nameElem.classList.add("task-name")
    nameElem.innerHTML = name;
    this.rootElem.appendChild(nameElem);
    
    this.statusElem = document.createElement("span");
    this.statusElem.classList.add("task-status");
    this.rootElem.appendChild(this.statusElem);

    this.update("running");
  }

  update(status) {
    if (status === "running") {
      this.rootElem.classList.add("task-running");
      this.rootElem.classList.remove("task-complete");
    }
    if (status === "complete") {
      this.rootElem.classList.remove("task-running");
      this.rootElem.classList.add("task-complete");
    }
    this.statusElem.innerHTML = status;
  }
}

let appRoot = document.querySelector("#container");
let tasksRoot = appRoot.querySelector("#tasks");
let logRoot = appRoot.querySelector("#log");

let tasks = {};

function addTask(key) {
  if (key in tasks) {
    tasks[key].update("running");
  } else {
    let newElem = document.createElement("div");
    tasksRoot.prepend(newElem);
    tasks[key] = new TaskTracker(newElem, key);
  }
}

function completeTask(key) {
  if (!(key in tasks)) {
    console.error("Tried to end task that wasn't started:", key);
    return;
  }
  tasks[key].update("complete");
}

function onSignal(data) {
  let newDiv = document.createElement("div");
  newDiv.innerHTML = "[" + data.type + "] " + data.key;
  logRoot.prepend(newDiv);

  if (data.type === "start") {
    addTask(data.key);
  }
  if (data.type === "end") {
    completeTask(data.key);
  }
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