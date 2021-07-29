(function() {

let DateTime = luxon.DateTime;

let button = document.querySelector("#input-grab-data");
button.onclick = fetchData;

function fetchData() {
  let url_input = document.querySelector("#input-sheet-url");
  let url = url_input.value;
  console.log("URL", url);
  d3.csv(url)
    .then(handleData)
    .catch((err) => {
      console.error(err);
    });
}

function handleData(data) {
  console.log(data);

  let buckets = getTimeBuckets(data);
  console.log(buckets);

  let table = d3.select("#container").append("div").append("table");
  let tr = table.selectAll("tr").data(data).enter().append("tr");
  let td = tr.selectAll("td").data((d) => {
    return [d["What"], d["Date"], d["In"], d["Out"]];
  }).enter().append("td").text((d) => d);
}

function getTimeBuckets(data) {
  // Make buckets
  let bucketed = [];
  for (let weekday = 0; weekday < 7; weekday++) {
    bucketed.push([]);
    for (let hour = 0; hour < 24; hour++) {
      bucketed[weekday].push(0);
    }
  }

  // Fill buckets
  for (let i = 0; i < data.length; i++) {
    let date = new Date(Date.parse(data[i]["Date"]));
    let weekday = date.getDay();
    if (!data[i]["In"] || !data[i]["Out"]) {
      console.log("Ignoring row", data[i]);
      continue;
    }
    let time_in = DateTime.fromFormat(data[i]["In"], "h:mm:ss a");
    if (!time_in.isValid) {
      time_in = DateTime.fromFormat(data[i]["In"], "h:mm a");
    }
    let time_out = DateTime.fromFormat(data[i]["Out"], "h:mm:ss a");
    if (!time_out.isValid) {
      time_out = DateTime.fromFormat(data[i]["Out"], "h:mm a");
    }
    if (!time_in.isValid || !time_out.isValid) {
      console.error("Invalid time", data[i]["In"], data[i]["Out"]);
      throw 'Invalid time';
    }
    console.log(date, weekday, time_in.toString(), time_out.toString());

    let time = time_in;
    let stops = [];
    while (time < time_out) {
      stops.push(time);
      time = time.set({minute: 0, second: 0}).plus({hour: 1});
    }
    stops.push(time_out);

    for (let t_i = 0; t_i < stops.length-1; t_i++) {
      console.log("  Interval", stops[t_i].toString(), stops[t_i+1].toString());
      let interval = luxon.Interval.fromDateTimes(stops[t_i], stops[t_i+1]);
      bucketed[weekday][stops[t_i].hour] += interval.length("minutes");
    }
  }

  return bucketed;
}


//google.charts.load('current');
//google.charts.setOnLoadCallback(init);

function init() {
  let button = document.querySelector("#input-grab-data");
  button.onclick = fetchData;
  button.removeAttribute("disabled");
}

//function fetchData() {
//  let url_input = document.querySelector("#input-sheet-url");
//  let url = url_input.value;
//  console.log("URL", url);
//  let query = new google.visualization.Query(url);
//  query.setQuery('select A, B');
//  query.send(processSheetsData);
//}

function processSheetsData(response) {
  var array = [];
  var data = response.getDataTable();
  var columns = data.getNumberOfColumns();
  var rows = data.getNumberOfRows();
  for (var r = 0; r < rows; r++) {
    var row = [];
    for (var c = 0; c < columns; c++) {
      row.push(data.getFormattedValue(r, c));
    }
    array.push({
      name: row[0],
      value: +row[1],
    });
  }
  renderData(array);
}

function renderData(data) {
  console.log(data);
}

})();
