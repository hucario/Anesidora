"use strict";

background.interactionHappened();

let BG_DEFAULTS = background.DEFAULTS;
const logoHolder = document.querySelector('.logoholder');
if (logoHolder) {
	const updateButton = logoHolder.querySelector('.update');
	const updateTooltip = logoHolder.querySelector('.update-tooltip');
	const versionText = logoHolder.querySelector('.version');


    let latestVersionResponse = undefined;
    /** @type {() => Promise<
     * {ok: true, version: string, href: string, error: never} | 
     * {ok: false, version: never, href: never, error: string}
     * >} */
    const getLatestVersionStringOnce = async () => {
        let requestBody;
        try {
            if (latestVersionResponse) {
                requestBody = latestVersionResponse;
            } else {
                const apiRequest = await fetch('https://api.github.com/repos/pvrs12/Anesidora/releases/latest');
                requestBody = latestVersionResponse = await apiRequest.json();
            }
        } catch(e) {
            return {
                ok: false,
                error: "Couldn't fetch latest version from GitHub."
            }
        }

        return {
            ok: true,
            version: requestBody.name,
            href: requestBody.html_url
        };
    }


    const getNewIconElem = (icon) => {
        let newIconTemplate = document.querySelector(`.${icon}-icon-template`);
        let newIcon = newIconTemplate.content.children[0].cloneNode(true);
        return newIcon;
    }
	const setUpdateIconTo = (icon) => {
		updateButton.replaceChild(getNewIconElem(icon), updateButton.querySelector('.settingsicon'));
	}

	if (versionText) {
		versionText.innerText = getAnesidoraVersion();
	}

	updateButton?.addEventListener('click', () => {
		if (updateButton.classList.contains('active')) {
			return;
		}
		updateButton.classList.add('active');
		setUpdateIconTo('refresh');
		updateTooltip.innerText = "Checking latest version...";

		getLatestVersionStringOnce().then(result => {
			updateButton.classList.remove('active');

			if (result.ok) {
				if (result.version === getAnesidoraVersion()) {
					setUpdateIconTo('check');
					updateTooltip.innerText = 'Anesidora is up-to-date.'
				} else {
					setUpdateIconTo('alert');
					updateTooltip.innerText = 'Anesidora is not up-to-date.'
				}
			} else {
				setUpdateIconTo('refresh');
				updateTooltip.innerText = 'Error checking version.';
			}
		})

	})
}

/** @type {HTMLFormElement} */
const mainForm = document.getElementById('mainForm');


const behaviorSection = document.querySelector('section.behavior');
if (behaviorSection) {
	/** @type {(key: keyof typeof DEFAULTS) => void} */
	const setupPrimitiveInput = (key, cb=(() => {})) => {
		/** @type {HTMLInputElement} */
		let settingsInput = mainForm.elements.namedItem(key);
		let storedValue = bg_config[key];
		if (settingsInput.type === 'checkbox') {
			if (storedValue === !!storedValue) {
				// is boolean
				settingsInput.checked = storedValue;
			} else {
				// Remove bad value
				delete bg_config[key];
				// Config proxy reads defaults when no value is present for base keys
				// That is, it will read defaults for config.key, but not config.foo.key
				settingsInput.checked = bg_config[key];
			}
		} else {
			settingsInput.value = storedValue;
		}
		let visibilityChild = null;
		if (settingsInput.type === 'checkbox' && settingsInput.dataset.visibilityChild) {
			visibilityChild = mainForm.querySelector(settingsInput.dataset.visibilityChild);
			visibilityChild.style.display = (
				settingsInput.checked ?
				'' : 'none'
			)
		}
		settingsInput.addEventListener('input', () => {
			bg_config[key] = (
				(settingsInput.type === 'checkbox')
				? settingsInput.checked
				: settingsInput.value
			);
			cb();
			if (visibilityChild) {
				visibilityChild.style.display = (
					settingsInput.checked 
					? '' 
					: 'none'
				)
			}
		})
	}

	[
		'skipAfterDislike',
		'playAds',
		'registerAds',
		'tagDownloads',
		'renameDownloads',
		'downloadNameFormatString',
		'limitFilenameLength',
		'httpsOnlyAssets',
		'stripTrackingParams',
		'doRewinds',
		'rewindDuration'
	].forEach(e => setupPrimitiveInput(e));

	[
		'pauseAfterInactivity',
		'inactivityDuration'
	].forEach(e => setupPrimitiveInput(e, background.interactionHappened));
}


const appearanceSection = document.querySelector('section.appearance');
if (appearanceSection) {
	/** @type {HTMLIFrameElement} */
	const previewElement = document.getElementById('preview');
	const presetsContainer = appearanceSection.querySelector('#selectedPresetContainer');
	
    /** @type {Array<(preset: typeof DEFAULTS.presets[number]) => void>} */
    const settingsUpdateCBs = [];
    /** @type {HTMLElement[]} */
    const settingsElements = [];

	let disableDimensionChanges = false;

	let prevPlayerType = null;
	function updatePreviewType() {
		let currPlayerType = getEffectivePreset().playerType;
		if (prevPlayerType === currPlayerType) {
			return;
		}
		prevPlayerType = currPlayerType;
		disableDimensionChanges = true;
		previewElement.src = currPlayerType + '.htm?settingsPreview=true';
		setTimeout(() => {
			disableDimensionChanges = false;
		}, 300);
	}
    updatePreviewType();
	{
		let prefersLight = matchMedia(`(prefers-color-scheme: light)`);
	
		prefersLight.addEventListener('change', () => {    
			updatePreviewType();
		});
	}

    function updateAllCSSVariables(key) {
		previewElement.contentWindow?.updateCSSVariables?.(key);
		updateCSSVariables(key);
    }


	const updatePresetElements = () => {
		const selectedPreset = getEffectivePreset();
		const selectedMatchPresetIds = getSelectedMatchPresets();
		for (let matchType in selectedMatchPresetIds) {
			if (selectedPreset.id === selectedMatchPresetIds[matchType]) {
				let matchSide = appearanceSection.querySelector(`.quick-preset-select label.preset-match .${matchType}.side`);
				if (matchSide) {
					matchSide.style.background = selectedPreset.cssVariables['background-color'];
					matchSide.style.color = selectedPreset.cssVariables['text-color'];
					matchSide.style.fontFamily = selectedPreset.cssVariables['font-family'];
				}
			}
		}

		let presetElements = appearanceSection.querySelectorAll(`label.preset-${selectedPreset.id}`);
		for (let presetElement of presetElements) {
			presetElement.style.background = selectedPreset.cssVariables['background-color'];
			presetElement.style.color = selectedPreset.cssVariables['text-color'];
			presetElement.style.fontFamily = selectedPreset.cssVariables['font-family'];
		}
	}

	const onPresetChange = () => {
		let selectedPreset = getPreset();
		let controlsElement = document.querySelector('section.appearance .controls');
		controlsElement.classList = `controls preset-${selectedPreset.id}`;
		if (selectedPreset.id === 'match') {
			regeneratePresetLists();

			for (let element of settingsElements) {
				element.disabled = true;
			}
			let effectivePreset = getMatchPreset();
			let effectivePresetHybrid = {
				...effectivePreset,
				id: selectedPreset.id,
				name: selectedPreset.name
			}

			for (let cb of settingsUpdateCBs) {
				cb(effectivePresetHybrid);
			}
		} else {
			for (let element of settingsElements) {
				element.disabled = false;
			}
			for (let cb of settingsUpdateCBs) {
				cb(selectedPreset);
			}
		}

		presetsContainer.querySelector('.active')?.classList?.remove('active');
		if (selectedPreset) {
			presetsContainer.querySelector(`.preset.preset-${selectedPreset.id}`).classList.add('active');
			presetsContainer.querySelector(`#preset-${selectedPreset.id}`).checked = true;
		}

		updatePreviewType();
		updateCSSVariables();
		if (selectedPreset.playerType === prevPlayerType) {
			previewElement.contentWindow?.updateCSSVariables?.();
			previewElement.contentWindow?.updateCustomCSS?.();
		}
	}

	const dereferenceCSSVariable = (preset, varNameOrValue) => {
		if ((/^var\(--[\w-]+\)$/.test(varNameOrValue))) {
			let visitedKeys = [];
			let varToDereference = varNameOrValue;
			const MAX_DEPTH = 30; // If this ever needs to be upped, open an issue.
			let i = 0;
			while (varToDereference && (/^var\(--[\w-]+\)$/.test(varToDereference))) {
				i++;
				varToDereference = varToDereference.match(/^var\(--([\w-]+)\)$/)?.[1];
				if (visitedKeys.includes(varToDereference)) {
					// Circular reference!
					varToDereference = "#FF00FF";
					console.error("Variable dereferencer hit circular reference: ", varToDereference, "has been visited already.");
					break;
				}
				if (Object.hasOwn(preset.cssVariables, varToDereference)) {
					visitedKeys.push(varToDereference);
					varToDereference = preset.cssVariables[varToDereference];
				}
				if (i > MAX_DEPTH) {
					// What the hell did you do?
					// This should only happen if a circular reference was uncaught,
					// or someone was way too dedicated.
					varToDereference = "#FF00FF";
					console.error("Variable dereferencer hit max depth. What are you doing?")
					break;
				}
			}
			varNameOrValue = varToDereference;
		}
		return varNameOrValue;
	}

	const setupGenericInput = (key, event='input') => {
		// this entire thing would be so much simpler if
		// only jscolor accepted css variable inputs
		// for now, I fight with the library to do what I want.
		// specifically:
		// when set to a variable, it should not try to set itself to the computed value
		// jscolor tries to set it to the last "valid" color, which variables are not
		// I don't know how I got this to work. I suspect there are bugs, but at least the happy path works (?)

		/** @type {HTMLInputElement} */
		let settingsInput = mainForm.elements.namedItem(key);
		let valueShouldBe = settingsInput.value;
		settingsUpdateCBs.push((preset) => {
			let originalValue = preset.cssVariables?.[key] ?? BG_DEFAULTS.presets[1].cssVariables[key];
			let effectiveValue = originalValue;
			if (settingsInput.jscolor) {
				effectiveValue = dereferenceCSSVariable(preset, effectiveValue);
				settingsInput.jscolor.fromString(effectiveValue);
			}
			valueShouldBe = settingsInput.value = originalValue;
		})
		settingsElements.push(settingsInput);
		settingsInput.addEventListener(event, () => {
			valueShouldBe = settingsInput.value;
			getEffectivePreset().cssVariables[key] = settingsInput.value;
			if (key === 'background-color' || key === 'text-color' || key === 'font-family') {
				updatePresetElements();
			}
			updateAllCSSVariables(key);
		})
		
		settingsInput.addEventListener('input', () => {
			if (!settingsInput.jscolor || !settingsInput.value.startsWith('var(--')) {
				return;
			}
			let currentPreset = getEffectivePreset();
			let originalValue = settingsInput.value;
			let effectiveValue = dereferenceCSSVariable(currentPreset, originalValue);
			if (originalValue !== effectiveValue) {
				settingsInput.jscolor.format = "any";
				settingsInput.jscolor.fromString(effectiveValue);
				settingsInput.value = originalValue;
			}
		})
		settingsInput.addEventListener('blur', () => {
			if (!settingsInput.jscolor) {
				return;
			}
			if (settingsInput.value !== valueShouldBe) {
				settingsInput.value = valueShouldBe;
			}
		})
	}

	const setupSizeInput = (key, event='input', unit='px') => {
		/** @type {HTMLInputElement} */
		let settingsInput = mainForm.elements.namedItem(key);
		settingsUpdateCBs.push((preset) => {
			let valueWithUnit = preset.cssVariables?.[key] ?? BG_DEFAULTS.presets[1].cssVariables[key];
			settingsInput.value = valueWithUnit.replace(unit, '');
		})
		settingsElements.push(settingsInput);
		settingsInput.addEventListener(event, () => {
			getEffectivePreset().cssVariables[key] = settingsInput.value + unit;
			updateAllCSSVariables(key);
		})
	}

	// Presets

	let regeneratePresetLists = null;
	{
		const generatePresetList = (targetElement = presetsContainer, presets = bg_config.presets, idPrefix='', forceCb) => {
			let newChildren = [];
			let selectedPreset = bg_config.selectedPreset;
			for (let currentPreset of presets) {
				let radioElement = document.createElement('input');
				radioElement.type = 'radio';
				radioElement.name = 'preset';
				radioElement.value = currentPreset.id;
				radioElement.id = idPrefix + 'preset-' + currentPreset.id;
				radioElement.className = 'sr-only';
	
				let presetElement = document.createElement('label');
				presetElement.className = `preset preset-${currentPreset.id}`;
				presetElement.setAttribute('for', idPrefix + 'preset-' + currentPreset.id);
	
				if (currentPreset.id === 'match') {
					let darkElement = document.createElement('div');
					darkElement.className = 'dark side';
					
					let darkPreset = getMatchPreset('dark');
					darkElement.style.background = darkPreset.cssVariables['background-color'];
					darkElement.style.color = darkPreset.cssVariables['text-color'];
	
					let lightElement = document.createElement('div');
					lightElement.className = 'light side';
					lightElement.ariaHidden = true; // So screen readers don't read out "System System"
	
					let lightPreset = getMatchPreset('light');
					lightElement.style.background = lightPreset.cssVariables['background-color'];
					lightElement.style.color = lightPreset.cssVariables['text-color'];
					
					lightElement.innerText = darkElement.innerText = currentPreset.name;
	
					presetElement.replaceChildren(darkElement, lightElement); // easier than two appendChild calls
				} else {
					presetElement.innerText = currentPreset.name;
	
					// these are the only two required css variables in each preset.
					// the rest is optional
					presetElement.style.background = currentPreset.cssVariables['background-color'];
					presetElement.style.color = currentPreset.cssVariables['text-color'];
		
				}
	
				if (selectedPreset && currentPreset.id === selectedPreset) {
					radioElement.checked = true;
					presetElement.classList.add('active');
				}
	
				if (currentPreset.cssVariables?.['font-family']) {
					presetElement.style.fontFamily = currentPreset.cssVariables['font-family'];
				}
	
				radioElement.addEventListener('change', (e) => {
					let newPreset = e.target.value;

					if (newPreset === 'new') {
						return;
					}

					if (forceCb) {
						forceCb(newPreset);
						return;
					}
	
					bg_config.selectedPreset = newPreset;
	
					targetElement.querySelector('.active')?.classList?.remove('active');
					presetElement.classList.add('active');
	
					onPresetChange();
				});
	
				newChildren.push(radioElement);
				newChildren.push(presetElement);
			}

			if (targetElement === presetsContainer) {
				// generate "new preset" button
				let radioElement = document.createElement('input');
				radioElement.type = 'radio';
				radioElement.name = 'preset';
				radioElement.value = 'new';
				radioElement.id = 'preset-new';
				radioElement.className = 'sr-only';

				let presetElement = document.createElement('label');
				presetElement.className = `preset preset-new`;
				presetElement.setAttribute('for', 'preset-new');
				presetElement.innerText = '+';

				
				radioElement.addEventListener('change', () => {
					let newPreset = mainForm.elements.namedItem('preset').value;

					if (newPreset !== 'new') {
						return;
					}

					let presets = bg_config.presets;
					let newPresetName = "My Preset";
					let generation = 1;
					while (presets.some(e => e.name === newPresetName)) {
						newPresetName = `My Preset ${++generation}`;
					}

					let oldPreset = getEffectivePreset();

					let newPresetId = 'user-created-preset-' + presets.length + '-' + Math.floor(Math.random() * 1e6).toString(16);

					presets.push({
						id: newPresetId,
						name: newPresetName,
						playerType: oldPreset.playerType,
						customCSS: oldPreset.customCSS,
						cssVariables: {
							...(oldPreset.cssVariables)
						}
					})

					bg_config.selectedPreset = newPresetId;
					regeneratePresetLists();
					onPresetChange();
				});

				newChildren.push(radioElement);
				newChildren.push(presetElement);
			}

			targetElement.replaceChildren(...newChildren);
		}

		regeneratePresetLists = () => {
			generatePresetList();

			for (let matchType of ['light', 'dark']) {
				generatePresetList(
					document.querySelector(`#${matchType}PresetSelection`),
					bg_config.presets.filter(e => e.cssVariables?.['color-scheme-type'] === matchType),
					matchType + 'Select-',
					(chosenPreset) => {
						bg_config.selectedMatchPresets[matchType] = chosenPreset;

						document.querySelector(`#${matchType}PresetSelection .active`)?.classList?.remove('active');
						document.querySelector(`#${matchType}PresetSelection .preset.preset-${chosenPreset}`).classList.add('active');
						onPresetChange();
					}
				)
				document.querySelector(`#${matchType}PresetSelection .preset.preset-${getMatchPreset(matchType).id}`)?.classList?.add?.('active');
			}
		}

		regeneratePresetLists();

	}

	// Preset name
	{
		let presetNameInput = mainForm.elements.namedItem('preset-name');
		settingsUpdateCBs.push((preset) => {
			presetNameInput.value = preset.name ?? 'My Preset';

			if (preset.id === 'match') {
				presetNameInput.disabled = true;
			} else {
				presetNameInput.disabled = false;
			}
		})
		settingsElements.push(presetNameInput);
		presetNameInput.addEventListener('input', (e) => {
			const selectedPresetId = bg_config.selectedPreset;
			const allPresets = bg_config.presets;
			const selectedPreset = allPresets.find(e => e.id === selectedPresetId);

			if (!selectedPreset || selectedPresetId === 'match') {
				// These shouldn't happen:
				// There should always be a matching preset,
				// and the 'match' preset should not be editable, as it's just a composite of 'light' and 'dark'
				e.preventDefault();
				return;
			}
		
			selectedPreset.name = presetNameInput.value;
			let presetLabelElements = appearanceSection.querySelectorAll(`.preset.preset-${selectedPresetId}`);
			for (let presetLabelElement of presetLabelElements) {
				presetLabelElement.innerText = presetNameInput.value;
			}
		})
	}

	// Player type
	{
		/** @type {HTMLSelectElement} */
		let playerTypeSelect = mainForm.elements.namedItem('playerType');

		// TODO: setup an installedPlayerTypes setting
		for (let playerType of ['cozy', 'compact']) {
			let element = document.createElement('option');
			element.value = playerType;
			element.innerText = playerType;
			playerTypeSelect.appendChild(element);
		}


		settingsUpdateCBs.push((preset) => {
			playerTypeSelect.value = preset.playerType ?? 'cozy';
		})
		settingsElements.push(playerTypeSelect);
		playerTypeSelect.addEventListener('change', (e) => {
			const selectedPresetId = bg_config.selectedPreset;
			const allPresets = bg_config.presets;
			const selectedPreset = allPresets.find(e => e.id === selectedPresetId);

			let newPlayerType = playerTypeSelect.value;

			if (!selectedPreset) {
				// These shouldn't happen:
				// There should always be a matching preset
				e.preventDefault();
				return;
			}
		
	 		get_browser().browserAction.setPopup({popup: newPlayerType + '.htm'});
			selectedPreset.cssVariables['viewport-width'] = BG_DEFAULTS.playerPreferences[newPlayerType]?.['viewport-width'] ?? selectedPreset.cssVariables['viewport-width'];
			selectedPreset.cssVariables['viewport-height'] = BG_DEFAULTS.playerPreferences[newPlayerType]?.['viewport-height'] ?? selectedPreset.cssVariables['viewport-height'];
			selectedPreset.playerType = newPlayerType;
			updatePreviewType();
			updateDimensions(selectedPreset);
		})
	}

	// Max history entries
	{
		let maxHistoryInput = mainForm.elements.namedItem('maxHistoryEntries');
		settingsUpdateCBs.push((preset) => {
			maxHistoryInput.value = preset.maxHistoryEntries ?? bg_config.playerPreferences[preset.playerType].maxHistoryEntries;

			if (preset.id === 'match') {
				maxHistoryInput.disabled = true;
			} else {
				maxHistoryInput.disabled = false;
			}
		})
		settingsElements.push(maxHistoryInput);
		maxHistoryInput.addEventListener('input', (e) => {
			const selectedPreset = getEffectivePreset();

			if (!selectedPreset || selectedPreset.id === 'match') {
				// These shouldn't happen:
				// There should always be a matching preset,
				// and 'match' should never have this editable.
				e.preventDefault();
				return;
			}
		
			selectedPreset.maxHistoryEntries = parseInt(maxHistoryInput.value, 10);
		})
	}

	// Preset is dark
	{
		/** @type {HTMLInputElement} */
		let presetIsDarkCheckbox = mainForm.elements.namedItem('color-scheme-type');
		settingsUpdateCBs.push((preset) => {
			let valueIsDark = (preset.cssVariables?.['color-scheme-type'] ?? BG_DEFAULTS.presets[1].cssVariables['color-scheme-type']) === 'dark';
			presetIsDarkCheckbox.checked = valueIsDark;
		})
		settingsElements.push(presetIsDarkCheckbox);
		presetIsDarkCheckbox.addEventListener('change', () => {
			getEffectivePreset().cssVariables['color-scheme-type'] = (
				presetIsDarkCheckbox.checked
				? 'dark'
				: 'light'
			);
			updateAllCSSVariables('color-scheme-type');
		})
	}

	// Colors
	setupGenericInput('background-color');
	setupGenericInput('text-color');
	setupGenericInput('tab-navigation-background-color');
	setupGenericInput('tab-navigation-text-color');
	setupGenericInput('icon-default-fill');
	setupGenericInput('icon-default-stroke');
	setupGenericInput('icon-active-fill');
	setupGenericInput('icon-active-stroke');
	setupGenericInput('icon-hover-fill');
	setupGenericInput('icon-hover-stroke');

	setupGenericInput('player-play-icon-stroke');
	setupGenericInput('player-play-icon-fill');
	setupGenericInput('player-main-icons-stroke');
	setupGenericInput('player-main-icons-fill');
	setupGenericInput('player-minor-icons-stroke');
	setupGenericInput('player-minor-icons-fill');

	// Text
	setupGenericInput('font-family', 'change');
	setupSizeInput('font-size');
	
	// Album background
	setupGenericInput('album-background-strength');
	setupGenericInput('album-background-blur-size');
	setupGenericInput('album-background-saturation');

	// Misc. Colors
	setupGenericInput('alternating-row-background');
	setupGenericInput('stations-play-background-color');
	setupGenericInput('stations-active-station-color');
	setupGenericInput('stations-active-station-background');

	// Sizes
	setupSizeInput('tab-navigation-icon-size');
	setupSizeInput('history-icon-size');
	setupSizeInput('player-cover-corner-radius');
	setupGenericInput('player-cover-max-size');
	setupSizeInput('player-main-icon-size');
	setupSizeInput('player-icon-size');
	setupSizeInput('player-small-icon-size');

	// Custom CSS
	{
		/** @type {HTMLInputElement} */
		let cssInput = mainForm.elements.namedItem('customCSS');
		settingsUpdateCBs.push((preset) => {
			cssInput.value = preset.customCSS;
		})
		settingsElements.push(cssInput);
		cssInput.addEventListener('blur', () => {
			getEffectivePreset().customCSS = cssInput.value;
			previewElement.contentWindow?.updateCustomCSS?.();
			// No need to try to update settings customCSS:
			// It's not allowed on settings anyways, to prevent bricking
		})
	}

	// This is at the end so all the inputs are populated
	onPresetChange();

	jscolor.ready(onPresetChange); // refire to override jscolor not understanding var(--) values


	let updateDimensions = () => {};
	{
		let previewHolder = appearanceSection.querySelector('.previewHolder');
		// Player dimensions
		let currentPreset = getEffectivePreset();
		let playerType = currentPreset.playerType;
	
		// let selectButton = dimPreview.querySelector('.selectPlayerType');
	
		let w = currentPreset.cssVariables['viewport-width'] ?? BG_DEFAULTS.playerPreferences[playerType]['viewport-width'];
		let h = currentPreset.cssVariables['viewport-height'] ?? BG_DEFAULTS.playerPreferences[playerType]['viewport-height'];
	
		if (previewElement.contentDocument) {
			previewElement.contentDocument.documentElement.style.setProperty('--viewport-width', w);
			previewElement.contentDocument.documentElement.style.setProperty('--viewport-height', h);
		}
	
		let wInput = mainForm.elements.namedItem('viewport-width');
		let hInput = mainForm.elements.namedItem('viewport-height');
	
		wInput.value = w.replace('px', '');
		hInput.value = h.replace('px', '');
	
		settingsElements.push(wInput, hInput);
		let updateFunc = (preset, w, h) => {
			if (!w) {
				w = preset.cssVariables['viewport-width'] ?? BG_DEFAULTS.playerPreferences[
					(preset.playerType !== 'match' && preset.playerType) ?
					preset.playerType :
					BG_DEFAULTS.presets[BG_DEFAULTS.selectedPreset].playerType
				]['viewport-width'];
			} 
			if (!h) {
				h = preset.cssVariables['viewport-height'] ?? BG_DEFAULTS.playerPreferences[
					(preset.playerType !== 'match' && preset.playerType) ?
					preset.playerType :
					BG_DEFAULTS.presets[BG_DEFAULTS.selectedPreset].playerType
				]['viewport-height'];
			}
			wInput.value = w.replace('px', '');
			hInput.value = h.replace('px', '');
			document.documentElement.style.setProperty('--viewport-width', w);
			document.documentElement.style.setProperty('--viewport-height', h);
			
			if (previewElement.contentDocument) {
				previewElement.contentDocument.documentElement.style.setProperty('--viewport-width', w);
				previewElement.contentDocument.documentElement.style.setProperty('--viewport-height', h);
				previewElement.contentDocument.getElementById('anesidora')?.style.setProperty?.('--viewport-width', w);
				previewElement.contentDocument.getElementById('anesidora')?.style.setProperty?.('--viewport-height', h);
			}
		};
		updateDimensions = updateFunc;
		settingsUpdateCBs.push(updateFunc);
	
		wInput.addEventListener('change', debounceFunction(() => {
			document.documentElement.style.setProperty('--viewport-width', wInput.value + 'px');
		}, 100));
		
		hInput.addEventListener('change', debounceFunction(() => {
			document.documentElement.style.setProperty('--viewport-height', hInput.value + 'px');
		}, 100));
	
		let debouncedSave = debounceFunction(() => {
			// funnily enough, the only expensive operation that needs to be debounced
			// here is the array lookup

			// the config sets are already debounced
			
			let effectivePreset = getEffectivePreset();

			effectivePreset.cssVariables['viewport-width'] =  wInput.value + 'px';
			effectivePreset.cssVariables['viewport-height'] =  hInput.value + 'px';
		}, 100);
	
		const resizeObserver = new ResizeObserver((entries) => {
			if (disableDimensionChanges) {
				return;
			}
			for (const entry of entries) {
				if (entry.borderBoxSize) {
					// account for 1px border
					updateFunc(
						null,
						Math.round(entry.borderBoxSize[0].inlineSize - 2) + 'px',
						Math.round(entry.borderBoxSize[0].blockSize - 2) + 'px'
					);
					debouncedSave();
				}
			}
		})
		
		resizeObserver.observe(previewHolder);
	
	}
}

// These options apply to all color pickers on the page
jscolor.presets.default = {
	alphaChannel: true,
	format: 'any'
};