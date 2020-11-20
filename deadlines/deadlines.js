(function() {

let container = document.querySelector("#container");
let table = new ddoc.MyElement(container, { tag: "table" });
table.addClass("deadlines-table");

let headers = table.addChild("thead").addChild("tr");
headers.addChild("th").text("What");
headers.addChild("th").text("When");

let body = table.addChild("tbody");

function addDeadlines(data) {
  for (let i = 0; i < data.deadlines.length; i++) {
    let d = data.deadlines[i];
    // TODO: create function outside instead for efficiency
    body.addChild("tr", (row) => {
      row.addChild("td").text(d.title);
      row.addChild("td").text(d.due_date);
    });
  }
}

window.fetch("/data/deadlines.json").then((resp) => resp.json()).then((data) => {
  console.log(data);
  addDeadlines(data);
});

// Add a test calendar
let calendar = new ddoc.Calendar(container);
calendar.addYear(2020);

})();
