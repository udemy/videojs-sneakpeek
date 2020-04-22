"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enablePlugin = enablePlugin;
exports["default"] = sneakpeek;

var _video = _interopRequireDefault(require("video.js"));

var _window = _interopRequireDefault(require("global/window"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

function _extends() { _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; return _extends.apply(this, arguments); }

function _slicedToArray(arr, i) { return _arrayWithHoles(arr) || _iterableToArrayLimit(arr, i) || _unsupportedIterableToArray(arr, i) || _nonIterableRest(); }

function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }

function _unsupportedIterableToArray(o, minLen) { if (!o) return; if (typeof o === "string") return _arrayLikeToArray(o, minLen); var n = Object.prototype.toString.call(o).slice(8, -1); if (n === "Object" && o.constructor) n = o.constructor.name; if (n === "Map" || n === "Set") return Array.from(n); if (n === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)) return _arrayLikeToArray(o, minLen); }

function _arrayLikeToArray(arr, len) { if (len == null || len > arr.length) len = arr.length; for (var i = 0, arr2 = new Array(len); i < len; i++) { arr2[i] = arr[i]; } return arr2; }

function _iterableToArrayLimit(arr, i) { if (typeof Symbol === "undefined" || !(Symbol.iterator in Object(arr))) return; var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"] != null) _i["return"](); } finally { if (_d) throw _e; } } return _arr; }

function _arrayWithHoles(arr) { if (Array.isArray(arr)) return arr; }

var defaults = {
  width: 0,
  height: 0,
  basePath: '',
  urlParams: {}
};

function enablePlugin(name, plugin) {
  var registerFn = _video["default"].registerPlugin || _video["default"].plugin;
  registerFn(name, plugin);
}

function getComputedStyle(el, pseudo) {
  return function (prop) {
    if (_window["default"].getComputedStyle) {
      return _window["default"].getComputedStyle(el, pseudo)[prop];
    }

    return el.currentStyle[prop];
  };
}

function offsetParent(el) {
  if (el.nodeName !== 'HTML' && getComputedStyle(el)('position') === 'static') {
    return offsetParent(el.offsetParent);
  }

  return el;
}

function getScrollOffset() {
  if (_window["default"].pageXOffset) {
    return {
      x: _window["default"].pageXOffset,
      y: _window["default"].pageYOffset
    };
  }

  return {
    x: document.documentElement.scrollLeft,
    y: document.documentElement.scrollTop
  };
}

function parseParams(params) {
  var qs = Object.entries(params).map(function (_ref) {
    var _ref2 = _slicedToArray(_ref, 2),
        key = _ref2[0],
        value = _ref2[1];

    return "".concat(key, "=").concat(value);
  }).join('&');

  if (qs !== '') {
    return "?".concat(qs);
  }

  return '';
}

function parseImageLink(imglocation) {
  var hashindex = imglocation.indexOf('#');

  if (hashindex === -1) {
    return {
      src: imglocation,
      x: 0,
      y: 0,
      w: 0,
      h: 0
    };
  }

  var lsrc = imglocation.substring(0, hashindex);
  var hashstring = imglocation.substring(hashindex + 1);

  if (hashstring.substring(0, 5) !== 'xywh=') {
    return {
      src: defaults.basePath + lsrc,
      x: 0,
      y: 0,
      w: 0,
      h: 0
    };
  }

  var data = hashstring.substring(5).split(',');
  return {
    src: defaults.basePath + lsrc,
    x: +data[0],
    y: +data[1],
    w: +data[2],
    h: +data[3]
  };
}

function sneakpeek(options) {
  defaults.basePath = options.basePath || defaults.basePath;

  var settings = _extends({}, defaults, options);

  var player = this;
  var tracks = [],
      sneakpeekTrack;
  player.ready(function () {
    tracks = player.remoteTextTracks();
    checkForTracks();

    if (!sneakpeekTrack) {
      tracks.addEventListener('addtrack', checkForTracks);
    }
  });

  function checkForTracks() {
    if (sneakpeekTrack) {
      return;
    } // Tracks is an Array-like object so we can't use .find


    for (var i = 0; i < tracks.length; i++) {
      if (tracks[i].kind === 'metadata' && tracks[i].label === 'sneakpeek') {
        sneakpeekTrack = tracks[i]; // Chrome needs this

        sneakpeekTrack.mode = 'hidden';
        break;
      }
    }

    if (!sneakpeekTrack) {
      return;
    } // Android doesn't support :active and :hover on non-anchor and non-button elements
    // so, we need to fake the :active selector for the sneakpeek to show up.


    if (navigator.userAgent.toLowerCase().indexOf('android') !== -1) {
      var _progressControl = player.controlBar.progressControl;

      var addFakeActive = function addFakeActive() {
        _progressControl.addClass('fake-active');
      };

      var removeFakeActive = function removeFakeActive() {
        _progressControl.removeClass('fake-active');
      };

      _progressControl.on('touchstart', addFakeActive);

      _progressControl.on('touchend', removeFakeActive);

      _progressControl.on('touchcancel', removeFakeActive);
    }

    var container = document.createElement('div');
    container.className = 'vjs-sneakpeek-holder';
    var img = document.createElement('img');
    container.appendChild(img);
    img.className = 'vjs-sneakpeek';
    var duration = player.duration(); // MP4 time change

    player.on('durationchange', function () {
      duration = player.duration();
    }); // HLS time change

    player.on('loadedmetadata', function () {
      duration = player.duration();
    }); // Add the sneakpeek

    var progressControl = player.controlBar.progressControl;
    progressControl.el().appendChild(container);

    function moveListener(event) {
      var pageXOffset = getScrollOffset().x;
      var clientRect = offsetParent(progressControl.el()).getBoundingClientRect();
      var pageX = event.pageX;

      if (event.changedTouches) {
        pageX = event.changedTouches[0].pageX;
      } // Find the page offset of the mouse


      var right = (clientRect.width || clientRect.right) + pageXOffset;
      var left = pageX || event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft; // Subtract the page offset of the positioned offset parent

      left -= offsetParent(progressControl.el()).getBoundingClientRect().left + pageXOffset; // Apply updated styles to the sneakpeek if necessary
      // mouseTime is the position of the mouse along the progress control bar
      // `left` applies to the mouse position relative to the player

      var mouseTime = Math.floor(left / progressControl.width() * duration); // Now check which of the cues applies

      var cueLength = sneakpeekTrack && sneakpeekTrack.cues && sneakpeekTrack.cues.length;
      var i = 0;
      var imageSettings;

      while (i < cueLength) {
        var cue = sneakpeekTrack.cues[i];

        if (cue.startTime <= mouseTime && cue.endTime >= mouseTime) {
          imageSettings = parseImageLink(cue.text);
          break;
        }

        i++;
      } // None found, so show nothing


      if (typeof imageSettings === 'undefined') {
        return;
      } // Changed image?


      if (imageSettings.src && img.src !== imageSettings.src) {
        var baseUrl = ''; // Make the

        if (imageSettings.src[0] === '/') {
          baseUrl = player.currentSrc();
          baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
        }

        img.src = baseUrl + imageSettings.src + parseParams(settings.urlParams);
      } // Fall back to plugin defaults in case no height/width is specified


      imageSettings.w = imageSettings.w || settings.width;
      imageSettings.h = imageSettings.h || settings.height; // Set the container width / height if it changed

      if (container.style.width !== imageSettings.w || container.style.height !== imageSettings.h) {
        container.style.width = "".concat(imageSettings.w, "px");
        container.style.height = "".concat(imageSettings.h, "px");
      } // Set the image cropping


      img.style.left = "".concat(-imageSettings.x, "px");
      img.style.top = "".concat(-imageSettings.y, "px");
      var clipOffsets = [imageSettings.y, imageSettings.w + imageSettings.x, imageSettings.y + imageSettings.h, imageSettings.x];
      img.style.clip = "rect(".concat(clipOffsets.join('px,'), "px)");
      var width = imageSettings.w;
      var halfWidth = width / 2; // make sure that the sneakpeek doesn't fall off the right side of the left side of the player

      if (left + halfWidth > right) {
        left = right - width;
      } else if (left < halfWidth) {
        left = 0;
      } else {
        left = left - halfWidth;
      }

      container.style.left = "".concat(left, "px");
    }

    function moveCancel() {
      container.style.left = '-1000px';
    } // update the sneakpeek while hovering


    progressControl.on('mousemove', moveListener);
    progressControl.on('touchmove', moveListener); // move the placeholder out of the way when not hovering

    progressControl.on('mouseout', moveCancel);
    progressControl.on('touchcancel', moveCancel);
    progressControl.on('touchend', moveCancel);
    player.on('userinactive', moveCancel);
  }
}
