"use strict";

// Constants

const USE_PANDORA_USER_IMAGES = true;
const USE_PANDORA_DEFAULT_ALBUM_IMAGE = true;
const DEFAULT_ALBUM_IMAGE = (
    USE_PANDORA_DEFAULT_ALBUM_IMAGE ? 
        'https://web-cdn.pandora.com/web-client-assets/images/album_500.7d4c7506560849c0a606b93e9f06de71.png' :
        './images/default_cover.svg'
);



// Utility functions

const toHTTPS = (url) => {
    if (!url) { return url; }
    if (localStorage.getItem('forceSecure') === 'true') {
        return url.replace('http://', 'https://');
    }
    return url;
}


// Theme loading / default reading


const minimums = {
    width: {
        new: 160,
        old: 310
    },
    height: {
        new: 230,
        old: 50
    },
    history: 0
};

const DEFAULTS = /** @type {const} */ ({
    whichPlayer: "new",
    new: {
        maxHistoryEntries: 20,
        appearance: {
            'viewport-width': '350px',
            'viewport-height': '450px',
            selectedPreset: 'dark'
        }
    },
    old: {
        maxHistoryEntries: 10,
        appearance: {
            'viewport-width': '450px',
            'viewport-height': '100px',
            selectedPreset: 'compact-old'
        }
    },
    presets: [
        {
            id: "match",
            name: "System",
            cssVariables: null // Special
        },
        {
            id: "dark",
            name: "Dark",
            cssVariables: {
                'tab-navigation-background-color': '#242424',
                'tab-navigation-text-color': '#FFFFFF',
                'tab-navigation-icon-size': '1.875rem', /* 30px */
                'background-color': '#282828',
                'text-color': '#FFFFFF',
                'album-background-strength': '0.3',
                'icon-default-background-color': 'transparent',
                'icon-default-color': '#C5C5C5',
                'icon-active-background-color': 'var(--icon-default-background-color)', // transparent doesn't parse, anyways. might as well keep it in for powerusers
                'icon-active-color': '#FFAE00',
                'icon-hover-background-color': 'var(--icon-default-background-color)',
                'icon-hover-color': '#ffffff',
                'icon-active-color': '#FFAE00',
                'history-icon-size': '18px',
                'history-line-differentiator': 'rgba(128, 128, 128, 0.1)',
                'player-cover-max-size-multiplier': '0.8',
                'player-main-icon-color': '#ffffff',
                'player-main-icon-background-color': '#000000',
                'player-main-icon-size': '40px',
                'player-icon-size': '32px',
                'player-icon-color': '#ffffff',
                'player-icon-background-color': 'var(--icon-default-background-color)',
                'player-small-icon-size': '18px',
                'player-small-icon-color': '#C5C5C5',
                'player-small-icon-background-color': 'var(--icon-default-background-color)',
                'stations-play-background-color': 'rgba(0, 0, 0, 0.5)',
                'stations-active-station-background': 'rgba(255, 157, 0, 0.1)',
                'stations-active-station-color': '#ffffff',
                'accounts-icon-success-color': '#3cd300',
                'accounts-icon-warning-color': '#ffbb00',
                'accounts-tooltip-background-color': '#111111',
                'font-family': 'InterVariable, Arial, system-ui, sans-serif',
                'font-size': '16px',
                'color-scheme-type': 'dark'
            }
        },
        {
            id: "light",
            name: "Light",
            cssVariables: {
                'tab-navigation-background-color': '#FFFFFF',
                'tab-navigation-text-color': '#242424',
                'tab-navigation-icon-size': '45px',
                'background-color': '#e5eaf0',
                'text-color': '#000000',
                'album-background-strength': '0.2',
                'icon-default-background-color': '#fcfcfd',
                'icon-default-color': '#8397aa',
                'icon-active-background-color': '#fcfcfd',
                'icon-active-color': '#ee852b',
                'icon-hover-background-color': '#fcfcfd',
                'icon-hover-color': '#ee852b',
                'history-icon-size': '17px',
                'history-line-differentiator': 'rgba(128, 128, 128, 0.1)',
                'player-cover-max-size-multiplier': '0.8',
                'player-main-icon-color': '#8397aa',
                'player-main-icon-background-color': '#e5eaf0',
                'player-main-icon-size': '17px',
                'player-icon-size': '17px',
                'player-icon-color': '#8397aa',
                'player-icon-background-color': '#fcfcfd',
                'player-small-icon-size': '17px',
                'player-small-icon-color': '#8397aa',
                'player-small-icon-background-color': '#fcfcfd',
                'stations-play-background-color': 'rgba(0, 0, 0, 0.5)',
                'stations-active-station-background': '#4a90d9',
                'stations-active-station-color': '#ffffff',
                'accounts-icon-success-color': '#3cd300',
                'accounts-icon-warning-color': '#ffbb00',
                'accounts-tooltip-background-color': '#eeeeee',
                'font-family': 'InterVariable, Arial, system-ui, sans-serif',
                'font-size': '16px',
                'color-scheme-type': 'light'
            }
        },
        {
            id: "compact-old",
            name: "Old Faithful",
            cssVariables: {
                'tab-navigation-background-color': '#FFFFFF',
                'tab-navigation-text-color': '#242424',
                'tab-navigation-icon-size': '45px',
                'background-color': 'linear-gradient(#e5eaf0, white)',
                'text-color': '#000000',
                'album-background-strength': '0',
                'icon-default-background-color': '#fcfcfd',
                'icon-default-color': '#8397aa',
                'icon-active-background-color': '#fcfcfd',
                'icon-active-color': '#ee852b',
                'icon-hover-background-color': '#fcfcfd',
                'icon-hover-color': '#ee852b',
                'history-icon-size': '17px',
                'history-line-differentiator': 'rgba(128, 128, 128, 0.1)',
                'player-cover-max-size-multiplier': '0.8',
                'player-main-icon-color': '#8397aa',
                'player-main-icon-background-color': '#ffffff',
                'player-main-icon-size': '17px',
                'player-icon-size': '17px',
                'player-icon-color': '#8397aa',
                'player-icon-background-color': '#fcfcfd',
                'player-small-icon-size': '17px',
                'player-small-icon-color': '#8397aa',
                'player-small-icon-background-color': '#fcfcfd',
                'stations-play-background-color': 'rgba(0, 0, 0, 0.5)',
                'stations-active-station-background': '#4a90d9',
                'stations-active-station-color': '#ffffff',
                'accounts-icon-success-color': '#3cd300',
                'accounts-icon-warning-color': '#ffbb00',
                'accounts-tooltip-background-color': '#111111',
                'font-family': 'Arial, system-ui, sans-serif',
                'font-size': '12px',
                'color-scheme-type': 'light'
            }
        }
    ]
});

const debounceFunction = (cb, delay = 2000) => {
    let lastRun = Date.now();
    let waiting = false;
    return () => {
        if (waiting) {
            return;
        }
        if (lastRun > (Date.now() - delay)) {
            waiting = true;
            setTimeout(() => {
                waiting = false;
                cb();
            }, delay - (Date.now() - lastRun))
        } else {
            cb();
        }
    }
}

const loadDefaultsIfApplicable = () => {
    ['whichPlayer'].forEach(key => {
        if (!localStorage.getItem(key)) {
            localStorage.setItem(key, DEFAULTS[key]);
        }
    })

    if (!localStorage.getItem('appearance')) {
        localStorage.setItem('appearance', JSON.stringify({
            new: DEFAULTS.new.appearance,
            old: DEFAULTS.old.appearance
        }));
    }

    if (!localStorage.getItem('presets')) {
        localStorage.setItem('presets', JSON.stringify(DEFAULTS.presets));
    }
}

loadDefaultsIfApplicable();

// Migrate from old version, best as possible.
// Most things do not map 1-to-1.
if (localStorage.getItem('bodyWidth') || localStorage.getItem('bodyHeight') || localStorage.getItem('themeInfo')) {
    const whichPlayer = localStorage.getItem('whichPlayer');
    const presets = JSON.parse(localStorage.getItem('presets'));
    const clonedAppearanceSettings = localStorage.getItem('appearance') ? JSON.parse(localStorage.getItem('appearance')) : {
        new: DEFAULTS.new.appearance,
        old: DEFAULTS.old.appearance
    };
    
    if (localStorage.getItem('bodyWidth')) {
        clonedAppearanceSettings[whichPlayer]['viewport-width'] = localStorage.getItem('bodyWidth') + 'px';
        localStorage.removeItem('bodyWidth');
    }
    if (localStorage.getItem('bodyHeight')) {
        clonedAppearanceSettings[whichPlayer]['viewport-height'] = localStorage.getItem('bodyHeight') + 'px';
        localStorage.removeItem('bodyHeight');
    }

    if (localStorage.getItem('themeInfo')) {
        const oldThemeInfo = JSON.parse(localStorage.getItem('themeInfo'));
        // start with default for that type
        const newPreset = structuredClone(presets.find(e => e.id === DEFAULTS[whichPlayer].appearance.selectedPreset));
        newPreset.name = "Migrated";
        newPreset.id = "migrated";
        newPreset.cssVariables['background-color'] = oldThemeInfo.background;
        newPreset.cssVariables['font-family'] = oldThemeInfo['font-family'];
        newPreset.cssVariables['font-size'] = oldThemeInfo['font-size'];
        newPreset.cssVariables['text-color'] = oldThemeInfo['text-color'];
        // Not overly concerned about --inverse-color, as it was _only_ used in the login button.
        newPreset.cssVariables['tab-navigation-icon-size'] = oldThemeInfo.tabSize;
        newPreset.cssVariables['accounts-icon-warning-color'] = oldThemeInfo['warning-color'];
        newPreset.cssVariables['icon-default-color'] = oldThemeInfo['button-color'];
        newPreset.cssVariables['icon-active-color'] = oldThemeInfo['active-button-color'];
        presets.push(newPreset);

        localStorage.setItem('presets', JSON.stringify(presets));
        localStorage.removeItem('themeInfo');
    }

    localStorage.setItem('appearance', JSON.stringify(clonedAppearanceSettings));
}
/*
var style;
var refresh_button;
var default_button;
var logout_button;
var save_button;
var form;
var forceSecure;
var httpWarning_label;
var bodyWidth;
var bodyHeight;
var historyNum;
// var bodyWidthNum = (localStorage.width==undefined?(localStorage.whichPlayer==undefined?defaults.width[defaults.player]:defaults.width[localStorage.whichPlayer]):localStorage.width);
// if localstorage doesn't have it, get it from defaults according to localstorage.whichPlayer
// if localStorage.whichPlayer _also_ doesn't exists, get it from defaults according to default player
// var bodyHeightNum = (localStorage.height==undefined?(localStorage.whichPlayer==undefined?defaults.height[defaults.player]:defaults.width[localStorage.whichPlayer]):localStorage.height);

var background = get_browser().extension.getBackgroundPage();

if (localStorage.themeInfo == undefined) {
    localStorage.themeInfo = JSON.stringify(defaults.theme);
}

function secureWarning() {
    if (forceSecure.checked) {
        httpWarning_label.style.opacity = 0;
    } else {
        httpWarning_label.style.opacity = 1;
    }
}

function initBodySize() {
    "use strict";
    if (localStorage.whichPlayer === undefined) {
        localStorage.whichPlayer = defaults.player;
    }
    // for convenience,
    var whichPlayer = localStorage.whichPlayer;
    if (localStorage.bodyWidth === undefined || localStorage.bodyWidth === 0) {
        localStorage.bodyWidth = defaults.width[whichPlayer];
    }
    if (localStorage.bodyHeight === undefined || localStorage.bodyHeight === 0) {
        localStorage.bodyHeight = defaults.height[whichPlayer];
    }
    if (localStorage.historyNum === undefined || localStorage.historyNum === 0) {
        localStorage.historyNum = defaults.history[whichPlayer];
    }
    if (localStorage.forceSecure === undefined) {
        localStorage.forceSecure = true;
    }
    document.documentElement.style.setProperty("--height", localStorage.bodyHeight +"px");
    document.documentElement.style.setProperty("--width", localStorage.bodyWidth + "px");

    if (!forceSecure) {
        return; // alright that's enough
    }    
    bodyWidth.value = localStorage.bodyWidth;
    bodyHeight.value = localStorage.bodyHeight;
    historyNum.value = localStorage.historyNum;

    if (localStorage.whichPlayer) {
        document.getElementById("preview").src = `./${localStorage.whichPlayer}.htm`;
    }
    
    style.value = localStorage.whichPlayer;
    document.getElementById("theming").addEventListener("click", (e) => {
        e.preventDefault();
        window.location = "theming.htm";
        return false;
    });
    forceSecure.checked = localStorage.forceSecure !== "false" && localStorage.forceSecure;

    secureWarning();
}

function initHotkeys() {
    function commands_function(commands) {
        commands.forEach(command => {
            let playPauseHotkey = document.getElementById("playPauseHotkey");
            let skipSongHotkey = document.getElementById("skipSongHotkey");

            //editing hotkeys doesn't work in chrome apparently.
            if (is_chrome()) {
                if (playPauseHotkey) {
                    playPauseHotkey.disabled = "disabled";
                    playPauseHotkey.title = "This cannot be changed in Chrome";
                }
                if (skipSongHotkey) {
                    skipSongHotkey.disabled = "disabled";
                    skipSongHotkey.title = "This cannot be changed in Chrome";
                }
            }

            if (playPauseHotkey && command.name === "pause_play") {
                playPauseHotkey.value = command.shortcut;
            }
            if (skipSongHotkey && command.name === "skip_song") {
                skipSongHotkey.value = command.shortcut;
            }
        });
    }

    if (is_android()) {
        return;
    }

    //This is infuriating. Both browsers implement the "browser.commands.getAll()" function
    // but firefox utilizes a promise and chrome an older-style callback function
    // Chrome: https://developer.chrome.com/extensions/commands
    // Firefox: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/commands/getAll
    if (is_chrome()) {
        get_browser().commands.getAll(commands_function);
    } else {
        get_browser().commands.getAll().then(commands_function);
    }
}

function updateHotkeys() {
    let playPauseHotkey = document.getElementById("playPauseHotkey");
    let skipSongHotkey = document.getElementById("skipSongHotkey");

    // once again a fairly major difference between the browsers with commands
    if (is_chrome()) {
        return;
    } else if(is_android()) {
        return;
    } else {
        let playPauseDetails = {
            name: "pause_play",
            shortcut: playPauseHotkey.value
        };
        get_browser().commands.update(playPauseDetails).catch(() => {
            alert("The Play/Pause hotkey entered is invalid!");
        });

        let skipSongDetails = {
            name: "skip_song",
            shortcut: skipSongHotkey.value
        };
        get_browser().commands.update(skipSongDetails).catch(() => {
            alert("The Skip Song hotkey entered is invalid!");
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    "use strict";

    refresh_button = document.getElementById("refresh");
    logout_button = document.getElementById("logout");
    default_button = document.getElementById("default");
    save_button = document.getElementById("save");
    forceSecure = document.getElementById("forceSecure");
    httpWarning_label = document.getElementById("httpWarning");

    style = document.getElementById("playerStyle");
    bodyWidth = document.getElementById("bodyWidth");
    bodyHeight = document.getElementById("bodyHeight");
    historyNum = document.getElementById("historyNum");

    initHotkeys();
    initBodySize();

    if (!forceSecure) {
        // only run the following when on options.htm
        return;
    }
    
    if (bodyWidth) {
        bodyWidth.addEventListener("input", heightStuff);
    }
    if (bodyHeight) {
        bodyHeight.addEventListener("input", heightStuff);
    }
    if (style) {
        style.addEventListener("change", () => {
            if (style.value != "new" && style.value != "old") {
                return;
            }
            bodyHeight.value = defaults.height[style.value];
            bodyWidth.value = defaults.width[style.value];
            heightStuff(); // change sizes to minimums, if needed
            document.getElementById("preview").src = `./${style.value}.htm`;
            save_button.click();
            window.location = "";
        });
    }
    
    form = document.querySelector("form");
    let putBackTimeout;

    function heightStuff() {
        if (form) {
            if (putBackTimeout) {
                clearTimeout(putBackTimeout);
            }
            let effHeight = bodyHeight.value; // effective width & height
            let effWidth = bodyWidth.value;
            if (bodyHeight.value < minimums.height[style.value]) {
                effHeight = minimums.height[style.value];
            }
            if (bodyWidth.value < minimums.width[style.value]) {
                effWidth = minimums.width[style.value];
            }
            // console.log("Got to this point");
            var posx = form.getBoundingClientRect().x,
                posy = form.getBoundingClientRect().y;
            document.body.style.minHeight = getComputedStyle(document.body).height;
            form.style.position = "absolute";
            form.style.zIndex = 2;
            form.style.top = posy + window.pageYOffset + "px";
            form.style.left = posx + window.pageXOffset + "px";    
            document.documentElement.style.setProperty("--height", effHeight +"px");
            document.documentElement.style.setProperty("--width", effWidth + "px");

            setTimeout(function() {
                form.style.position = "",
                form.style.zIndex = "",
                form.style.top = "",
                form.style.left = "",
                document.body.style.height = "";
            }, 100);

        }
    }

    forceSecure.addEventListener("change", secureWarning);
    refresh_button.addEventListener("click", function () {
        background.getStationList();
    });
    default_button.addEventListener("click", function () {
        // for convenience,
        var whichPlayer = style.value;
        localStorage.bodyWidth = defaults.width[whichPlayer];
        localStorage.bodyHeight = defaults.height[whichPlayer];
        localStorage.historyNum = defaults.history[whichPlayer];
        localStorage.forceSecure = true;

        document.documentElement.style.setProperty("--height", defaults.height[whichPlayer] +"px");
        document.documentElement.style.setProperty("--width", defaults.width[whichPlayer] + "px");

        bodyWidth.value = localStorage.bodyWidth;
        bodyHeight.value = localStorage.bodyHeight;
        historyNum.value = localStorage.historyNum;
        forceSecure.checked = localStorage.forceSecure;
    });
    logout_button.addEventListener("click", function () {
        localStorage.username = "";
        localStorage.password = "";
        localStorage.lastStation = "";
    });

    save_button.addEventListener("click", function (e) {
        var msg = "";

        if (style && (style.value == "new" || style.value == "old")) {
            localStorage.whichPlayer = style.value;
        } else {
            alert("How did you even get here?");
            e.preventDefault(e);
            return false;
        }
        // I keep writing this, but _for convenience_,
        var player = style.value;
        var min_width = minimums.width[player];
        var min_height = minimums.height[player];
        var min_history = minimums.history[player];

        if (bodyWidth.value < min_width) {
            localStorage.bodyWidth = min_width;
            msg += ("Player width must be greater than or equal to " + min_width + ".\n");
            bodyWidth.value = min_width;
        } else {
            localStorage.bodyWidth = bodyWidth.value;
        }
        if (bodyHeight.value < min_height) {
            localStorage.bodyHeight = min_height;
            msg += ("Player height must be greater than or equal to " + min_height + ".\n");
            bodyHeight.value = min_height;
        } else {
            localStorage.bodyHeight = bodyHeight.value;
        }
        if (historyNum.value < min_history) {
            localStorage.historyNum = min_history;
            msg += ("You must have at least " + min_history + " item" + ((min_history>1)?"s":"") + " in your history.\n");
            historyNum.value = min_history;
        } else {
            localStorage.historyNum = historyNum.value;
        }
        if (msg) {
            alert(msg);
        }

        updateHotkeys();

        localStorage.forceSecure = forceSecure.checked;

        // prevent page refresh on save - each should do but I'm doing both
        e.preventDefault(e); 
        return false;
    });
});
*/


let matchStyleElement = null;

function updateMatchStyles() {
    let presets = JSON.parse(localStorage.getItem('presets'));
    let lightPreset = presets.find(e => e.id === 'light');
    let darkPreset = presets.find(e => e.id ===  'dark');

    let selectors = [];
    if (getAppearanceSetting('selectedPreset') === 'match') {
        selectors.push('html:root');
    }
    if (getAppearanceSetting('selectedPreset', 'new') === 'match') {
        selectors.push('.preview.new');
    }
    if (getAppearanceSetting('selectedPreset', 'old') === 'match') {
        selectors.push('.preview.old');
    }

    let cssText = '';
    if (selectors.length !== 0) {
        cssText = `
@media (prefers-color-scheme: light) {
    #anesidora, ${selectors.join(', ')} {
        ${Object.entries(lightPreset.cssVariables).map(entry => `--${entry[0]}: ${entry[1]};`).join('\n\t\t')}
    }
}
@media (prefers-color-scheme: dark) {
    #anesidora, ${selectors.join(', ')} {
        ${Object.entries(darkPreset.cssVariables).map(entry => `\t\t--${entry[0]}: ${entry[1]};\n`).join('\n\t\t')}
    }
}`;
    }

    let styleElement = matchStyleElement = (matchStyleElement || document.createElement('style'));
    styleElement.setAttribute('type', 'text/css');
    styleElement.replaceChildren(document.createTextNode(cssText));
    document.head.appendChild(styleElement);
}


const getAppearanceSetting = (key, playerType = localStorage.getItem('whichPlayer')) => {
    let allAppearanceSettings = JSON.parse(localStorage.getItem('appearance'))[playerType];
    return allAppearanceSettings[key];
}

const getPreset = (preset = getAppearanceSetting('selectedPreset')) => {
    return JSON.parse(localStorage.getItem('presets')).find(e => e.id === preset);
}

const getPlayerPreset = (playerType = localStorage.getItem('whichPlayer')) => {
    return getPreset(getAppearanceSetting('selectedPreset', playerType));
}

updateMatchStyles();
{
    if (getAppearanceSetting('selectedPreset') !== 'match') {
        let preset = getPlayerPreset();
        for (let key in preset.cssVariables) {
            document.documentElement.style.setProperty("--" + key, preset.cssVariables[key]);
        }    
    }

    document.documentElement.style.setProperty('--viewport-width', getAppearanceSetting('viewport-width'));
    document.documentElement.style.setProperty('--viewport-height', getAppearanceSetting('viewport-height'));
}

const background = get_browser().extension.getBackgroundPage();
