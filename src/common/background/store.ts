// ANCHOR: Top
/**
 * # store.ts
 * 
 * - Tries to get saved config from localStorage
 * - Provides functions to interact with said config
 * 
 * _**Do not** load this file from anywhere but background.ts_
 * 
 * Regions:
 * 1. Typedefs and constants
 * 2. Internal utility functions
 * 3. Parse existing (?) config from localStorage
 * 4. Functions to interact with said
 * 5. Exports
 */


import { getNestedProperty, setNestedProperty } from "../util.js";
import { LinkishString, NumberishString, UnpopulatedPandoraAd, PandoraSong, PandoraTime, PopulatedPandoraAd, PandoraStation } from "./pandora.js";

// ANCHOR: Typedefs and constants

const ANESIDORA_NAMESPACE = "anesidoraSettings";

export type AnesidoraFeedItem = PandoraSong | PopulatedPandoraAd | AnesidoraEvent;


export type AnesidoraEvent = (
	{
		isEvent: true,
		eventType: string,
		handledYet: boolean,
		uniqueSessionId: string,
		data?: unknown
	} & StationChangeEvent
);

type StationChangeEvent = {
	eventType: "stationChange",
	/** Token */
	data: {
		from: PandoraStation,
		to: PandoraStation
	}
}




export type PandoraAccount = BasePandoraAccount & (PopulatedPandoraAccount | LoggedOutPandoraAccount);

export type BasePandoraAccount = {
	populated: boolean
	email: string,

	/**
	 * This should not be stored as plain text,
	 * but it's the only choice we have due to Pandora's design choices.
	 */
	password: string,
}
export type LoggedOutPandoraAccount = {
	populated: false,
}
export type PopulatedPandoraAccount = BasePandoraAccount & {
	populated: true

	/** Optional UI-only nickname for the account, e.g. "Home", "Work" */
	name?: string,

	/** User icon. May not be a blob. */
	pictureUrl: LinkishString | null,

	bookmarks?: {
		artists: {
			musicToken: string,
			artistName: string,
			artUrl: LinkishString,
			bookmarkToken: string,
			dateCreated: PandoraTime
		}[],
		songs: {
			sampleUrl: LinkishString,
			sampleGain: NumberishString,
			albumName: string,
			artistName: string,
			musicToken: string,
			dateCreated: PandoraTime,
			artUrl: LinkishString,
			bookmarkToken: string,
			songName: string
		}[]
	}

	/** Pandora ID - Will not change */
	userId: string

	/** These are wiped every session for relogin. */
	userAuthToken: string,
	partnerAuthToken: string,
	partnerId: string
	// These two are needed to calculate a parameter required in most requests.
	firstSyncTime: number;
	clientStartTime: number;
}
export type ConfigListenerData = {
	key: string,
	oldValue: unknown,
	newValue: unknown
};

export type ConfigListener = (opts: ConfigListenerData) => void

export type ListenerId = string;

export type validPanes = "accountSelection" | "history" | "controls" | "stations" | "bookmarks"


type CSize = `${number}${string}` | '0';
type OneTwoOrFour<t extends string> = `${t}` | `${t} ${t}` | `${t} ${t} ${t} ${t}`

type CColor = `rgba(${number},${number},${number},${number})`

type BookmarksGridOptions = {
	imgSize: CSize
} & GridOptions;

export type AnesidoraConfig = {
	forceSecure: boolean,
	lastUsedStation: null,
	accounts: PandoraAccount[],
	activeAccount: string | null,
	stripTrackers: boolean,

	certification: {
		autoSkipAds: boolean
	},

	playerPanes: validPanes[],

	theming: {
		/** Needs to be in static terms, not relative units */
		popupWidth: `${number}px`,
		popupHeight: `${number}px`,
		common: Partial<CommonThemingOptions>,
		smoothScroll: boolean,
		stations: {

			showHeader: boolean,
			gridOptions: BookmarksGridOptions,
			mode: 'squares' | 'widesquares'

		} & CommonThemingOptions;
		bookmarks: {
			groupMode: 'artist_first' | 'song_first',
			combined: boolean,
			mode: 'squares' | 'widesquares',
			artistGroup: BookmarksGridOptions,
			songGroup: BookmarksGridOptions,
			combinedGroup: BookmarksGridOptions
		} & CommonThemingOptions,
		controls: {
			/** Defaults to accentColor */
			rangeColor: CColor | null,
			/** Defaults to rangeColor */
			volumeColor: CColor | null,
			/** Defaults to rangeColor */
			seekColor: CColor | null

			/** Does not default. If this is undefined, there's nothing. */
			rangeBgColor: CColor,
			/** Defaults to rangeBgColor */
			volumeBgColor: CColor | null,
			/** Defaults to rangeBgColor */
			seekBgColor: CColor | null,

			/** Whether or not to show the history and up next bits */
			singleCoverMode: boolean,
			
			/** Minimalistic */
			miniPlayerMode: boolean
		} & CommonThemingOptions,
		customCSS: null | string,
		cssVars: {
			tabSize: CSize,
			fontFamily: string
		}
	}
	bookmarksPane: {
		uniqueOption: true
	}

	searchProvider: LinkishString
	defaultPane: validPanes,

	controlsPane: {
		autoScroll: boolean
	},

	recentStation: string | null,

	volume: number
}

export type GridOptions = {
	gap: CSize,
	columns: number
}

export type CommonThemingOptions = {
	padding: OneTwoOrFour<CSize>;
	backgroundColor: CColor;
	textColor: CColor;
	defaultAlbumCover: LinkishString;
	accentColor: CColor;
};
const defaultConfig: AnesidoraConfig = {
	searchProvider: 'https://youtube.com/results?search_query=',
	lastUsedStation: null,
	stripTrackers: true,
	defaultPane: "controls",
	certification: {
		autoSkipAds: false
	},
	bookmarksPane: {
		uniqueOption: true
	},
	controlsPane: {
		autoScroll: true
	},
	theming: {
		smoothScroll: false,
		stations: {
			defaultAlbumCover: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPkL5v/HwAD5QIlaA51ZwAAAABJRU5ErkJggg==",
			padding: "0",
			backgroundColor: "rgba(0,0,0,1)",
			accentColor: "rgba(255,188,0,1)",
			textColor: "rgba(255,255,255,1)",

			showHeader: true,
			mode: 'widesquares',
			gridOptions: {
				columns: 3,
				gap: '1rem',
				imgSize: '2rem'
			}
		},
		controls: {
			defaultAlbumCover: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPkL5v/HwAD5QIlaA51ZwAAAABJRU5ErkJggg==",
			padding: "0",
			backgroundColor: "rgba(0,0,0,1)",
			textColor: "rgba(255,255,255,1)",
			accentColor: "rgba(255,188,0,1)",
			rangeColor: null,
			volumeColor: null,
			seekColor: null,
			rangeBgColor: "rgba(255,255,255,1)",
			volumeBgColor: null,
			seekBgColor: null,

			singleCoverMode: false,
			miniPlayerMode: false
		},
		popupWidth: "400px",
		popupHeight: "599px",
		cssVars: {
			tabSize: '2rem',
			fontFamily: "'Inter', sans-serif"
		},
		customCSS: null,
		common: {},
		bookmarks: {
			accentColor: "rgba(255,188,0,1)",
			defaultAlbumCover: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mPkL5v/HwAD5QIlaA51ZwAAAABJRU5ErkJggg==',
			backgroundColor: 'rgba(0,0,0,1)',
			textColor: 'rgba(255,255,255,1)',
			padding: '0 5rem 5rem 5rem',
			mode: 'widesquares',
			groupMode: 'artist_first',
			combined: false,
			artistGroup: {
				gap: '1rem',
				columns: 4,
				imgSize: '5rem'
			},
			songGroup: {
				gap: '1rem',
				columns: 3,
				imgSize: '4rem'
			},
			combinedGroup: {
				gap: '1rem',
				columns: 3,
				imgSize: '4rem'
			}
		}
	},


	forceSecure: true,
	accounts: [],
	activeAccount: null,

	playerPanes: [
		"bookmarks",
		"controls",
		"stations",
		"accountSelection"
	],

	recentStation: null,

	volume: 100
}


export type AnesidoraState = {
	currentEvent: AnesidoraFeedItem | null,
	eventHistory: AnesidoraFeedItem[],
	comingEvents: AnesidoraFeedItem[],

	/** Station token */
	currentStation: string | null,

	/** 0 < volume < 1 */
	volume: number,

	/**
	 * 0 < currentTime < duration.
	 * `null` if there is no current song.
	*/
	currentTime: null | number,
	/**
	 * Duration, in seconds, of the current song.
	 * `null` if there is no current song.
	 */
	duration: null | number,

	/**
	 * Note that this is NOT whether the audio is playing or not.
	 * This is whether the user has paused the audio.
	 * If the audio cannot play due to network conditions or
	 * any other reason, this can be false and audio would not play.
	 */
	isPaused: boolean
}


// ANCHOR: Internal utility functions

function throwHere(msg: string): never {
	console.error(`%cstore.ts: "${msg}"`, `
		color: #15799d;
		font-weight: bold;
		font-family: 'Inter', sans-serif;
	`)
	throw new Error(msg)
}

function logHere(...data: any[]) {
	console.log('%cstore.ts:', `
	color: #15799d;
	font-weight: bold;
	font-family: 'Inter', sans-serif;
	`, ...data)
}

// ANCHOR: Parse existing(?) config from localStorage

let actualConfig: AnesidoraConfig | null = null;
type RecursivePartial<T> = {
	[P in keyof T]?:
	T[P] extends (infer U)[] ? RecursivePartial<U>[] :
	T[P] extends object ? RecursivePartial<T[P]> :
	T[P];
};

try {
	let existingParsed: RecursivePartial<AnesidoraConfig> | null = null;
	const existing = localStorage.getItem(
		ANESIDORA_NAMESPACE
	);
	existingParsed = JSON.parse(existing);
	if (typeof existingParsed !== "object") {
		throwHere(`localStorage[${ANESIDORA_NAMESPACE}] not an object`);
	}
	
	function recursiveCheck(what: {}, against: {}, name: string) {
		for (let key in against) {
			if (typeof what[key] !== "undefined") {
				if (what[key] instanceof Object) {
					recursiveCheck(what[key], against[key], `${name}.${key}`);
				}
			} else {
				logHere(`${name}.${key} is undefined, using default ${against[key]}`)
				what[key] = against[key];
			}
		}
	}

	recursiveCheck(existingParsed, defaultConfig, 'config');

	let fullyParsed: AnesidoraConfig = <AnesidoraConfig>existingParsed;

	for (const user of fullyParsed.accounts) {
		if (user.populated) {
			delete user.userAuthToken;
			delete user.partnerAuthToken;
			delete user.partnerId;
			delete user.firstSyncTime;
			delete user.clientStartTime;
		}
	}
	
	actualConfig = fullyParsed;

	logHere('Successfully loaded existing config.')
} catch(e) {
	actualConfig = defaultConfig;
	localStorage.setItem(
		ANESIDORA_NAMESPACE,
		JSON.stringify(actualConfig)
	);
	logHere('Could not load any existing config; using default.')
}

// ANCHOR: Functions to interact with config

const listeners: Map<ListenerId, ConfigListener> = new Map();

function set(key: string, value: unknown): typeof value {
	let oldValue = getNestedProperty(actualConfig, key);
	setNestedProperty(actualConfig, key, value);

	fireListeners({
		key,
		oldValue,
		newValue: value
	})

	localStorage.setItem(
		ANESIDORA_NAMESPACE,
		JSON.stringify(actualConfig)
	);

	return value;
}

function fireListeners(data: ConfigListenerData): void {
	listeners.forEach(e => e(data));
}

function addListener(fn: ConfigListener): ListenerId {
	let newId: ListenerId;
	do {
		newId = Math.floor(Math.random() * 1e10).toString(16);
	} while (listeners.has(newId))

	listeners.set(
		newId,
		fn
	);

	return newId;
}

function removeListener(id: ListenerId): void {
	if (listeners.has(id)) {
		listeners.delete(id);
	} else {
		logHere(`removeListener: Listener ${id} does not exist in the first place`)
		console.trace();
	}
}

// ANCHOR: Exports

export {
	actualConfig,
	set,
	addListener,
	removeListener
}
