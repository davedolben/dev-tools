window.ddoc = window.ddoc || {};

(function(exports) {

class MyElement {
  constructor(parent, options) {
    this.parent = parent;
    if (!options) {
      console.error("Cannot create element without options");
      return;
    }
    if (options.elem) {
      this.elem = options.elem;
    } else if (options.tag) {
      this.elem = document.createElement(options.tag);
      this.parent.appendChild(this.elem);
    } else {
      console.error("Need either elem or tag");
    }
  }

  addChild(tag, f) {
    let newElem = new MyElement(this.elem, { tag: tag });
    if (f) {
      f(newElem);
    }
    return newElem;
  }

  addClass(clazz) {
    this.elem.classList += clazz;
    return this;
  }

  text(txt) {
    this.elem.innerHTML = txt;
    return this;
  }

  style(key, value) {
    this.elem.style[key] = value;
  }

  element() {
    return this.elem;
  }
}

exports.MyElement = MyElement;

})(window.ddoc);
