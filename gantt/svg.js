(function() {

// Assumes that D3.js has already been loaded.

// Check the URL for an explicit data file. If none, load test data.
let dataUrl = "test-data.csv";
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("data_url")) {
  // TODO: this loads an arbitrary URL and is INCREDIBLY insecure
  dataUrl = urlParams.get("data_url");
}

d3.select("title").text("Gantt: " + dataUrl);
d3.select("#header").text(dataUrl);

let canvasWidth = 1400;
let canvasHeight = 520;
let axisHeightPadding = 20;
let widthPadding = 20;
let width = canvasWidth - (2 * widthPadding);
let height = canvasHeight - axisHeightPadding;
let dayWidth = 30;
let taskHeight = 40;
let taskHeightPadding = 2;

let svg = d3.select("#viz").append("svg")
  .style("width", ""+canvasWidth)
  .style("height", ""+canvasHeight);
let chartBody = svg.append("g")
  .attr("transform", "translate(" + widthPadding + ",0)");
let background = chartBody.append("g");
let dayLines = background.append("g");
let weekends = background.append("g");
let today = background.append("path");
let taskRoot = chartBody.append("g");
let xAxis = svg.append("g");

// Months are 0-indexed
let calendarData = {
  "start": new Date(Date.UTC(2020, 02, 20)),
  "end": new Date(Date.UTC(2020, 04, 01))
};

function msToDays(ms) {
  // Round down to nearest whole..
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// Data should have a start and end field that are both Date's.
function updateCalendar(data) {
  let numDays = msToDays(data.end - data.start);

  // Update the global calendar data so we have it after updating the display.
  calendarData.start = data.start;
  calendarData.end = data.end;
  calendarData.weekOffset = data.start.getUTCDay();
  calendarData.days = d3.range(0, numDays, 1);
  calendarData.today = msToDays(new Date() - data.start) + 1;
  // Note that this is not an integral number. You can Math.floor it to make it a whole number.
  dayWidth = width / numDays;
  // Do a multiplication here in case you've decided to apply Math.floor above, which would make
  // this value less than 'width'.
  let xAxisWidth = dayWidth * numDays;

  let dayLinesUpdate = dayLines.selectAll("path")
    .data(calendarData.days);
  dayLinesUpdate.enter().append("path")
    .attr("d", (d) => {
      let x = dayWidth * d;
      return d3.line()([[x, 0], [x, height]]);
    })
    .attr("fill", "none")
    .attr("stroke", "gray")
    .attr("stroke-width", "0.5");
  dayLinesUpdate.exit().remove();

  let weekendsCalendar = calendarData.days.reduce((acc, cur) => {
    // Subtract 1 so 0 is Moday (with mod 7, +6 == -1).
    let day = cur + calendarData.weekOffset + 6;
    if ((day % 7) >= 5) {
      return acc.concat([cur]);
    }
    return acc;
  }, []);

  let weekendsUpdate = weekends.selectAll("rect")
    .data(weekendsCalendar);
  weekendsUpdate.enter().append("rect")
    .attrs({
      x: (d) => { return dayWidth * d; },
      y: 0,
      width: dayWidth,
      height: height,
      fill: "#ddd"
    });
  weekendsUpdate.exit().remove();

  today.attrs({
    d: () => {
      let x = dayWidth * calendarData.today;
      return d3.line()([[x, 0], [x, height]]);
    },
    fill: "none",
    stroke: "#ff8f00",
    "stroke-width": 2
  });

  let endPlusOne = new Date(calendarData.end.getTime());
  endPlusOne.setDate(endPlusOne.getDate() + 1);

  let xScale = d3.scaleTime()
    .domain([calendarData.start, calendarData.end])
    .range([widthPadding, xAxisWidth + widthPadding]);
  let xAxisFunc = d3.axisBottom(xScale);
  xAxis.attr("class", "xaxis")
    .attr("transform", "translate(0," + height + ")")
    .call(xAxisFunc);
}

function transformTasks(tasks) {
  let newTasks = [];
  for (let i = 0; i < tasks.length; i++) {
    let newTask = {};
    newTask.task = tasks[i].task;
    newTask.start = msToDays(tasks[i].start - calendarData.start);
    // Add 1 so it extends through the last day.
    newTask.end = msToDays(tasks[i].end - calendarData.start) + 1;
    newTasks.push(newTask);
  }
  return newTasks;
}

function tasksCsvToObjects(taskCsv) {
  let result = [];
  
  for (let i = 0; i < taskCsv.length; i++) {
    let newTask = {};
    newTask.task = taskCsv[i].task;
    newTask.start = new Date(taskCsv[i].start);
    newTask.end = new Date(taskCsv[i].end);
    result.push(newTask);
  }

  return result;
}

function updateTasks(tasksData) {
  console.log(tasksData);
  tasksData = transformTasks(tasksData);
  console.log(tasksData);

  taskHeight = (height / (tasksData.length + 1)) - taskHeightPadding;
  let taskHeightOffset = taskHeight * 0.5;

  let tasksDisplay = taskRoot.selectAll("rect")
    .data(tasksData);

  tasksDisplay.enter().append("rect")
    .attrs({
      x: (d) => {
        return dayWidth * d.start;
      },
      y: (d, i) => {
        return taskHeightOffset + (i * (taskHeight + taskHeightPadding));
      },
      height: taskHeight,
      width: (d) => {
        return dayWidth * (d.end - d.start);
      },
      fill: "#ccf"
    });
  tasksDisplay.enter().append("text")
    .attrs({
      x: (d) => {
        return (dayWidth * d.start) + 12;
      },
      y: (d, i) => {
        return (taskHeightOffset + (i * (taskHeight + taskHeightPadding))) + (taskHeight * 0.5);
      },
      "alignment-baseline": "central",
      "font-family": "Arial"
    })
    .text((d) => { return d.task; });

  tasksDisplay.exit().remove();
}

function newCalendarFromTasks(tasks) {
  let minDate = new Date(tasks[0].start.getTime());
  let maxDate = new Date(tasks[0].end.getTime());
  for (let i = 1; i < tasks.length; i++) {
    let task = tasks[i];
    if (task.start < minDate) {
      minDate.setTime(task.start.getTime());
    }
    if (task.end > maxDate) {
      maxDate.setTime(task.end.getTime());
    }
  }

  console.log(minDate, maxDate);
  // Expand the range by 1 in each direction, just for display padding.
  // End date is 2 because we're going to expand by 2 when displaying.
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 2);
  console.log(minDate, maxDate);

  let result = {};
  result.start = minDate;
  result.end = maxDate;
  console.log(result);
  return result;
}

d3.csv(dataUrl)
  .then((data) => {
    console.log(data);
    let tasksData = tasksCsvToObjects(data);
    updateCalendar(newCalendarFromTasks(tasksData));
    updateTasks(tasksData);
  })
  .catch((err) => {
    console.error("Error loading data:", err);
  });

function openUrl() {
  let dataUrl = d3.select("#data-url-input").property("value");
  let newUrl =
      window.location.protocol + "//" +
      window.location.host + window.location.pathname +
      "?data_url=" + dataUrl;
  window.location = newUrl;
}

// Hook up the open URL button.
d3.select("#open-url-button")
  .on("click", openUrl);

// Add a download button.
function downloadSvg() {
  // Hide the today line
  today.style("opacity", "0");

  let svgElem = document.querySelector("#viz svg");
  svgElem.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  let svgData = svgElem.outerHTML;
  let svgBlob = new Blob([svgData], {type:"image/svg+xml;charset=utf-8"});
  let svgUrl = URL.createObjectURL(svgBlob);
  let downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "gantt.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Re-show the today line
  today.style("opacity", "1");
}

d3.select("#controls")
  .append("div")
    .attr("class", "bottom-padded")
  .append("a")
    .text("Download")
    .attr("class", "button")
    .on("click", () => {
      downloadSvg();
    });

})();