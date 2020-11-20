window.ddoc = window.ddoc || {};

(function(out) {

class Calendar {
  constructor(root) {
    this.root = root;
  }

  addMonth(month, year, parent) {
    parent = parent || this.root;
    let container = new ddoc.MyElement(parent, {tag: "div"});
    container.style("display", "inline-block");

    let date = new Date(year, month, 1);
    const monthStr = date.toLocaleString('default', { month: 'long' });
    container.addChild("div").text("" + monthStr);

    let table = container.addChild("table");

    let hdrs = table.addChild("thead").addChild("tr");
    hdrs.addChild("th").text("S");
    hdrs.addChild("th").text("M");
    hdrs.addChild("th").text("T");
    hdrs.addChild("th").text("W");
    hdrs.addChild("th").text("Th");
    hdrs.addChild("th").text("F");
    hdrs.addChild("th").text("S");

    let day1 = date.getDay();
    let lastDate = new Date(date.getFullYear(), date.getMonth()+1, 0);
    let lastDay = lastDate.getDate();
    let body = table.addChild("tbody");
    for (let week = 0; week * 7 < 31; week++) {
      let tr = body.addChild("tr");
      for (let i = 0; i < 7; i++) {
        let td = tr.addChild("td");
        let d = ((week*7)+i+1-day1);
        if (d <= lastDay && d >= 1) {
          td.text("" + d);
        }
      }
    }
  }

  addYear(year) {
    for (let row = 0; row < 3; row++) {
      let rowContainer = new ddoc.MyElement(this.root, {tag: "div"});
      rowContainer.style("display", "block");
      for (let col = 0; col < 4; col++) {
        this.addMonth((row*4) + col, year, rowContainer.element());
      }
    }
  }
};

out.Calendar = Calendar;

})(window.ddoc);