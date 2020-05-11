(function() {

let exports = {};

exports.init = function() {
  let perm = window.Notification.permission;
  if (perm === "granted") {
    return;
  }
  window.Notification.requestPermission().then((result) => {
    window.Notification.permission = result;
  });
};

exports.notify = function(message) {
  if (window.Notification.permission !== "granted") {
    return;
  }
  let n = new Notification("Babysitter", { body: message });
}

window.notify = exports;

})();