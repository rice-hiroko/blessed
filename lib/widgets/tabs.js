/**
 * tabs.js - tabs element for blessed, based on a listbar element for blessed.
 *
 * listbar.js - listbar element for blessed
 * Copyright (c) 2013-2015, Christopher Jeffrey and contributors (MIT License).
 * https://github.com/chjj/blessed
 */

/**
 * Modules
 */

var helpers = require('../helpers');

var Node = require('./node');
var Box = require('./box');

/**
 * Tabs
 */

function Tabs(options) {
  var self = this;

  if (!(this instanceof Node)) {
    return new Tabs(options);
  }

  options = options || {};

  this.items = [];
  this.ritems = [];
  this.commands = [];

  this.leftBase = 0;
  this.leftOffset = 0;

  this.mouse = options.mouse || false;

  Box.call(this, options);

  if (!this.style.selected) {
    this.style.selected = {};
  }

  if (!this.style.item) {
    this.style.item = {};
  }

  if (options.commands || options.items) {
    this.setItems(options.commands || options.items);
  }

  if (options.keys) {
    this.on('keypress', function(ch, key) {
      if (key.name === 'left'
          || (options.vi && key.name === 'h')
          || (key.shift && key.name === 'tab')) {
        self.moveLeft();
        self.screen.render();
        if (key.name === 'tab') return false;
        return;
      }
      if (key.name === 'right'
          || (options.vi && key.name === 'l')
          || key.name === 'tab') {
        self.moveRight();
        self.screen.render();
        if (key.name === 'tab') return false;
        return;
      }
      if (key.name === 'enter'
          || (options.vi && key.name === 'k' && !key.shift)) {
        self.emit('action', self.items[self.selected], self.selected);
        self.emit('select', self.items[self.selected], self.selected);
        var item = self.items[self.selected];
        if (item._.cmd.callback) {
          item._.cmd.callback();
        }
        self.screen.render();
        return;
      }
      if (key.name === 'escape' || (options.vi && key.name === 'q')) {
        self.emit('action');
        self.emit('cancel');
        return;
      }
    });
  }

  this.on('focus', function() {
    self.select(self.selected);
  });
}

Tabs.prototype.__proto__ = Box.prototype;

Tabs.prototype.type = 'tabs';

Tabs.prototype.__defineGetter__('selected', function() {
  return this.leftBase + this.leftOffset;
});

Tabs.prototype.setItems = function(commands) {
  var self = this;

  if (!Array.isArray(commands)) {
    commands = Object.keys(commands).reduce(function(obj, key, i) {
      var cmd = commands[key]
        , cb;

      if (typeof cmd === 'function') {
        cb = cmd;
        cmd = { callback: cb };
      }

      if (cmd.text == null) cmd.text = key;

      if (cmd.text == null && cmd.callback) {
        cmd.text = cmd.callback.name;
      }

      obj.push(cmd);

      return obj;
    }, []);
  }

  this.items.forEach(function(el) {
    el.detach();
  });

  this.items = [];
  this.ritems = [];
  this.commands = [];

  commands.forEach(function(cmd) {
    self.add(cmd);
  });

  this.emit('set items');
};

Tabs.prototype.add =
Tabs.prototype.addItem =
Tabs.prototype.appendItem = function(item, callback) {
  var self = this
    , prev = this.items[this.items.length - 1]
    , drawn
    , cmd
    , title
    , len;

  if (!this.parent) {
    drawn = 0;
  } else {
    drawn = prev ? prev.aleft + prev.width : 0;
    if (!this.screen.autoPadding) {
      drawn += this.ileft;
    }
  }

  if (typeof item === 'object') {
    cmd = item;
  }

  if (typeof item === 'string') {
    cmd = {
      text: item,
      callback: callback
    };
  }

  if (typeof item === 'function') {
    cmd = {
      text: item.name,
      callback: item
    };
  }

  title = cmd.text;

  len = cmd.text.length;

  var options = {
    screen: this.screen,
    top: 0,
    left: drawn + 1,
    height: 1,
    content: title,
    width: len,
    align: 'center',
    autoFocus: false,
    tags: true,
    mouse: true,
    style: helpers.merge({}, this.style.item),
    noOverflow: true
  };

  if (!this.screen.autoPadding) {
    options.top += this.itop;
    options.left += this.ileft;
  }

  ['bg', 'fg', 'bold', 'underline',
   'blink', 'inverse', 'invisible'].forEach(function(name) {
    options.style[name] = function() {
      var attr = self.items[self.selected] === el
        ? self.style.selected[name]
        : self.style.item[name];
      if (typeof attr === 'function') attr = attr(el);
      return attr;
    };
  });

  var el = new Box(options);

  this._[cmd.text] = el;
  cmd.element = el;
  el._.cmd = cmd;

  this.ritems.push(cmd.text);
  this.items.push(el);
  this.commands.push(cmd);
  this.append(el);

  if (cmd.callback) {
    if (cmd.keys) {
      this.screen.key(cmd.keys, function() {
        self.emit('action', el, self.selected);
        self.emit('select', el, self.selected);
        if (el._.cmd.callback) {
          el._.cmd.callback();
        }
        self.select(el);
        self.screen.render();
      });
    }
  }

  if (this.items.length === 1) {
    this.select(0);
  }

  if (this.mouse) {
    el.on('click', function() {
      self.emit('action', el, self.selected);
      self.emit('select', el, self.selected);
      if (el._.cmd.callback) {
        el._.cmd.callback();
      }
      self.select(el);
      self.screen.render();
    });
  }

  this.emit('add item');
};

Tabs.prototype.render = function() {
  var self = this
    , drawn = 0;

  if (!this.screen.autoPadding) {
    drawn += this.ileft;
  }

  this.items.forEach(function(el, i) {
    if (i < self.leftBase) {
      el.hide();
    } else {
      el.rleft = drawn + 1;
      drawn += el.width + 2;
      el.show();
    }
  });

  return this._render();
};

Tabs.prototype.select = function(offset) {
  if (typeof offset !== 'number') {
    offset = this.items.indexOf(offset);
  }

  if (offset < 0) {
    offset = 0;
  } else if (offset >= this.items.length) {
    offset = this.items.length - 1;
  }

  if (!this.parent) {
    this.emit('select item', this.items[offset], offset);
    return;
  }

  var lpos = this._getCoords();
  if (!lpos) return;

  var self = this
    , width = (lpos.xl - lpos.xi) - this.iwidth
    , drawn = 0
    , visible = 0
    , el;

  el = this.items[offset];
  if (!el) return;

  this.items.forEach(function(el, i) {
    if (i < self.leftBase) return;

    var lpos = el._getCoords();
    if (!lpos) return;

    if (lpos.xl - lpos.xi <= 0) return;

    drawn += (lpos.xl - lpos.xi) + 2;

    if (drawn <= width) visible++;
  });

  var diff = offset - (this.leftBase + this.leftOffset);
  if (offset > this.leftBase + this.leftOffset) {
    if (offset > this.leftBase + visible - 1) {
      this.leftOffset = 0;
      this.leftBase = offset;
    } else {
      this.leftOffset += diff;
    }
  } else if (offset < this.leftBase + this.leftOffset) {
    diff = -diff;
    if (offset < this.leftBase) {
      this.leftOffset = 0;
      this.leftBase = offset;
    } else {
      this.leftOffset -= diff;
    }
  }

  this.emit('select item', el, offset);
};

Tabs.prototype.removeItem = function(child) {
  var i = typeof child !== 'number'
    ? this.items.indexOf(child)
    : child;

  if (~i && this.items[i]) {
    child = this.items.splice(i, 1)[0];
    this.ritems.splice(i, 1);
    this.commands.splice(i, 1);
    this.remove(child);
    if (i === this.selected) {
      this.select(i - 1);
    }
  }

  this.emit('remove item');
};

Tabs.prototype.move = function(offset) {
  this.select(this.selected + offset);
};

Tabs.prototype.moveLeft = function(offset) {
  this.move(-(offset || 1));
};

Tabs.prototype.moveRight = function(offset) {
  this.move(offset || 1);
};

Tabs.prototype.selectTab = function(index) {
  var item = this.items[index];
  if (item) {
    if (item._.cmd.callback) {
      item._.cmd.callback();
    }
    this.select(index);
    this.screen.render();
  }
  this.emit('select tab', item, index);
};

/**
 * Custom functions
 */

Tabs.prototype.clearItems = function() {
  return this.setItems([])
};

Tabs.prototype.getCurrentTabName = function() {
  return this.ritems[this.selected]
};

Tabs.prototype.moveAndSelectLeft = function(offset) {
  let oldTabName = this.getCurrentTabName();
  this.moveLeft(offset);
  let newTabName = this.getCurrentTabName();
  if (oldTabName != newTabName) {
    this.selectCurrentTab()
  }
};

Tabs.prototype.moveAndSelectRight = function(offset) {
  let oldTabName = this.getCurrentTabName();
  this.moveRight(offset);
  let newTabName = this.getCurrentTabName();
  if (oldTabName != newTabName) {
    this.selectCurrentTab()
  }
};

Tabs.prototype.selectCurrentTab = function() {
  let index = this.selected;
  let item = this.items[index];
  if (item) {
    if (item._.cmd.callback) {
      item._.cmd.callback()
    }

    this.select(index);
    this.screen.render()
  }

  this.emit('select tab', item, index)
};

/**
 * Expose
 */

module.exports = Tabs;
