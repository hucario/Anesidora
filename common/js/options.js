"use strict";


const appearanceSection = document.querySelector('section.appearance');
if (appearanceSection) {
    
    const newPlayerPreview = appearanceSection.querySelector('.preview.new');
    const oldPlayerPreview = appearanceSection.querySelector('.preview.old');
    function updatePreviewsText() {
        [newPlayerPreview, oldPlayerPreview].forEach(preview => {
            if (!preview) { return; }
            
            const getNewIconElem = (icon) => {
                let newIconTemplate = preview.querySelector('.' + icon + '-icon-template');
                let newIcon = newIconTemplate.content.children[0].cloneNode(true);
                return newIcon;
            }

            let currentTrack = background?.currentSong || {
                songName: "Nothing is currently playing.",
                artistName: "Choose a station to begin.",
                albumArtUrl: DEFAULT_ALBUM_IMAGE,
                songRating: 0
            };

            let thumbsDownButton = preview.querySelector('.thumbs-down');
            let thumbsUpButton = preview.querySelector('.thumbs-up');

            if (currentTrack.songRating === 1) {
                thumbsDownButton.classList.remove('active');
                thumbsUpButton.classList.add('active');
            } else if (currentTrack.songRating === -1) {
                // This should never happen.
                // ... still, good to cover it anyways.
                thumbsDownButton.classList.add('active');
                thumbsUpButton.classList.remove('active');
            } else {
                thumbsDownButton.classList.remove('active');
                thumbsUpButton.classList.remove('active');
            }

            let playPauseButton = preview.querySelector('.big');
            if (background.mp3Player?.paused) {
                playPauseButton.replaceChildren(getNewIconElem('play'));
            } else {
                playPauseButton.replaceChildren(getNewIconElem('pause'));
            }

            const nowPlayingTitle = preview.querySelector('.now-playing-title');    
            if (nowPlayingTitle && background?.stationsByToken?.[background?.currentStationToken]?.stationName) {
                nowPlayingTitle.innerText = background.stationsByToken[background.currentStationToken].stationName;
            }

            let coverElement = preview.querySelector('.cover');
            let backgroundImageElement = preview.querySelector('.background-blur');
            let fullSizeImage = toHTTPS(currentTrack.albumArtUrl);
            coverElement.src = fullSizeImage ?? DEFAULT_ALBUM_IMAGE;
            backgroundImageElement.src = fullSizeImage ?? DEFAULT_ALBUM_IMAGE;

            let titleElement = preview.querySelector('.title');
            let artistElement = preview.querySelector('.artist');
            titleElement.innerText = currentTrack.songName;
            artistElement.innerText = currentTrack.artistName;

            
            let seekBar = preview.querySelector('.seekBar');
            if (seekBar && background?.mp3Player && (seekBar instanceof HTMLInputElement)) {
                seekBar.value = background.mp3Player.currentTime;
                seekBar.max = background.mp3Player.duration;
            }

            let volumeBar = preview.querySelector('.volume');
            if (volumeBar && background?.mp3Player && (volumeBar instanceof HTMLInputElement)) {
                volumeBar.value = background.mp3Player.volume * 100;
            }
        });
    }
    background.callbacks.updatePlayer.push(updatePreviewsText);
    updatePreviewsText();

    function updatePreviewsAppearance() {
        let allAppearanceSettings = JSON.parse(localStorage.getItem('appearance'));
        if (allAppearanceSettings.old.selectedPreset === 'match') {
            oldPlayerPreview.removeAttribute('style');
        } else {
            let preset = getPlayerPreset('old');
            for (let key in preset.cssVariables) {
                oldPlayerPreview.style.setProperty("--" + key, preset.cssVariables[key]);
            }
        }
        if (allAppearanceSettings.new.selectedPreset === 'match') {
            newPlayerPreview.removeAttribute('style');
        } else {
            let preset = getPlayerPreset('new');
            for (let key in preset.cssVariables) {
                newPlayerPreview.style.setProperty("--" + key, preset.cssVariables[key]);
            }
        }
        let playerType = localStorage.getItem('whichPlayer');
        if (allAppearanceSettings[playerType].selectedPreset === 'match') {
            document.documentElement.removeAttribute('style');
        } else {
            let preset = getPlayerPreset();
            for (let key in preset.cssVariables) {
                document.documentElement.style.setProperty("--" + key, preset.cssVariables[key]);
            }
        }
    }
    updatePreviewsAppearance();

    /** @type {Array<(preset: typeof DEFAULTS.presets[number]) => void>} */
    const settingsUpdateCBs = [];
    /** @type {HTMLElement[]} */
    const settingsElements = [];

    {
        // Setup appearance section

        /** @type {HTMLFormElement} */
        const mainForm = document.getElementById('mainForm');
        const themesContainer = appearanceSection.querySelector('.quick-theme-select');

        const setPresetVariable = (key, value) => {
            const selectedPresetName = getAppearanceSetting('selectedPreset');

            const clonedPresets = JSON.parse(localStorage.getItem('presets'));
            const clonedTheme = clonedPresets.find(e => e.id === selectedPresetName);

            if (!clonedTheme || selectedPresetName === 'match') {
                // These shouldn't happen:
                // There should always be a matching theme,
                // and the 'match' theme should not be editable, as it's just a composite of 'light' and 'dark'
                return;
           }
           
            clonedTheme.cssVariables[key] = value;

            if (key === 'background-color' || key === 'text-color' || key === 'font-family') {
                if (selectedPresetName === 'light' || selectedPresetName === 'dark') {
                    let matchSide = appearanceSection.querySelector(`.quick-theme-select label.theme-match .${selectedPresetName}.side`);
                    if (matchSide) {
                        matchSide.style.background = clonedTheme.cssVariables['background-color'];
                        matchSide.style.color = clonedTheme.cssVariables['text-color'];
                        matchSide.style.fontFamily = clonedTheme.cssVariables['font-family'];
                    }
                }
    
                let themeButton = appearanceSection.querySelector(`.quick-theme-select label.theme-${selectedPresetName}`);
                if (themeButton) {
                    themeButton.style.background = clonedTheme.cssVariables['background-color'];
                    themeButton.style.color = clonedTheme.cssVariables['text-color'];
                    themeButton.style.fontFamily = clonedTheme.cssVariables['font-family'];
                }
            }

            localStorage.setItem('presets', JSON.stringify(clonedPresets));
        }

        const onPresetChange = () => {
            let selectedPreset = getAppearanceSetting('selectedPreset');
            let currentPreset = getPlayerPreset();

            if (selectedPreset === 'match') {
                for (let element of settingsElements) {
                    element.disabled = true;
                }
                let prefersLight = matchMedia(`(prefers-color-scheme: light)`);
                let actuallyAppliedPresetVariables = getPreset(prefersLight ? 'light' : 'dark').cssVariables;
                let effectivePreset = {
                    ...currentPreset,
                    cssVariables: actuallyAppliedPresetVariables
                }

                for (let cb of settingsUpdateCBs) {
                    cb(effectivePreset);
                }
            } else {
                for (let element of settingsElements) {
                    element.disabled = false;
                }
                for (let cb of settingsUpdateCBs) {
                    cb(currentPreset);
                }
            }

            themesContainer.querySelector('.active')?.classList?.remove('active');
            if (currentPreset) {
                themesContainer.querySelector(`.theme.theme-${selectedPreset}`).classList.add('active');
                themesContainer.querySelector(`#presetTheme-${selectedPreset}`).checked = true;
            }

            updatePreviewsAppearance();
            updateMatchStyles();
        }

        const setupGenericInput = (key, name=key, event='input') => {
            let settingsInput = mainForm.elements.namedItem(name);
            settingsUpdateCBs.push((preset) => {
                settingsInput.value = preset.cssVariables?.[key] ?? DEFAULTS.presets[1].cssVariables[key];
            })
            settingsElements.push(settingsInput);
            settingsInput.addEventListener(event, () => {
                setPresetVariable(key, settingsInput.value);
                updatePreviewsAppearance();
            })
        }

        // Player type
        {
            // This is guaranteed set, because common.js loads defaults and loads before this script does
            /** @type {"new" | "old"} */
            const playerType = localStorage.getItem('whichPlayer');

            const newOption = document.getElementById('playerType-new');
            const oldOption = document.getElementById('playerType-old');

            if (playerType === 'new') {
                newOption.checked = true;
            }
            if (playerType === 'old') {
                oldOption.checked = true;
            }

            [newOption, oldOption].forEach(radioControl => radioControl.addEventListener('change', () => {
                let newValue = mainForm.elements.namedItem('playerType').value;
                localStorage.setItem('whichPlayer', newValue);
                get_browser().browserAction.setPopup({popup: newValue + '.htm'});
                onPresetChange();
            }))
        }

        // Preset themes
        {
            const regeneratePresetList = () => {
                let newChildren = [];
                let presets = JSON.parse(localStorage.getItem('presets'));
                let selectedPreset = getAppearanceSetting('selectedPreset');
                for (let theme of presets) {
                    let radioElement = document.createElement('input');
                    radioElement.type = 'radio';
                    radioElement.name = 'presetTheme';
                    radioElement.value = theme.id;
                    radioElement.id = 'presetTheme-' + theme.id;
                    radioElement.className = 'sr-only';
        
                    let themeElement = document.createElement('label');
                    themeElement.className = `theme theme-${theme.id}`;
                    themeElement.setAttribute('for', 'presetTheme-' + theme.id);
        
                    if (theme.id === 'match') {
                        let darkElement = document.createElement('div');
                        darkElement.className = 'dark side';
                        
                        let darkTheme = presets.find(e => e.id === 'dark');
                        darkElement.style.background = darkTheme.cssVariables['background-color'];
                        darkElement.style.color = darkTheme.cssVariables['text-color'];
        
                        let lightElement = document.createElement('div');
                        lightElement.className = 'light side';
                        lightElement.ariaHidden = true; // So screen readers don't read out "Match Match"
        
                        let lightTheme = presets.find(e => e.id === 'light');
                        lightElement.style.background = lightTheme.cssVariables['background-color'];
                        lightElement.style.color = lightTheme.cssVariables['text-color'];
                        
                        lightElement.innerText = darkElement.innerText = theme.name;
        
                        themeElement.replaceChildren(darkElement, lightElement); // easier than two appendChild calls
                    } else {
                        themeElement.innerText = theme.name;
        
                        // these are the only two required appearance settings in each theme.
                        // the rest is optional
                        themeElement.style.background = theme.cssVariables['background-color'];
                        themeElement.style.color = theme.cssVariables['text-color'];
            
                    }
        
                    if (selectedPreset && theme.id === selectedPreset) {
                        radioElement.checked = true;
                        themeElement.classList.add('active');
                    }
        
                    if (theme.cssVariables?.['font-family']) {
                        themeElement.style.fontFamily = theme.cssVariables['font-family'];
                    }
        
                    radioElement.addEventListener('change', () => {
                        let newTheme = mainForm.elements.namedItem('presetTheme').value;

                        if (newTheme === 'new') {
                            return;
                        }
        
                        // localStorage.appearance will always be set in common.js before this runs
                        const clonedAppearanceSettings = JSON.parse(localStorage.getItem('appearance'));
                        clonedAppearanceSettings[localStorage.getItem('whichPlayer')].selectedPreset = newTheme;
                        localStorage.setItem('appearance', JSON.stringify(clonedAppearanceSettings));
        
                        themesContainer.querySelector('.active')?.classList?.remove('active');
                        themeElement.classList.add('active');
        
                        onPresetChange();
                    });
        
                    newChildren.push(radioElement);
                    newChildren.push(themeElement);
                }

                // Create "new" ""preset""
                {
                    let radioElement = document.createElement('input');
                    radioElement.type = 'radio';
                    radioElement.name = 'presetTheme';
                    radioElement.value = 'new';
                    radioElement.id = 'presetTheme-new';
                    radioElement.className = 'sr-only';

                    let themeElement = document.createElement('label');
                    themeElement.className = `theme theme-new`;
                    themeElement.setAttribute('for', 'presetTheme-new');
                    themeElement.innerText = 'New';

                    
                    radioElement.addEventListener('change', () => {
                        let newTheme = mainForm.elements.namedItem('presetTheme').value;

                        if (newTheme !== 'new') {
                            return;
                        }

                        let allPresets = JSON.parse(localStorage.getItem('presets'));
                        let newPresetName = "My Preset";
                        let generation = 1;
                        while (allPresets.some(e => e.name === newPresetName)) {
                            newPresetName = `My Preset ${++generation}`;
                        }

                        let oldCssVariables = getPlayerPreset().cssVariables;
                        if (getAppearanceSetting('selectedPreset') === 'match') {
                            let prefersLight = matchMedia(`(prefers-color-scheme: light)`);
                            oldCssVariables = getPreset(prefersLight ? 'light' : 'dark').cssVariables;
                        }

                        let newPresetId = 'user-created-preset-' + presets.length + '-' + Math.floor(Math.random() * 1e6).toString(16);

                        allPresets.push({
                            id: newPresetId,
                            name: newPresetName,
                            cssVariables: {
                                ...oldCssVariables
                            }
                        })

                        localStorage.setItem('presets', JSON.stringify(allPresets));
        
                        // localStorage.appearance will always be set in common.js before this runs
                        const clonedAppearanceSettings = JSON.parse(localStorage.getItem('appearance'));
                        clonedAppearanceSettings[localStorage.getItem('whichPlayer')].selectedPreset = newPresetId;
                        localStorage.setItem('appearance', JSON.stringify(clonedAppearanceSettings));
        
                        regeneratePresetList();
                        updateMatchStyles();
                        onPresetChange();
                    });

                    newChildren.push(radioElement);
                    newChildren.push(themeElement);
                }

                themesContainer.replaceChildren(...newChildren);
            }

            regeneratePresetList();
        }

        // Preset name
        {
            let presetNameInput = mainForm.elements.namedItem('preset-name');
            settingsUpdateCBs.push((preset) => {
                presetNameInput.value = preset.name ?? 'My Preset';

                if (preset.id === 'dark' || preset.id === 'light' || preset.id === 'match') {
                    // These should not be renameable, as they are referenced by the "Match system" preset
                    // It would still work with a different name, but that would open the door to
                    // people "losing" which is the special one
                    presetNameInput.disabled = true;
                } else {
                    presetNameInput.disabled = false;
                }
            })
            settingsElements.push(presetNameInput);
            presetNameInput.addEventListener('input', (e) => {
                const selectedPresetId = getAppearanceSetting('selectedPreset');
                const clonedPresets = JSON.parse(localStorage.getItem('presets'));
                const clonedTheme = clonedPresets.find(e => e.id === selectedPresetId);

                if (!clonedTheme || selectedPresetId === 'match') {
                    // These shouldn't happen:
                    // There should always be a matching theme,
                    // and the 'match' theme should not be editable, as it's just a composite of 'light' and 'dark'
                    e.preventDefault();
                    return;
               }
            
                clonedTheme.name = presetNameInput.value;
                localStorage.setItem('presets', JSON.stringify(clonedPresets));
                let presetLabelElement = themesContainer.querySelector(`.theme.theme-${selectedPresetId}`);
                if (presetLabelElement) {
                    presetLabelElement.innerText = presetNameInput.value;
                }
            })
        }

        // Preset is dark
        {
            /** @type {HTMLInputElement} */
            let presetIsDarkCheckbox = mainForm.elements.namedItem('color-scheme-type');
            settingsUpdateCBs.push((preset) => {
                let valueIsDark = (preset.cssVariables?.['color-scheme-type'] ?? DEFAULTS.presets[1].cssVariables['color-scheme-type']) === 'dark';
                presetIsDarkCheckbox.checked = valueIsDark;
            })
            settingsElements.push(presetIsDarkCheckbox);
            presetIsDarkCheckbox.addEventListener('change', () => {
                setPresetVariable('color-scheme-type', presetIsDarkCheckbox.checked ? 'dark' : 'light');
                updatePreviewsAppearance();
            })
        }

        // Colors
        setupGenericInput('background-color');
        setupGenericInput('text-color');
        setupGenericInput('tab-navigation-background-color');
        setupGenericInput('tab-navigation-text-color');
        setupGenericInput('icon-default-background-color');
        setupGenericInput('icon-default-color');
        setupGenericInput('icon-active-background-color');
        setupGenericInput('icon-active-color');
        setupGenericInput('icon-hover-background-color');
        setupGenericInput('icon-hover-color');

        
        setupGenericInput('accounts-icon-warning-color');
        setupGenericInput('accounts-icon-success-color');

        setupGenericInput('player-main-icon-color');
        setupGenericInput('player-main-icon-background-color');
        setupGenericInput('player-icon-color');
        setupGenericInput('player-icon-background-color');
        setupGenericInput('player-small-icon-color');
        setupGenericInput('player-small-icon-background-color');

        // Text
        setupGenericInput('font-family', 'font-family', 'change');
        {
            let fontSizeInput = mainForm.elements.namedItem('font-size');
            settingsUpdateCBs.push((preset) => {
                let valueWithPx = preset.cssVariables?.['font-size'] ?? DEFAULTS.presets[1].cssVariables['font-size'];
                fontSizeInput.value = valueWithPx.replace('px', '');
            })
            settingsElements.push(fontSizeInput);
            fontSizeInput.addEventListener('input', () => {
                setPresetVariable('font-size', fontSizeInput.value + 'px');
                updatePreviewsAppearance();
            })
        }

        // Blur strength
        {
            let blurStrengthRange = mainForm.elements.namedItem('background-blur');
            settingsUpdateCBs.push((preset) => { blurStrengthRange.value = preset.cssVariables?.["album-background-strength"] ?? 0; })
            settingsElements.push(blurStrengthRange);
            blurStrengthRange.addEventListener('change', () => {
                setPresetVariable('album-background-strength', blurStrengthRange.value);
                updatePreviewsAppearance();
            })
        }


        

        // This is at the end so all the inputs are populated
        onPresetChange();
    }
}