import videojs from 'video.js';
import window from 'global/window';

const defaults = {
    width: 0,
    height: 0,
    basePath: '',
};

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
            w: 0,
            h: 0,
            x: 0,
            y: 0,
        };
    }

    const lsrc = imglocation.substring(0, hashindex);
    const hashstring = imglocation.substring(hashindex + 1);
    if (hashstring.substring(0, 5) !== 'xywh=') {
        return {
            src: defaults.basePath + lsrc,
            w: 0,
            h: 0,
            x: 0,
            y: 0,
        };
    }

    const data = hashstring.substring(5).split(',');
    return {
        src: defaults.basePath + lsrc,
        w: +data[2],
        h: +data[3],
        x: +data[0],
        y: +data[1],
    };
}

videojs.plugin('sneakpeek', function (options) {
    let tracks, thumbTrack;
    defaults.basePath = options.basePath || defaults.basePath;
    const settings = Object.assign({}, defaults, options);
    const player = this;

    player.ready(() => {
        tracks = player.remoteTextTracks();
        checkForTracks();
        if (!thumbTrack) { tracks.addEventListener('addtrack', checkForTracks); }
    });

    function checkForTracks() {
        if (thumbTrack) { return; }
        for (let i = 0; i < tracks.length; i++) {
            if (tracks[i].kind === 'metadata') {
                thumbTrack = tracks[i];
                // Chrome needs this
                thumbTrack.mode = 'hidden';
                break;
            }
        }
        if (!thumbTrack) { return; }

        // Android doesn't support :active and :hover on non-anchor and non-button elements
        // so, we need to fake the :active selector for thumbnails to show up.
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

        // create the thumbnail
        const div = document.createElement('div');
        div.className = 'vjs-thumbnail-holder';
        const img = document.createElement('img');
        div.appendChild(img);
        img.className = 'vjs-thumbnail';

        // keep track of the duration to calculate correct thumbnail to display
        let duration = player.duration();

        // when the container is MP4
        player.on('durationchange', () => {
            duration = player.duration();
        });

        // when the container is HLS
        player.on('loadedmetadata', () => {
            duration = player.duration();
        });

        // add the thumbnail to the player
        const progressControl = player.controlBar.progressControl;
        progressControl.el().appendChild(div);

        /* eslint max-statements: ["error", 45] */
        function moveListener(event) {
            const pageXOffset = getScrollOffset().x;
            const clientRect = offsetParent(progressControl.el()).getBoundingClientRect();
            const right = (clientRect.width || clientRect.right) + pageXOffset;

            let pageX = event.pageX;
            if (event.changedTouches) {
                pageX = event.changedTouches[0].pageX;
            }

            // find the page offset of the mouse
            let left = pageX || (event.clientX + document.body.scrollLeft + document.documentElement.scrollLeft);
            // subtract the page offset of the positioned offset parent
            left -= offsetParent(progressControl.el()).getBoundingClientRect().left + pageXOffset;

            // apply updated styles to the thumbnail if necessary
            // mouseTime is the position of the mouse along the progress control bar
            // `left` applies to the mouse position relative to the player so we need
            // to remove the progress control's left offset to know the mouse position
            // relative to the progress control
            const mouseTime = Math.floor((left - progressControl.el().offsetLeft) / progressControl.width() * duration);

            // Now check which of the cues applies
            const cnum = thumbTrack && thumbTrack.cues.length;
            let i = 0;
            let setting;
            while (i < cnum) {
                const ccue = thumbTrack.cues[i];
                if (ccue.startTime <= mouseTime && ccue.endTime >= mouseTime) {
                    setting = parseImageLink(ccue.text);
                    break;
                }
                i++;
            }

            // None found, so show nothing
            if (typeof setting === 'undefined') {
                return;
            }

            // Changed image?
            if (setting.src && img.src !== setting.src) {
                let baseUrl = '';
                // Make the
                if (setting.src[0] === '/') {
                    baseUrl = player.currentSrc();
                    baseUrl = baseUrl.substring(0, baseUrl.lastIndexOf('/'));
                }
                img.src = baseUrl + setting.src;
            }

            // Fall back to plugin defaults in case no height/width is specified
            if (setting.w === 0) {
                setting.w = settings.width;
            }

            if (setting.h === 0) {
                setting.h = settings.height;
            }

            // Set the container width/height if it changed
            if (div.style.width !== setting.w || div.style.height !== setting.h) {
                div.style.width = `${setting.w}px`;
                div.style.height = `${setting.h}px`;
            }

            // Set the image cropping
            img.style.left = `${-(setting.x)}px`;
            img.style.top = `${-(setting.y)}px`;
            img.style.clip = `rect(${setting.y}px,${setting.w + setting.x}px,${setting.y + setting.h}px,${setting.x}px)`;

            const width = setting.w;
            const halfWidth = width / 2;

            // make sure that the thumbnail doesn't fall off the right side of the left side of the player
            if ((left + halfWidth) > right) {
                left = right - width;
            } else if (left < halfWidth) {
                left = 0;
            } else {
                left = left - halfWidth;
            }

            div.style.left = `${left}px`;
        }

        // update the thumbnail while hovering
        progressControl.on('mousemove', moveListener);
        progressControl.on('touchmove', moveListener);

        function moveCancel() {
            div.style.left = '-1000px';
        }

        // move the placeholder out of the way when not hovering
        progressControl.on('mouseout', moveCancel);
        progressControl.on('touchcancel', moveCancel);
        progressControl.on('touchend', moveCancel);
        player.on('userinactive', moveCancel);
    }
});
