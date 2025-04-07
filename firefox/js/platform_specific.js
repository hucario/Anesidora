/*globals browser*/
/*exported platform_specific, get_browser, is_android*/

var isAndroid = false;

get_is_android();

function is_android() {
    return isAndroid;
}

function get_is_android() {
    let platform_promise = get_browser().runtime.getPlatformInfo();
    platform_promise.then(function (info) {
        isAndroid = info.os === "android";
    });
}

function is_chrome() {
    return false;
}

function platform_specific() {
    function getPopupUrl() {
        let useablePopupURL = '/cozy.htm';
        try {
            let currentPresetID = config.selectedPreset;
            let allPresets = config.presets;

            if (currentPresetID && allPresets) {
                let currentPreset = allPresets.find(e => e.id === currentPresetID);
                if (currentPreset && currentPreset.playerType) {
                    if (currentPreset.playerType === 'match') {
                        let selectedMatchPresets = config.selectedMatchPresets;

                        for (let matchType of ['light', 'dark']) {
                            if (!selectedMatchPresets[matchType]) {
                                selectedMatchPresets[matchType] = allPresets.find(e => e.cssVariables['color-scheme-type'] === matchType)?.id;

                                if (!selectedMatchPresets[matchType]) {
                                    let presetFromDefaults = DEFAULTS.presets.find(e => e.cssVariables['color-scheme-type'] === matchType);
                                    allPresets.push(presetFromDefaults);
                                    selectedMatchPresets[matchType] = presetFromDefaults.name;
                                }
                            }
                        }

                        let prefersLight = matchMedia(`(prefers-color-scheme: light)`).matches;
                        let colorScheme = prefersLight ? 'light' : 'dark';

                        currentPreset = presets.find(e => e.id === selectedMatchPresets[colorScheme]);
                    }

                    useablePopupURL = `/${currentPreset.playerType}.htm`;
                }
            }
        } catch(e) {
            
        }
        return useablePopupURL;
    }

    if (!is_android()) {
        get_browser().browserAction.setPopup({popup: getPopupUrl()});
    }

    get_browser().browserAction.onClicked.addListener(() => {
        get_browser().tabs.create({
            url: getPopupUrl()
        });
    });
}

function get_browser() {
    return browser;
}