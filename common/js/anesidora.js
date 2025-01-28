"use strict"
/*globals $, encrypt, decrypt, currentSong, play, prevSongs*/
/*exported addFeedback, explainTrack, search, createStation, sleepSong, setQuickMix, deleteStation */

/** @link {http://stackoverflow.com/questions/1240408/reading-bytes-from-a-javascript-string} */
function stringToBytes(str) {
    var ch, st, re = [];
    for(var i = 0; i < str.length; i ++) {
        ch = str.charCodeAt(i);  // get char
        st = [];                 // set up "stack"
        do {
            st.push(ch & 0xFF);  // push byte to stack
            ch = ch >> 8;          // shift value down by 1 byte
        }
        while (ch);
        // add stack contents to result
        // done because chars have "wrong" endianness
        re = re.concat(st.reverse());
    }
    // return an array of bytes
    return re;
}

var currentStationToken = null;
var stationsArray = [];
var stationsByToken = {};
var currentPlaylist = [];

let maxRetries = 2;
/**
 * Purposeful var here: `let` doesn't put properties on window object, so inaccessible to popup window
 * If authToken is `null`, it has expired.
 * @typedef {{logged_in: true, credsSeemGood: boolean, email: string, authToken: string | null, userId: string }} LoggedInUserInfo
 * @typedef {{logged_in: false, credsSeemGood: boolean, email: never, authToken: never, userId: never}} LoggedOutUserInfo
 * @type {LoggedOutUserInfo | LoggedInUserInfo} */
var currentUserInfo = {
    logged_in: false,
    credsSeemGood: true
}

/** @type {{partnerId: null, authToken: null, syncTime: never, clientStartTime: never} | {partnerId: string, authToken: string, syncTime: number, clientStartTime: number}} */
let partnerInfo = {
    partnerId: null,
    authToken: null
}

function getSyncTime() {
    let time = (new Date()).getTime();
    let now = parseInt(String(time).substring(0, 10), 10);
    return parseInt(partnerInfo.syncTime) + (now - partnerInfo.clientStartTime);
}

/** @type {(methodOrParams: string | Record<string, string>, body: Record<string, unknown>, secure?: boolean, encrypted?: boolean, currentRetry?: number) => Promise<{ ok: true, response: unknown, reason: never } | { ok: false, reason: string, response: Response }>}*/
async function sendRequest(methodOrParams, body, forceSecure = false, encrypted = true, retries = 0) {
    let url;
    if (localStorage.forceSecure === "true" || forceSecure) {
        url = "https://tuner.pandora.com/services/json/?";
    } else {
        url = "http://tuner.pandora.com/services/json/?";
    }
    let userDefinedParams = {};
    if (typeof methodOrParams === 'string') {
        userDefinedParams = {
            method: methodOrParams
        }
    } else {
        userDefinedParams = methodOrParams;
    }

    let parameterObject = null;
    if (currentUserInfo.authToken) {
        parameterObject = {
            auth_token: currentUserInfo.authToken,
            partner_id: partnerInfo.partnerId,
            user_id: currentUserInfo.userId,
            ...userDefinedParams
        };
    } else {
        parameterObject = userDefinedParams;
    }

    let parameters = new URLSearchParams(parameterObject).toString();
    let maybe_encrypted_body = encrypted ? encrypt(JSON.stringify(body)) : JSON.stringify(body);
    /** @type {string} */
    let response;
    /** @type {Response} */
    let realResponse;
    try {
        realResponse = await fetch(url + parameters, {
            method: 'POST',
            headers: {
                "Content-Type": encrypted ? 'text/plain' : 'application/json'
            },
            body: maybe_encrypted_body
        })
        response = await realResponse.json()
    } catch(e) {
        // Retry.
        // 99% it'll be a network error.

        if (retries < maxRetries) {
            await new Promise(res => setTimeout(res, ((2**retries)-1) * 1000));
            // First retry would take one second,
            // Second would take three,
            // Third would take seven.
            // Current max is three, but next retry would take fifteen seconds.
            return await sendRequest(methodOrParams, body, forceSecure, encrypted, retries + 1)
        } else {
            return {
                ok: false,
                reason: "Network error. Can you connect to pandora.com?",
                response: realResponse
            }
        }
    } finally {
        // @ts-expect-error Yeah, this isn't usually on the window object.
        if (window.debugRequests) {
            console.group(parameterObject.method);
            console.log(parameterObject, body);
            console.log("Response");
            console.log(response);
            console.groupEnd();
        }
    }
    
    if (response.stat === "fail") {
        switch (response.code) {
            case 0:
                // Purposefully do not retry.
                return {
                    ok: false,
                    reason: "Internal Pandora error. Might be rate limited.",
                    response
                };
                break; // Should never fallthrough

            case 1001: // INVALID_AUTH_TOKEN, occurs once a user auth token expires.
                if (currentUserInfo.credsSeemGood) {
                    // DO retry - but first, refresh user auth token.
                    currentUserInfo.credsSeemGood = false; // This will be set back in userLogin.
                    currentUserInfo.authToken = null;
                    let partnerResult = await partnerLogin();
                    if (!partnerResult.ok) {
                        break;
                    }
                    let userLoginResult = await userLogin(localStorage.getItem('username'), localStorage.getItem('password'));
                    if (userLoginResult.ok) {
                        console.info("Relogged to refresh auth token.");
                    }
                    break;
                } else {
                    // DO NOT retry.
                    return {
                        ok: false,
                        reason: "User auth token expired, and could not be refreshed.",
                        response
                    }
                }
                break; // Should never fallthrough

            default:
                console.log("sendRequest failed: ", parameters, body, response);
        }

        if (retries < maxRetries) {
            await new Promise(res => setTimeout(res, ((2**retries)-1) * 1000));
            // First retry would take one second,
            // Second would take three,
            // Third would take seven.
            // Current max is three, but next retry would take fifteen seconds.
            return await sendRequest(methodOrParams, body, forceSecure, encrypted, retries + 1)
        } else {
            return {
                ok: false,
                reason: `Max retries reached. Response code: ${response.code}`,
                response
            }
        }
    } else {
        return {
            ok: true,
            response
        };
    }
}

/** @type {number | null} */
let lastStationsRefresh = null;
async function throttleRefreshStationsList(timeout=120) {
    if (lastStationsRefresh && lastStationsRefresh < (Date.now() + (timeout*1000))) {
        return;
    }

    lastStationsRefresh = Date.now();
    await refreshStationsList();
}

/** @type {{ok: true, reason: never } | {ok: false, reason: string }} */
async function refreshStationsList() {
    let body = {
        "userAuthToken": currentUserInfo.authToken,
        "syncTime": getSyncTime(),
        includeStationArtUrl: true
    };
    let request = await sendRequest("user.getStationList", body);
    if (!request.ok) {
        return {
            ok: false,
            reason: request.reason
        };
    }

    stationsArray = request.response.result.stations;
    stationsByToken = {};
    stationsArray.forEach(e => {
        stationsByToken[e.stationToken] = e;
    })

    return { ok: true };
}


/**
 * @param {string} email 
 * @param {string} password 
 * @returns {Promise<{ ok: false, reason: string } | { ok: true, reason: never }>}
 */
async function userLogin(email, password) {
    if (!partnerInfo.partnerId || !partnerInfo.authToken) {
        let partnerResult = await partnerLogin();
        if (!partnerResult.ok) {
            return partnerResult;
        }
    }

    if (email && password) { 
        let body = {
            "loginType": "user",
            "username": email,
            "password": password,
            "partnerAuthToken": partnerInfo.authToken,
            "syncTime": getSyncTime()
        };
        let parameters = {
            method: 'auth.userLogin',
            auth_token: partnerInfo.authToken,
            partner_id: partnerInfo.partnerId
        }

        let loginRequest = await sendRequest(parameters, body, true, true, maxRetries /* do not retry */);
        if (!loginRequest.ok) {
            if (loginRequest.response.code === 1002) {
                return {
                    ok: false,
                    reason: "Username or password is incorrect."
                };
            }

            // In this case, we have no idea what the error is, so just report back what sendRequest said.
            // That said, this is going straight to UI, so - prefix it a bit.
            return {
                ...loginRequest,
                reason: "Error: " + loginRequest.reason
            };
        }
        currentUserInfo = {
            ...currentUserInfo,
            credsSeemGood: true,
            logged_in: true,
            authToken: loginRequest.response.result.userAuthToken,
            userId: loginRequest.response.result.userId,
            email
        }
        
        localStorage.setItem('username', email);
        localStorage.setItem('password', password);

        return {
            ok: true
        }
    } else {
        return {
            ok: false,
            reason: "No username / password provided."
        }
    }
}

function userLogout() {
    currentUserInfo = {
        credsSeemGood: false,
        logged_in: false
    }

    currentPlaylist = [];
    stationsArray = [];
    stationsByToken = {};
    mp3Player.src = '';
    mp3Player.pause();
    
    localStorage.removeItem('username');
    localStorage.removeItem('password');
}

/** @type {() => Promise<{ ok: true, reason: never } | { ok: false, reason: string }>} */
async function partnerLogin() {
    let body = {
        username: "android",
        password: "AC7IBG09A3DTSYM4R41UJWL07VLN8JI7",
        version: "5",
        deviceModel: "android-generic",
        includeUrls: true
    };
    let partnerLoginRequest = await sendRequest("auth.partnerLogin", body, true, false);
    let response = partnerLoginRequest.response;
    if (!('result' in response)) {
        return {
            ok: false,
            reason: "Partner login failed, somehow."
        }
    }

    var b = stringToBytes(decrypt(response.result.syncTime));
    // skip 4 bytes of garbage
    var s = "", i;
    for (i = 4; i < b.length; i++) {
        s += String.fromCharCode(b[i]);
    }
    partnerInfo.syncTime = parseInt(s);
    partnerInfo.clientStartTime = parseInt((new Date().getTime() + "").substr(0, 10));
    partnerInfo.partnerId = response.result.partnerId;
    partnerInfo.authToken = response.result.partnerAuthToken;

    return { ok: true };
}

async function getPlaylist(stationToken) {
    let audioFormats = [
        "HTTP_128_MP3",
        "HTTP_64_AACPLUS_ADTS"
    ];
    if (is_android()) {
        audioFormats.shift();
    }

    let body = {
        "stationToken": stationToken,
        "additionalAudioUrl": audioFormats.join(","),
        "userAuthToken": currentUserInfo.authToken,
        "syncTime": getSyncTime()
    };
    let request = await sendRequest("station.getPlaylist", body);
    currentPlaylist.push(...(
            request.response.result.items
            .filter(item => !item.hasOwnProperty("adToken"))
            .map(item => remapAudioUrlsToHTTPS(item))
        )
    );
}

function remapAudioUrlsToHTTPS(item) {
    // I have HTTPS-only mode on in my browser, so I get a bunch of warnings if I don't do this.

    // localStorage is stringly-typed
    if (!localStorage.getItem('forceSecure') === "true") {
        return item;
    }
    if (item.audioUrlMap) {
        for (let key in item.audioUrlMap) {
            item.audioUrlMap[key].audioUrl = item.audioUrlMap[key].audioUrl.replace(/^http:/, 'https:');
        }
    }
    if (item.additionalAudioUrl) {
        item.additionalAudioUrl = item.additionalAudioUrl.map(
            url => url.replace(/^http:/, 'https:')
        );
    }
    
    return item;
}

async function addFeedback(track, ratingIsPositive) {
    if (track.songRating === (ratingIsPositive ? 1 : -1 )) {
        return true; // no action needed
    }

    let body = {
        trackToken: track.trackToken,
        // This may change in the future, but for now all station tokens
        // are just the station id. Works for me.
        stationToken: track.stationId,
        isPositive: ratingIsPositive,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    let req = await sendRequest("station.addFeedback", body);
    if (req.ok) {
        track.songRating = (ratingIsPositive?1:-1);
        track.feedbackId = req.response.result.feedbackId;

        return true;
    } else {
        // noop. nothing to do

        return false;
    }
}

async function deleteFeedback(track, ignoreExistingFeedbackId=false) {
    if (track.songRating === 0) {
        // Nothing to do.
        return true;
    }

    /** @type {string | null | undefined} */
    let feedbackId = null;
    if (track.feedbackId && !ignoreExistingFeedbackId) {
        feedbackId = track.feedbackId;
    } else {
        let stationInfoReq = await sendRequest("station.getStation", {
            // This may change in the future, but for now all station tokens
            // are just the station id. Works for me.
            stationToken: track.stationId,
            includeExtendedAttributes: true,
            userAuthToken: currentUserInfo.authToken,
            syncTime: getSyncTime()
        });

        if (!stationInfoReq.ok) {
            return false;
        }

        let stationInfo = stationInfoReq.response.result;
        let infoKey = (track.songRating === 1 ? "thumbsUp": "thumbsDown");

        feedbackId = stationInfo.feedback[infoKey].find(item => item.songIdentity === track.songIdentity)?.feedbackId;
    }

    if (feedbackId) {
        let req = await sendRequest('station.deleteFeedback', {
            feedbackId,
            userAuthToken: currentUserInfo.authToken,
            syncTime: getSyncTime()
        });

        if (!req.ok && !ignoreExistingFeedbackId) {
            // This should always work, unless there is a network error.
            return await deleteFeedback(track, true);
        }
        
        return req.ok;
    } else {
        return false;
    }
}

async function sleepSong() {
    let body = {
        trackToken: currentSong.trackToken,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    await sendRequest("user.sleepSong", body);
}

async function setQuickMix(mixStations) {
    let body = {
        quickMixStationIds: mixStations,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    await sendRequest("user.setQuickMix", body);
}

async function search(searchString) {
    let body = {
        searchText: searchString,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };

    return await sendRequest("music.search", body);
}


async function createStation(musicToken) {
    let body = {
        musicToken: musicToken,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    let request = await sendRequest("station.createStation", body);
    
    await play(request.response.result.stationId);
}

async function deleteStation(stationToken) {
    let body = {
        stationToken: stationToken,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    await sendRequest("station.deleteStation", body);
}

async function explainTrack() {
    let body = {
        trackToken: currentSong.trackToken,
        userAuthToken: currentUserInfo.authToken,
        syncTime: getSyncTime()
    };
    return await sendRequest("track.explainTrack", body);
}

function downloadRawSong(track) {
    // Fallback, in case rich doesn't work
    let audioPath;
    if (track.additionalAudioUrl != null && ('0' in track.additionalAudioUrl)) {
        audioPath = track.additionalAudioUrl[0];
    } else {
        audioPath = (
            track.audioUrlMap.highQuality?.audioUrl ?? 
            track.audioUrlMap.mediumQuality?.audioUrl ?? 
            track.audioUrlMap.lowQuality?.audioUrl
        );
    }

    return [
        audioPath,
        track.songName.replace(/[^a-z ]/gi, '').substring(0, 29) + '.aac'
    ]
}

async function downloadRichSong(track) {
    if (!track) {
        return null;
    }
    if (!MP3Tag) {
        return downloadRawSong(track);
    }
    const artworkPath = track.albumArtUrl

    const audioBufferPromise = async () => {
        let audioPath;
        if (track.additionalAudioUrl != null && ('0' in track.additionalAudioUrl)) {
            audioPath = track.additionalAudioUrl[0];
        } else {
            audioPath = (
                track.audioUrlMap.highQuality?.audioUrl ?? 
                track.audioUrlMap.mediumQuality?.audioUrl ?? 
                track.audioUrlMap.lowQuality?.audioUrl
            );
        }
        let audioRequest = await fetch(audioPath);
        return await audioRequest.arrayBuffer();
    }

    const artBufferPromise = async () => {
        if (!artworkPath) {
            return null;
        }
        const artRequest = await fetch(artworkPath);
        const artBuffer = await artRequest.arrayBuffer();
        const artBytes = new Uint8Array(artBuffer)

        return artBytes;
    }
    let audioBuffer, artBytes;
    try {
        [audioBuffer, artBytes] = await Promise.all([
            audioBufferPromise(),
            artBufferPromise()
        ]);    
    } catch(e) {
        return downloadRawSong(track);
    }

    const mp3Tagger = new MP3Tag(audioBuffer, true)

    mp3Tagger.read()

    if (artBytes && artworkPath.includes('.jpg')) {
        console.log('Adding art');
        mp3Tagger.tags.v2.APIC = [
            {
                format: 'image/jpeg',
                type: 3,
                description: 'Album image',
                data: artBytes
            }
        ]
    }

    mp3Tagger.tags.title = track.songName;
    mp3Tagger.tags.artist = track.artistName;
    mp3Tagger.tags.album = track.albumName;

    // Save the tags
    mp3Tagger.save()

    // Handle error if there's any
    if (mp3Tagger.error !== '') {
        console.error(mp3Tagger.error);
        return downloadRawSong(track);
    }

    // Create blob
    let richSongBytes = new Uint8Array(mp3Tagger.buffer);


    return [
        URL.createObjectURL(new Blob([richSongBytes], { type: 'audio/aac' })),
        track.songName.replace(/[^a-z ]/gi, '').substring(0, 29) + '.aac'
    ];
}

async function tryExistingLogin() {
    if (localStorage.username == "" || localStorage.password == "") {
        return {
            ok: false,
            reason: "No current credentials."
        };
    }

    let partnerResult = await partnerLogin();
    if (!partnerResult.ok) {
        return partnerResult;
    }

    await userLogin(localStorage.getItem('username'), localStorage.getItem('password'));
}

tryExistingLogin();