// ANCHOR: Top
// @ts-ignore
window.debugRequests = false;
/**
 * script.ts
 * Complete rewrite of {anesidora.js & background.js} for Typescript and multi-account support
 * 
 * Regions:
 * 1. Typedefs, imports, constants, util funcs
 * 
 * 2. Bootstrapping
 *      - Read settings from localStorage
 *      - Fire config off to any open popups (which there shouldn't be at startup, but who knows)
 *      - This is delegated to {@link store.ts}
 * 3. Pandorawide
 *      - SyncTime
 *      - UAToken
 *      - IDs 
 * 
 * 4. Pandora login
 *      - Once there are configured accounts, start partner & user login.
 *      - Initialize functions that require Pandora data
 *          - Bookmarks
 *          - Stations
 *          - Pandora settings
 * 
 * 5. Player functions
 *      - Everything needed for the player to function, in response to buttons, etc. Namely:
 *          - Add feedback
 *          - Play station
 *          - Skip songs
 *          - Bookmark songs & artists
 *          - Sleep songs
 *          - Everything related to editing stations
 * 
 * 6. Settings functions
 *      - Everything needed for the settings page to function.
 *          - Set/get player settings (LIVE UPDATE TO PLAYER)
 *          - Set/get Pandora settings
 *          - Add/remove Pandora credentials
 * 
 * 7. Misc listeners
 *      - First run detection
 *      - Message passing from popups / settings
 *      - WebRequest User-Agent changing
 * 
 * TODO: Settings for custom html/css for elements (stations/covers/controls/etc)?
 * TODO: Localization?
 * TODO: Document once done
 * TODO: "Do not register ads" config option
 */

// ANCHOR Imports, typedefs, constants, util funcs

import * as store from './store.js';
import { getBrowser, isAndroid } from './platform_specific.js'
import { AudioInfo, BASE_API_URL, Bookmarks, LinkishString, NumberishString, PandoraPlaylist, PandoraRating, PandoraRequestData, PandoraResponse, PandoraSong, PandoraStation, PandoraTime, PAPIError, PAPI_Method, PopulatedPandoraAd, PReq, PRes, ResponseOK, UnpopulatedPandoraAd } from './pandora.js';
import { formatParameters, stringToBytes } from './util.js';
import { decrypt, encrypt } from './crypt.js';
import type { Message, ToBgMessages, ToTabsMessages } from '../messages.js';
import type {
	OnBeforeSendHeadersDetails,
	HttpHeader
} from './webRequest'
import { getNestedProperty, setNestedProperty, TimedCache } from '../util.js';

function throwHere(msg: string): never {
	console.error(`%cbackground.ts: "${msg}"`, `
		color: #15799d;
		font-weight: bold;
		font-family: 'Inter', sans-serif;
	`)
	throw new Error(msg)
}

function logHere(...data: any[]) {
	console.log('%cbackground.ts:', `
	color: #15799d;
	font-weight: bold;
	font-family: 'Inter', sans-serif;
	`, ...data)
}

function errorHere(...data: any[]) {
	console.error('%cbackground.ts:', `
	font-weight: bold;
	font-family: 'Inter', sans-serif;
	`, ...data)
}


// ANCHOR Bootstrapping

// window.browser | window.chrome
const UA = getBrowser();

// ANCHOR Pandorawide

// The active account, if there is one.
let currentAccount: store.PandoraAccount | null = null;

// IIFE, so I can return
(() => {
	// Any accounts stored?
	if (store.actualConfig.accounts.length > 0) {
		// Yes!
		// Is there an account selected already or should we guess one?
		if (store.actualConfig.activeAccount !== null) {
			// Config says there is one!
			// Let's find it.
			let activeAccount = store.actualConfig.accounts.find(account => {
				account.email === store.actualConfig.activeAccount
			})
			// Is it real?
			if (activeAccount) {
				// Neat, set it and we're done
				currentAccount = activeAccount;
				return;
			} else {
				// :wail:
				// make sure we never fall for this again
				store.actualConfig.activeAccount = null;
			}
		}
		// Alright, can't find it based on config.activeAccount
		// Using ✨ advanced heuristic algorithms ✨, determine the correct account
		currentAccount = store.actualConfig.accounts[0];
		store.set('activeAccount', 0);
	}
})();


function calculateSyncTime(manualSync?: {
	firstSyncTime: number,
	clientStartTime: number
}) {
	if (!currentAccount && !manualSync) {
		throwHere(`calculateSyncTime: No active account`);
	}
	let uFST: number;
	let uCST: number;
	if (manualSync) {
		uFST = manualSync.firstSyncTime;
		uCST = manualSync.clientStartTime;
	} else {
		if (
			!('firstSyncTime' in currentAccount && 'clientStartTime' in currentAccount)) {
			throwHere(`calculateSyncTime: No firstSyncTime/clientStartTime`);
		}
		if (!currentAccount.firstSyncTime || !currentAccount.clientStartTime) {
			let whatsWrong: string[] = [];
			if (!currentAccount.firstSyncTime) {
				whatsWrong.push("firstSyncTime");
			}
			if (!currentAccount.clientStartTime) {
				whatsWrong.push("clientStartTime")
			}
			let properConjunction = (
				whatsWrong.length === 1 ?
				"is" : "are"
			);

			throwHere(`calculateSyncTime: ${
				whatsWrong.join(" and ")
			} ${
				properConjunction
			} undefined`)
		}
		uFST = currentAccount.firstSyncTime;
		uCST = currentAccount.clientStartTime;
	}

	const time = (new Date()).getTime();
	const now = parseInt(String(time).substr(0, 10));
	return uFST + (now - uCST);
}

/**
 * Will only return a successful request.
 * Throws on fail or network error.
 */
async function sendRequest<t>(
	method: PAPI_Method, 
	request: PandoraRequestData = {},
	additionalOpts: {
		/** Whether or not to use TLS. Overridden by config.forceSecure */
		secure?: boolean, 
		/** Whether or not to use Blowfish to encrypt request body. */
		encrypted?: boolean,
		/** How many times this has been retried. */
		depth?: number,
		/** Custom URL parameters */
		parameters?: {
			[key: string]: string
		}
	} = {
		secure: true,
		encrypted: true,
		depth: 0,
		parameters: {}
	}
): Promise<ResponseOK<t>> {
	const USE_ENCRYPTION = additionalOpts.encrypted ?? true;
	const USE_SECURE = store.actualConfig.forceSecure || additionalOpts.secure;
	const depth = additionalOpts.depth ?? 0;

	let url = `http${ USE_SECURE ? "s" : "" }://${BASE_API_URL}`;
	
	let parameters = "";

	if (currentAccount && currentAccount.populated) {
		let parameterObject: {
			auth_token?: string,
			partner_id?: string,
			user_id?: string
		} = {
			"auth_token": currentAccount.userAuthToken,
			"partner_id": currentAccount.partnerId,
			"user_id": currentAccount.userId,
			...(additionalOpts.parameters ?? {})
		};

		parameters = '&' + formatParameters(parameterObject);

		request.userAuthToken = request.userAuthToken ?? currentAccount.userAuthToken;

		if (currentAccount.firstSyncTime && currentAccount.clientStartTime) {
			request.syncTime = request.syncTime ?? calculateSyncTime();
		}
	} else if (Object.keys(additionalOpts.parameters ?? {}).length > 0) {
		parameters = '&' + formatParameters(additionalOpts.parameters);
	}


	const req_encrypted = (
		USE_ENCRYPTION ?
			encrypt(JSON.stringify(request)) :
			JSON.stringify(request)
	);

	let response = await fetch(url + method + parameters, {
		method: "POST",
		headers: {
			"Content-Type": additionalOpts.encrypted ? "text/plain" : "application/json"
		},
		body: req_encrypted
	});

	let responseData: PandoraResponse<t> = await response.json();

	if (responseData.stat === "fail") {
		if (responseData.code === 1001 && depth === 0) {
			try {
				if (currentAccount) {
					await loginAndPopulate(currentAccount.email, currentAccount.password);
				} else {
					throw "yeet";
				}
			} catch(e) {
				// @ts-expect-error Yeah, this isn't usually on the window object.
				if (window.debugRequests) {
					console.group(method);
					console.log(parameters, request);
					console.log("Error:", responseData);
					console.groupEnd();
				}
				errorHere("Bad credentials, could not recover");
			}
			return await sendRequest<t>(method, request, {
				...additionalOpts,
				depth: depth + 1
			});
		} else {
			// @ts-expect-error Yeah, this isn't usually on the window object.
			if (window.debugRequests) {
				console.group(method);
				console.log(parameters, request);
				console.log("Error:", responseData);
				console.groupEnd();
			}
			throw new PAPIError(responseData);
		}
	}
	// @ts-expect-error Yeah, this isn't usually on the window object.
	if (window.debugRequests) {
		console.group(method);
		console.log(parameters, request);
		console.log("Response", responseData);
		console.groupEnd();
	}
	return responseData;
}

// ANCHOR Pandora login

async function loginAndPopulate(email: string, password: string): Promise<void> {
	if (!email || !password) {
		throwHere(`loginAndPopulate: email or password undefined`)
	}

	let validateReq: PReq.user.validateUsername = {
		username: email
	};
	let validateRes = await sendRequest<PRes.user.validateUsername>(
		'user.validateUsername',
		validateReq, {
			encrypted: false
		}
	)
	if (!validateRes.result.isValid) {
		throw new Error('Username not valid');
	}

	let partnerReq: PReq.auth.partnerLogin = {
		username: "android",
		password: "AC7IBG09A3DTSYM4R41UJWL07VLN8JI7",
		version: "5",
		deviceModel: "android-generic",
		includeUrls: true
	};
	let partnerRes = await sendRequest<PRes.auth.partnerLogin>(
		"auth.partnerLogin", 
		partnerReq, 
		{
			secure: true,
			encrypted: false,
		}
	);

	let b = stringToBytes(decrypt(partnerRes.result.syncTime));
	// skip 4 bytes of garbage
	let s = "";
	for (let i = 4; i < b.length; i++) {
		s += String.fromCharCode(b[i]);
	}
	// synctime
	let sT = parseInt(s);
	// client start time
	let cST = parseInt((new Date().getTime() + "").substr(0, 10));

	let userReq: PReq.auth.userLogin = {
		loginType: "user",
		username: email,
		password: password,
		partnerAuthToken: partnerRes.result.partnerAuthToken,
		syncTime: calculateSyncTime({
			firstSyncTime: sT,
			clientStartTime: cST
		})
	};

	let userRes = await sendRequest<PRes.auth.userLogin>(
		"auth.userLogin",
		userReq, {
			parameters: {
				auth_token: partnerRes.result.partnerAuthToken,
				partner_id: partnerRes.result.partnerId
			}
		}
	);
	let r = userRes.result;


	let newAccount: store.PopulatedPandoraAccount = {
		email,
		password,
		populated: true,
		pictureUrl: null,
		userId: r.userId,
		userAuthToken: r.userAuthToken,
		partnerAuthToken: partnerRes.result.partnerAuthToken,
		partnerId: partnerRes.result.partnerId,
		firstSyncTime: sT,
		clientStartTime: cST
	}

	currentAccount = newAccount;

	let bookmarks = await getBookmarks();

	currentAccount.bookmarks = bookmarks;

	let index = store.actualConfig.accounts.findIndex(e => e.email === currentAccount.email);
	if (index !== -1) {
		store.actualConfig.accounts.splice(
			index,
			1
		);	
	}

	store.set(
		'accounts',
		[
			...store.actualConfig.accounts,
			currentAccount
		]
	)

	store.set(
		'activeAccount',
		store.actualConfig.accounts.findIndex(e => e.email === currentAccount.email)
	);

	logHere(`Logged in as ${currentAccount.email} sucessfully.`)
}

// @ts-ignore
window.loginAndPopulate = loginAndPopulate;


// ANCHOR: Player state & functions

const listeners = new Map<string, (msg: Message) => void>();

function messageTabs(name: Message['name'], data: Message['data']): void {
	UA.runtime.sendMessage({
		name,
		data,
		toBg: false
	} as Message);
}

const playerAudio = document.querySelector<HTMLAudioElement>("#playerAudio");

if (!playerAudio) {
	throwHere("playerAudio is undefined");
}

const playerState: store.AnesidoraState = {
	currentEvent: null,
	eventHistory: [],
	comingEvents: [],
	volume: store.actualConfig.volume ?? 1,

	currentStation: store.actualConfig.recentStation ?? null,

	isPaused: true,
	currentTime: null,
	duration: null
}

playerAudio.addEventListener("pause", () => {
	pause(false);
})
playerAudio.addEventListener("play", () => {
	play(false);
});
playerAudio.addEventListener("timeupdate", () => {
	seekTo(playerAudio.currentTime, false);
})
playerAudio.addEventListener("ended", playNextItem);
playerAudio.addEventListener("error", playNextItem);

function fixArtUrl(artUrl: string | undefined): string {
	//http://mediaserver-cont-sv5-2-v4v6.pandora.com/images/b0/51/06/96/e5ef40b794ab021bd28d275c/500W_500H.jpg
	let aurl = artUrl;
	if (aurl && aurl.length !== 0) {
		if (aurl.startsWith('http://')) {
			aurl = aurl.replace('http://', 'https://');
		}
		if (aurl.split('/images')[1] &&
			aurl.split('/images')[1].split('/').length < 6) {
			// Pandora sometimes sends malformed image URLs, like so:
			// http://mediaserver-cont-sv5-2-v4v6.pandora.com/imagesb0510696e5ef40b794ab021bd28d275c
			// Fortunately, it's fixable.
			let turl = [...aurl.split('/images')[1]];
			for (let i = 0; i < 5; i++) {
				turl.splice(3*i, 0, '/');
			}
			aurl = [
				aurl.split('/images')[0],
				'/images',
				turl.join(''),
				'/500W_500H.jpg'
			].join('');
		}
	}
	return aurl;
}

const cachedBookmarks = new TimedCache<string, PRes.user.getBookmarks>(30 * 1000);


async function getBookmarks(force = false): Promise<Bookmarks> {
	if (!currentAccount || !currentAccount.populated) {
		return {
			artists: [],
			songs: []
		}
	}
	if (!cachedBookmarks.get(currentAccount.email, force)) {
		let res: ResponseOK<PRes.user.getBookmarks>;
		try {
			res = await sendRequest('user.getBookmarks');
		} catch(e) {
			errorHere(`user.getBookmarks: `, new PAPIError(e));
			return {
				artists: [],
				songs: []
			}
		}

		res.result.artists = res.result.artists.map(item => {
			item.artUrl = fixArtUrl(item.artUrl);
			return item;
		})
		res.result.songs = res.result.songs.map(item => {
			item.artUrl = fixArtUrl(item.artUrl);
			return item;
		})

		if (JSON.stringify(res.result) !== JSON.stringify(cachedBookmarks.get(currentAccount.email))) {
			messageTabs("toTabs_bookmarksUpdated", res.result);
		}
		cachedBookmarks.set(currentAccount.email, res.result)
		return res.result;
	} else {
		return cachedBookmarks.get(currentAccount.email);
	}
}

/**
 * Gets a playlist for a station from Pandora.
 * Doing this invalidates the play tokens for previous items from that station.
 * 
 * @param token The station token to obtain a playlist for.
 * @param starting Sets `stationIsStarting` to true.
 * No functional difference in behavior as far as I can tell.
 * @returns {Promise<store.AnesidoraFeedItem>}
 */
async function getPlaylist(token: string, starting: boolean): Promise<store.AnesidoraFeedItem[]> {
	let req: PReq.station.getPlaylist = {
		stationToken: token,
		stationIsStarting: starting,
		includeTrackOptions: true,
		includeTrackLength: true
	}

	try {
		let res = await sendRequest<PRes.station.getPlaylist>(
			'station.getPlaylist',
			req
		);

		let resItems: store.AnesidoraFeedItem[] = [];
		
		for (let currEvent of res.result.items) {
			if ('adToken' in currEvent) {
				if (!store.actualConfig.certification.autoSkipAds) {
					continue;
				}
				if (!currEvent.populated) {
					try {
						resItems.push(await fetchAdMetadata(<UnpopulatedPandoraAd>currEvent));
					} catch(e) {
						// Unrecoverable - Pandora API doesn't like us right now :(
					}
				}
			} else {
				let newEvent = <store.AnesidoraFeedItem>currEvent;
				newEvent.uniqueSessionId = genUniqueID(currEvent.trackToken);
				resItems.push(newEvent);
			}
		}



		return resItems;
	} catch(e) {
		errorHere(`station.getPlaylist: `, new PAPIError(e));
		throw e;
	}
}

async function play(actuallyPlay = true) {
	if (!(playerState.currentStation || playerState.currentEvent)) {
		return;
	}
	if (playerState.isPaused) {
		if (actuallyPlay) {
			await playerAudio.play();
		}
		messageTabs('toTabs_stateChanged', {
			key: 'isPaused',
			oldValue: playerState.isPaused,
			newValue: false
		})
		playerState.isPaused = false;
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'playing';
		}
		messageTabs('toTabs_resetPlay', false);
	}
}
async function pause(actuallyPause = true) {
	if (!playerState.isPaused) {
		if (actuallyPause) {
			playerAudio.pause();
		}
		messageTabs('toTabs_stateChanged', {
			key: 'isPaused',
			oldValue: playerState.isPaused,
			newValue: true
		})
		playerState.isPaused = true;
		if ('mediaSession' in navigator) {
			navigator.mediaSession.playbackState = 'paused';
		}
		messageTabs('toTabs_resetPlay', true);
	}
}

async function seekTo(time: number, actuallySeek = true) {
	try {
		if (actuallySeek) {	
			playerAudio.currentTime = time;
		}
	} finally {
		if (!isNaN(playerAudio.currentTime)) {
			playerState.currentTime = playerAudio.currentTime;
			messageTabs('toTabs_seekBarAck', playerAudio.currentTime);
		} else {
			playerState.currentTime = null;
		}
	}
}

// TODO: AudioSession
async function updateMediaSession(currSong: store.AnesidoraFeedItem) {
	let metadata = navigator.mediaSession.metadata;
    
	if ('trackToken' in currSong) {
		if (!metadata || (
			metadata.title != currSong.songName ||
			metadata.artist != currSong.artistName ||
			metadata.artwork[0].src != currSong.albumArtUrl)
			) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currSong.songName,
				artist: currSong.artistName,
				artwork: currSong.albumArtUrl && currSong.albumArtUrl.length !== 0 ?
					[{ src: currSong.albumArtUrl, sizes: '500x500', type: 'image/jpeg' }] :
					[]
			});
		}
	} else if ('adToken' in currSong) {
		if (!metadata || (
			metadata.title != currSong.title ||
			metadata.artist != currSong.companyName ||
			metadata.artwork[0].src != currSong.imageUrl)
			) {
			navigator.mediaSession.metadata = new MediaMetadata({
				title: currSong.title,
				artist: currSong.companyName,
				artwork: currSong.imageUrl && currSong.imageUrl.length !== 0 ?
					[{ src: currSong.imageUrl, sizes: '500x500', type: 'image/jpeg' }] :
					[]
			});
		}
	}

	if (playerAudio.paused) {
        navigator.mediaSession.playbackState = "paused";
    } else {
        navigator.mediaSession.playbackState = "playing";

        if (!isNaN(playerAudio.duration)) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: playerAudio.duration,
                    position: playerAudio.currentTime,
                    playbackRate: 1
                });
            } catch (e) {}
        }
    }
}

async function setupMediaSession() {
	if (!('mediaSession' in window.navigator)) {
		return;
	}
	navigator.mediaSession.setActionHandler("play", () => {
		if (playerAudio.paused || playerState.isPaused) {
			play();
		} else {
			// Why is this available?
			logHere(`Tried to play while already playing.`)
			messageTabs('toTabs_playButton', false);
		}
	})
	navigator.mediaSession.setActionHandler("pause", () => {
		if (!(playerAudio.paused || playerState.isPaused)) {
			pause();
		} else {
			logHere(`Tried to pause while already paused.`)
			messageTabs('toTabs_playButton', true);
		}
	})
	navigator.mediaSession.setActionHandler("seekto", details => seekTo(details.seekTime));
	navigator.mediaSession.setActionHandler("previoustrack", () => seekTo(0));
	navigator.mediaSession.setActionHandler("nexttrack", () => playNextItem());
}
let uniqueTokens = new Map<string, number>();

function genUniqueID(token: string) {
	if (uniqueTokens.has(token)) {
		uniqueTokens.set(token, uniqueTokens.get(token) + 1);
		return token + uniqueTokens.get(token);
	} else {
		uniqueTokens.set(token, 0);
		return token + 0;
	}
}

async function fetchAdMetadata(ad: UnpopulatedPandoraAd): Promise<PopulatedPandoraAd> {
	let req = <PReq.ad.getAdMetadata>{
		adToken: ad.adToken,
		supportAudioAds: true,
		returnAdTrackingTokens: true
	}
	let res: PRes.ad.getAdMetadata;
	try {
		res = (await sendRequest<PRes.ad.getAdMetadata>(
			'ad.getAdMetadata',
			req
		)).result;
	} catch(e) {
		throw new PAPIError(e);
	}
	if ('audioUrlMap' in res && res.audioUrlMap) {
		// Typescript
		let resWithAudioUrlMap = <typeof res & {
			audioUrlMap: Required<typeof res>['audioUrlMap']
		}>res;
		return {
			...resWithAudioUrlMap,
			uniqueSessionId: genUniqueID(ad.adToken),
			populated: true,
			adToken: ad.adToken
		};
	} else {
		throwHere("Ad did not have audioUrlMap")
	}
}

async function playNextItem() {
	messageTabs('toTabs_skipButton', undefined);
	if (playerState.currentEvent) {
		playerState.eventHistory.push(playerState.currentEvent);
	}
	let oldCurrEvent = playerState.currentEvent;
	playerState.currentEvent = null;

	if (playerState.comingEvents.length === 0) {
		if (playerState.currentStation) {
			playerState.comingEvents = await getPlaylist(playerState.currentStation, false);
		} else if (store.actualConfig.lastUsedStation) {
			messageTabs('toTabs_stateChanged', {
				key: 'currentStation',
				newValue: store.actualConfig.lastUsedStation,
				oldValue: playerState.currentStation
			})
			playerState.currentStation = store.actualConfig.lastUsedStation;
			playerState.comingEvents = await getPlaylist(store.actualConfig.lastUsedStation, false);
		} else {
			messageTabs('toTabs_resetSkip', undefined);
			return;
		}
	}
	playerState.currentEvent = playerState.comingEvents.shift();

	let currEvent = playerState.currentEvent;

	if ('adToken' in currEvent) {
		if (store.actualConfig.certification.autoSkipAds) {
			return await playNextItem();
		}
		playerState.currentEvent = currEvent;

		if (currEvent.adTrackingTokens) {
			for (let t of currEvent.adTrackingTokens) {
				try {
					await sendRequest(
						'ad.registerAd',
						<PReq.ad.registerAd>{
							stationId: playerState.currentStation,
							adTrackingTokens: t
						}
					);
				} catch(e) {
					// We really don't care if this errors.
					// It's optional in the first place.
				}
			}
		}

		// TODO: Config option for preference on high/med/low quality audio
		// TODO: Preloading?
		playerAudio.src =
			currEvent.audioUrlMap.highQuality?.audioUrl ??
			currEvent.audioUrlMap.mediumQuality?.audioUrl ??
			currEvent.audioUrlMap.lowQuality?.audioUrl;

		try {
			await playerAudio.play();
		} catch(e) {
			return await playNextItem();
		} finally {
			updateMediaSession(currEvent);
			playerState.duration = playerAudio.duration;
			messageTabs("toTabs_updatedFeed", {
				history: playerState.eventHistory,
				curr: playerState.currentEvent,
				next: playerState.comingEvents,
				newDuration: playerAudio.duration
			})
			messageTabs('toTabs_resetSkip', undefined);
		}
	} else if ('trackToken' in currEvent) {
		// TODO: Config option for preference on high/med/low quality audio
		// TODO: Preloading?
		if (currEvent.additionalAudioUrl) {
			if (currEvent.additionalAudioUrl instanceof Array) {
				playerAudio.src = currEvent.additionalAudioUrl[0];
			} else {
				playerAudio.src = currEvent.additionalAudioUrl;
			}
		} else {
			playerAudio.src =
				currEvent.audioUrlMap.highQuality?.audioUrl ??
				currEvent.audioUrlMap.mediumQuality?.audioUrl ??
				currEvent.audioUrlMap.lowQuality?.audioUrl;
		}

		try {
			await playerAudio.play();
		} catch(e) {
			await playNextItem();
		} finally {
			updateMediaSession(currEvent);
			playerState.duration = playerAudio.duration;
			messageTabs("toTabs_updatedFeed", {
				history: playerState.eventHistory,
				curr: playerState.currentEvent,
				next: playerState.comingEvents,
				newDuration: playerAudio.duration
			})
			messageTabs('toTabs_resetSkip', undefined);
		}
	} else {
		if (currEvent.handledYet) {
			return await playNextItem();
		}
		switch (currEvent.eventType) {
			case 'stationChange':
				playStation(currEvent.data.to.stationToken);
				return;
		}
	}

}

async function playStation(token: string) {
	let oldStation = await getStation(playerState.currentStation);
	let newStation = await getStation(token);
	if (!newStation) {
		return;
	}
	playerState.currentStation = token;
	store.set('lastUsedStation', token);
	messageTabs('toTabs_playingStation', token);
	playerState.comingEvents = await getPlaylist(token, true);
	if (playerState.currentEvent) {
		playerState.eventHistory.push(playerState.currentEvent);
	}
	playerState.currentEvent = null;
	playerState.eventHistory.push({
		isEvent: true,
		eventType: 'stationChange',
		handledYet: true,
		data: {
			from: oldStation,
			to: newStation
		},
		uniqueSessionId: genUniqueID(token)
	})
	await playNextItem();
	messageTabs('toTabs_stationResolved', token);
}


const cachedStations = new TimedCache<string, PandoraStation[]>(1000 * 30);

async function getStation(token: string): Promise<PandoraStation | null> {
	let stations = await getStations(false);
	let station = stations.find(e => e.stationToken === token);
	if (station) {
		return station;
	} else {
		return null;
	}
}

async function getStations(force=false): Promise<PandoraStation[]> {
	if (!currentAccount || !currentAccount.populated) {
		return []
	}
	if (!cachedStations.get(currentAccount.email, force)) {
		let req: PReq.user.getStationList = {
			includeAdAttributes: true,
			includeExplanations: true,
			includeStationArtUrl: true,
			stationArtSize: `W200H200`,
			includeStationSeeds: true
		}
	
		let res: ResponseOK<PRes.user.getStationList>;
		
		try {
			res = await sendRequest<PRes.user.getStationList>(
				'user.getStationList',
				req
			);	
		} catch(e) {
			errorHere(`user.getStationList: `, new PAPIError(e))
			return [];
		}
	

		if (JSON.stringify(res.result) !== JSON.stringify(cachedStations.get(currentAccount.email))) {
			messageTabs("toTabs_stationsUpdated", res.result.stations);
		}
		cachedStations.set(currentAccount.email, res.result.stations)
		return res.result.stations;
	} else {
		return cachedStations.get(currentAccount.email);
	}
}

/**
 * Sends a request to Pandora to dis/like a song.
 * @param stationToken The station to dis/like on. 
 * @param trackToken The song to dis/like.
 * @param rating What to rate.
 */
async function setFeedback(
	stationToken: string,
	trackToken: string,
	rating: PandoraRating
): Promise<"failed" | PandoraRating> {
	if (rating === PandoraRating.UNRATED || !PandoraRating[rating]) {
		logHere(`Invalid rating ${rating}. Must be ${PandoraRating.THUMBS_DOWN} or ${PandoraRating.THUMBS_UP}`);
		return 'failed';
	}
	try {
		let res = await sendRequest<PRes.station.addFeedback>(
			'station.addFeedback',
			<PReq.station.addFeedback>{
				stationToken,
				trackToken,
				isPositive: rating === PandoraRating.THUMBS_UP
			}
		);
		let asEnum = (res.result.isPositive ?
			PandoraRating.THUMBS_UP :
			PandoraRating.THUMBS_DOWN
		);
		function findAndUpdate(e?: store.AnesidoraFeedItem) {
			if (e && 'trackToken' in e && e.trackToken === trackToken) {
				e.songRating = asEnum;
			}
		}

		playerState.comingEvents.forEach(findAndUpdate);
		playerState.eventHistory.forEach(findAndUpdate);
		findAndUpdate(playerState.currentEvent)

		return asEnum;
	} catch(e) {
		errorHere(`station.addFeedback: `, new PAPIError(e))
		return 'failed';
	}
}

async function playPauseButton() {
	if (!playerState.currentStation) {
		if (store.actualConfig.lastUsedStation) {
			await playStation(store.actualConfig.lastUsedStation);
			return;
		} else {
			return;
		}
	}
	if (playerState.isPaused) {
		await play();
	} else {
		await pause();
	}
}
// @ts-ignore
window.playerState = playerState;

// ANCHOR Misc listeners
UA.runtime.onMessage.addListener(
	(
		message: Message,
		_sender: unknown,
		sendResponse: (...args: unknown[]) => void
	) => {
		if (message.toBg) {
			handleMessage(message).then((res) => {
				logHere(`In response to ${message.name}, sending `, res);
				sendResponse(res);
			});
			return true;
		} else {
			return false;
		}
	}
)

// @ts-ignore
window.sendMessage = messageTabs;

async function handleMessage(message: ToBgMessages): Promise<unknown> {
	if (!message.toBg) {
		return;
	}
	switch (message.name) {
		case 'toBg_getConfig': 
			return {
				...store.actualConfig,
				accounts: store.actualConfig.accounts.map(e => ({
					...e,
					password: "[[ This is not a real password ]]"
				}))
			};

		case 'toBg_getState':
			return playerState;

		case 'toBg_getBookmarks':
			return await getBookmarks(message.data);

		case 'toBg_getStations':
			return await getStations(message.data);

		case 'toBg_coverPlayButtonPress':
		case 'toBg_playButton':
			messageTabs('toTabs_playButton', undefined);
			await playPauseButton();
			messageTabs('toTabs_resetPlay', playerState.isPaused);
			return;
		
		case 'toBg_skipButton':
			await playNextItem();
			messageTabs('toTabs_resetSkip', undefined);
			return;

		case 'toBg_removeFromQueue':
			let i = playerState.comingEvents.findIndex(
				event => event.uniqueSessionId === message.data
			);
			if (i !== -1) {
				playerState.comingEvents.splice(i, 1);
				messageTabs('toTabs_removedFromQueue', message.data);
			}
			return;

		case 'toBg_seekBarDrag':
			await seekTo(message.data);
			return;

		case 'toBg_setFeedback':
			messageTabs('toTabs_settingFeedback', message.data);

			let res: 'failed' | PandoraRating;
			try {
				res = await setFeedback(message.data.stationToken, message.data.trackToken, message.data.rating);
			} finally {
				if (res === 'failed') {
					return;
				}
				messageTabs('toTabs_feedbackSet', {
					trackToken: message.data.trackToken,
					stationToken: message.data.stationToken,
					rating: res
				});
			}
			return;

		case 'toBg_playStation':
			await playStation(message.data);
			return;




//			logHere(`Handled unhandled ${message.name}`)
//			return;
		
		default:
			logHere("Unhandled onMessage: ", message);
			return;
	}
}

store.addListener((opts) => messageTabs("toTabs_configChanged", opts));

function setState(key: string, value: unknown): typeof value {
	let oldValue = getNestedProperty(playerState, key);
	setNestedProperty(playerState, key, value);

	messageTabs("toTabs_stateChanged", {
		key,
		oldValue,
		newValue: value
	})
	return value;
}

UA.webRequest.onBeforeSendHeaders.addListener(
	(details: OnBeforeSendHeadersDetails) => {
		const h: HttpHeader[] = details.requestHeaders;

		for (let header of h) {
			if (header.name.toLowerCase() === "user-agent") {
				header.value = "libcurl";
			}
		}
		return {requestHeaders: h};
	},
	{
		urls: [
			"http://*.pandora.com/services/json/*",
			"https://*.pandora.com/services/json/*",
		]
	},
	["blocking", "requestHeaders"]
);


if (currentAccount) {
	await loginAndPopulate(currentAccount.email, currentAccount.password);
}
setupMediaSession();
if (!(await isAndroid())) {
	getBrowser().commands.onCommand.addListener(command => {
		logHere(`Received command ${command}.`)
		if (command === "pause_play") {
			playPauseButton();
		} else if (command === "skip_song") {
			playNextItem();
		}
	});
}

/*
let hue = 0;
const can = document.createElement("canvas");
const ctx = can.getContext('2d');

can.width = 50;
can.height = 50;


function draw() {
	if (hue > 359) {
		hue = 0;
	} else {
		hue += 10;
	}

	ctx.clearRect(0, 0, can.width, can.height);

	const grad = ctx.createLinearGradient(0, 0, can.width, can.height);
	grad.addColorStop(0, `hsl(${hue}deg 100% 60%)`);
	grad.addColorStop(1, `hsl(${hue}deg 100% 30%)`);
	
	ctx.lineWidth = can.width / 7;

	ctx.strokeStyle = grad;
	ctx.fillStyle = "transparent"
	ctx.strokeRect(0, 0, can.width, can.height)

	ctx.fillStyle = grad;
	ctx.strokeStyle = "transparent";

	ctx.font = (can.width * 0.9) + 'px serif';

	const meas = ctx.measureText("A");

	ctx.fillText("A", (can.width / 2) - (meas.width / 2), (can.height / 2) - (
		meas.actualBoundingBoxDescent - meas.actualBoundingBoxAscent
	) / 2)


	UA.browserAction.setIcon({
		imageData: ctx.getImageData(0, 0, can.width, can.height)
	});
}
setInterval(draw, 250);*/