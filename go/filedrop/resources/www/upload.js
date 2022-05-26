(function() {
let dropArea = document.getElementById("drop-area");

(function() {
  // Hide the form since Javascript is enabled.
  let uploadForm = document.getElementById("upload-form");
  uploadForm.style.display = "none";
})();

// Disable default drag behaviors (should prevent browser from opening file).
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

['dragenter', 'dragover'].forEach(eventName => {
  dropArea.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropArea.addEventListener(eventName, unhighlight, false);
});

dropArea.addEventListener('drop', handleDrop, false);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  dropArea.classList.add('highlight');
}

function unhighlight(e) {
  dropArea.classList.remove('highlight');
}

function handleDrop(e) {
  var files = [...e.dataTransfer.files];
  initializeProgress(files);
  files.forEach(uploadFile);
}

let progressData = [];
let progressBarContainer = document.getElementById("progress-container");

function initializeProgress(files) {
  progressData = [];
  progressBarContainer.innerHTML = "";
  files.forEach(file => {
    let label = document.createElement("span");
    label.innerHTML = file.name + " ";
    let bar = document.createElement("progress");
    bar.setAttribute("max", "100");
    bar.setAttribute("value", "0");
    let barRow = document.createElement("div");
    barRow.classList.add("bottom-padded");
    barRow.appendChild(label);
    barRow.appendChild(bar);
    progressBarContainer.appendChild(barRow);
    progressData.push({
      "name": file.name,
      "percent": 0,
      "progressBar": bar,
    });
  });
}

function updateProgress(id, percent) {
  let d = progressData[id];
  d["progressBar"].value = percent;
}

function uploadFile(file, i) {
  var url = "/upload";
  var xhr = new XMLHttpRequest();
  var formData = new FormData();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
  xhr.upload.addEventListener("progress", e => {
    console.log(i, "upload progress", (e.loaded * 100.0 / e.total) || 100);
    updateProgress(i, (e.loaded * 100.0 / e.total) || 100);
  });
  xhr.addEventListener("readystatechange", e => {
    if (xhr.readyState == 4) {
      if (xhr.status == 200) {
        console.log(i, "complete");
        updateProgress(i, 100);
      } else {
        console.log(i, "upload error");
      }
    }
  });
  formData.append("file", file);
  xhr.send(formData);
}
})();
