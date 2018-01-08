import videojs from 'video.js';
import window from 'global/window';

const defaults = {
    width: 0,
    height: 0,
    basePath: '',
};

// VideoJS 5 and 6 cross-compatibility
function enablePlugin(name, plugin) {
    const registerFn = videojs.registerPlugin || videojs.plugin;
    registerFn(name, plugin)
}

function getComputedStyle(el, pseudo) {
    return function (prop) {
        if (window.getComputedStyle) {
            return window.getComputedStyle(el, pseudo)[prop];
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
    if (window.pageXOffset) {
        return {
            x: window.pageXOffset,
            y: window.pageYOffset,
        };
    }
    return {
        x: document.documentElement.scrollLeft,
        y: document.documentElement.scrollTop,
    };
}

function parseImageLink(imglocation) {
    const hashindex = imglocation.indexOf('#');
    if (hashindex === -1) {
        return {
            src: imglocation,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    }

    const lsrc = imglocation.substring(0, hashindex);
    const hashstring = imglocation.substring(hashindex + 1);
    if (hashstring.substring(0, 5) !== 'xywh=') {
        return {
            src: defaults.basePath + lsrc,
            x: 0,
            y: 0,
            w: 0,
            h: 0,
        };
    }

    const data = hashstring.substring(5).split(',');
    return {
        src: defaults.basePath + lsrc,
        x: +data[0],
        y: +data[1],
        w: +data[2],
        h: +data[3],
    };
}

function sneakpeek(options) {
    defaults.basePath = options.basePath || defaults.basePath;

    const settings = Object.assign({}, defaults, options);
    const player = this;

    let tracks = [], sneakpeekTrack;

    player.ready(() => {
        tracks = player.remoteTextTracks();
        checkForTracks();
        if (!sneakpeekTrack) {
            tracks.addEventListener('addtrack', checkForTracks);
        }
    });

    function checkForTracks() {
        if (sneakpeekTrack) {
            return;
        }

        // Tracks is an Array-like object so we can't use .find
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind === 'metadata') {
                sneakpeekTrack = tracks[i];
                // Chrome needs this
                sneakpeekTrack.mode = 'hidden';
                break;
            }
        }

        if (!sneakpeekTrack) {
            return;
        }

        // Android doesn't support :active and :hover on non-anchor and non-button elements
        // so, we need to fake the :active selector for the sneakpeek to show up.
        if (navigator.userAgent.toLowerCase().indexOf('android') !== -1) {
            const progressControl = player.controlBar.progressControl;

            const addFakeActive = function () {
                progressControl.addClass('fake-active');
            };
            const removeFakeActive = function () {
                progressControl.removeClass('fake-active');
            };

            progressControl.on('touchstart', addFakeActive);
            progressControl.on('touchend', removeFakeActive);
            progressControl.on('touchcancel', removeFakeActive);
        }

        const container = document.createElement('div');
        container.className = 'vjs-sneakpeek-holder';
        const img = document.createElement('img');
        container.appendChild(img);
        img.className = 'vjs-sneakpeek';

        let duration = player.duration();

        // MP4 time change
        player.on('durationchange', () => {
            duration = player.duration();
        });

        // HLS time change
        player.on('loadedmetadata', () => {
            duration = player.duration();
        });

        // Add the sneakpeek
        const progressControl = player.controlBar.progressControl;
        progressControl.el().appendChild(container);

        function moveListener(event) {
            const pageXOffset = getScrollOffset().x;
            const clientRect = offsetParent(progressControl.el()).getBoundingClientRect();

            let pageX = event.pageX;
            if (event.changedTouches) {
                pageX = event.changedTouches[0].pageX;
            }

            // Find the page offset of the mouse
            const right = (clientRect.width || clientRect.right) + pageXOffset;
            let left = pageX || (event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft);
            // Subtract the page offset of the positioned offset parent
            left -= offsetParent(progressControl.el()).getBoundingClientRect().left + pageXOffset;

            // Apply updated styles to the sneakpeek if necessary
            // mouseTime is the position of the mouse along the progress control bar
            // `left` applies to the mouse position relative to the player so we need
            // to remove the progress control's left offset to know the mouse position
            // relative to the progress control
            const mouseTime = Math.floor((left - progressControl.el().offsetLeft) / progressControl.width() * duration);

            // Now check which of the cues applies
            const cueLength = sneakpeekTrack && sneakpeekTrack.cues.length;
            let i = 0;
            let imageSettings;
            while (i < cueLength) {
                const cue = sneakpeekTrack.cues[i];
                if (cue.startTime <= mouseTime && cue.endTime >= mouseTime) {
                    imageSettings = parseImageLink(cue.text);
                    break;
                }
                i++;
            }

            // None found, so show nothing
            if (typeof imageSettings === 'undefined') {
                return;
            }

            // Changed image?
            if (imageSettings.src && img.src !== imageSettings.src) {
                let baseUrl = '';
                // Make the
                if (imageSettings.src[0] === '/') {
                    baseUrl = player.currentSrc();
                    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
                }
                img.src = baseUrl + imageSettings.src;
            }

            // Fall back to plugin defaults in case no height/width is specified
            imageSettings.w = imageSettings.w || settings.width;
            imageSettings.h = imageSettings.h || settings.height;

            // Set the container width / height if it changed
            if (container.style.width !== imageSettings.w || container.style.height !== imageSettings.h) {
                container.style.width = `${imageSettings.w}px`;
                container.style.height = `${imageSettings.h}px`;
            }

            // Set the image cropping
            img.style.left = `${-(imageSettings.x)}px`;
            img.style.top = `${-(imageSettings.y)}px`;
            const clipOffsets = [
                imageSettings.y,
                imageSettings.w + imageSettings.x,
                imageSettings.y + imageSettings.h,
                imageSettings.x
            ];
            img.style.clip = `rect(${clipOffsets.join('px,')}px)`;

            const width = imageSettings.w;
            const halfWidth = width / 2;

            // make sure that the sneakpeek doesn't fall off the right side of the left side of the player
            if ((left + halfWidth) > right) {
                left = right - width;
            } else if (left < halfWidth) {
                left = 0;
            } else {
                left = left - halfWidth;
            }

            container.style.left = `${left}px`;
        }

        function moveCancel() {
            container.style.left = '-1000px';
        }

        // update the sneakpeek while hovering
        progressControl.on('mousemove', moveListener);
        progressControl.on('touchmove', moveListener);

        // move the placeholder out of the way when not hovering
        progressControl.on('mouseout', moveCancel);
        progressControl.on('touchcancel', moveCancel);
        progressControl.on('touchend', moveCancel);
        player.on('userinactive', moveCancel);
    }
}

enablePlugin('sneakpeek', sneakpeek);

export default sneakpeek;
