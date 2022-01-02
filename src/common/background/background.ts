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
 */

// ANCHOR Imports, typedefs, constants, util funcs

import * as store from './store.js';
import { getBrowser } from './platform_specific.js'
import { AudioInfo, BASE_API_URL, Bookmarks, LinkishString, NumberishString, PandoraPlaylist, PandoraRating, PandoraRequestData, PandoraResponse, PandoraSong, PandoraStation, PandoraTime, PAPIError, PReq, PRes, ResponseOK } from './pandora.js';
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
	method: string, 
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

//playerAudio.addEventListener("timeupdate", () => {
//playerAudio.addEventListener('ended', () => {

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

async function getPlaylist(token: string, starting: boolean) {
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

		return res.result.items;
	} catch(e) {
		errorHere(`station.getPlaylist: `, new PAPIError(e));
	}
}


const cachedStations = new TimedCache<string, PandoraStation[]>(1000 * 30);

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
			return store.actualConfig;

		case 'toBg_getState':
			return playerState;

		case 'toBg_getBookmarks':
			return await getBookmarks(message.data);

		case 'toBg_getStations':
			return await getStations(message.data);

		case 'toBg_coverPlayButtonPress':
		case 'toBg_playButton':
			messageTabs('toTabs_playButton', undefined);
			await new Promise((res) => setTimeout(res, 2000));
			messageTabs('toTabs_resetPlay', playerState.isPaused);
			return;
		
		case 'toBg_skipButton':
			messageTabs('toTabs_skipButton', undefined);
			await new Promise((res) => setTimeout(res, 2000));
			messageTabs('toTabs_resetSkip', undefined);
			return;

		case 'toBg_removeFromQueue':
			let i = playerState.comingEvents.findIndex(event => (
				('trackToken' in event) ?
					event.trackToken === message.data :
					(
						('adToken' in event) ?
							event.adToken === message.data : false
					)
			));
			if (i !== -1) {
				playerState.comingEvents.splice(i, 1);
				messageTabs('toTabs_removedFromQueue', message.data);
			}
			return;

		case 'toBg_seekBarDrag':
			try {
				playerAudio.currentTime = message.data;
			} finally {
				messageTabs('toTabs_seekBarAck', playerAudio.currentTime);
			}
			return;

		case 'toBg_setFeedback':
		case 'toBg_skipButton':
		case 'toBg_playStation':
			logHere(`Handled unhandled ${message.name}`)
			return;
		
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