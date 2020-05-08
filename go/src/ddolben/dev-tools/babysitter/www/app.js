(function() {

class TaskTracker {
  constructor(rootElem, name, id) {
    this.rootElem = rootElem;
    this.name = name;
    this.id = id;

    this.rootElem.classList.add("task");

    let nameElem = document.createElement("span");
    nameElem.classList.add("task-name")
    nameElem.innerHTML = name;
    this.rootElem.appendChild(nameElem);

    let idElem = document.createElement("span");
    idElem.classList.add("task-id")
    idElem.innerHTML = "(" + id + ")";
    this.rootElem.appendChild(idElem);
    
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

function addTask(key, id) {
  let taskKey = key + ":" + id;
  if (taskKey in tasks) {
    tasks[taskKey].update("running");
  } else {
    let newElem = document.createElement("div");
    tasksRoot.prepend(newElem);
    tasks[taskKey] = new TaskTracker(newElem, key, id);
  }
}

function completeTask(key, id) {
  let taskKey = key + ":" + id;
  if (!(taskKey in tasks)) {
    console.error("Tried to end task that wasn't started:", taskKey);
    return;
  }
  tasks[taskKey].update("complete");
}

function onSignal(data) {
  let newDiv = document.createElement("div");
  newDiv.innerHTML = "[" + data.type + "] " + data.key + " - " + data.id;
  logRoot.prepend(newDiv);

  if (data.type === "start") {
    addTask(data.key, data.id);
  }
  if (data.type === "end") {
    completeTask(data.key, data.id);
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