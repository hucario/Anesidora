// @ts-nocheck This file is kept as reference only and will be deleted soon.
/**
 * 
 * 
 * 
 *  File deprecated
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 */
/*globals is_android stationImgs, encrypt, decrypt, currentSong, play, prevSongs, comingSong*/
/*exported addFeedback, addFeedbackFromToken explainTrack, search, createStation, sleepSong, setQuickMix, deleteStation */

"use strict";

import { decrypt, encrypt } from "./crypt.js";
import { LinkishString, NumberishString, PandoraRequestData, PReq, PandoraResponseData, PRes, PandoraSong, PAPIError, PandoraResponse, ResponseOK } from "./pandora.js";
import { formatParameters, formatStr, stringToBytes } from "./util.js";

let clientStartTime = 0;
let syncTime = 0;
let userAuthToken = "";
let userId = "";
let partnerId: string;
let stationList = [];
let currentPlaylist;

function getSyncTime(syncTime: NumberishString | number) {
	const time = (new Date()).getTime();
	const now = parseInt(String(time).substr(0, 10));
	return parseInt(syncTime + "") + (now - clientStartTime);
}

let lastRequestFailed = false;
async function sendRequest<t>(
		secure: boolean, 
		encrypted: boolean, 
		method: string, 
		request: PandoraRequestData
	): Promise<ResponseOK<t>> {
	
	let url = `http${
			localStorage.forceSecure === "true" || secure ? "s" : ""
		}://tuner.pandora.com/services/json/?method=`,
		parameters: string;
	
	if (userAuthToken !== "") {
		let parameterObject = {
			"auth_token": encodeURIComponent(userAuthToken),
			"partner_id": partnerId,
			"user_id": userId
		};
		parameters = formatStr("&{0}", formatParameters(parameterObject));
	} else {
		parameters = "";
	}

	request.userAuthToken = request.userAuthToken ?? userAuthToken;
	request.syncTime = request.syncTime ?? getSyncTime(syncTime);


	let new_request = encrypted ? 
		encrypt(JSON.stringify(request)) 
		: JSON.stringify(request);


	let response = await fetch(url + method + parameters, {
		method: "POST",
		headers: {
			"Content-Type": encrypted ? "text/plain" : "application/json"
		},
		body: new_request
	});

	let responseData: PandoraResponse<t> = await response.json();

	if (responseData.stat === "fail") {
		if (responseData.code === 1001 && !lastRequestFailed) {
			lastRequestFailed = true;
			try {
				let details = await partnerLogin();
				await userLogin(details);
			} catch(e) {
				throw new PAPIError(responseData);
			}
			return await sendRequest<t>(secure, encrypted, method, request);
		} else {
			throw new PAPIError(responseData);
		}
	}
	return responseData;
}


async function getStationList() {
	let request: PReq.user.getStationList = {
		includeStationArtUrl: true
	};
	let response: PandoraResponse<PRes.user.getStationList>;
	
	try {
		response = await sendRequest(false, true, "user.getStationList", request);
	} catch(e) {
		
	}

	stationList = response.result.stations;
	stationList.forEach(e => {
		stationImgs[e.stationToken] = e.artUrl;
	});
	localStorage.stationImgs = JSON.stringify(stationImgs);

	if (localStorage.userStation === undefined) {
		response.result.stations.forEach(function (station) {
			if (station.isQuickMix) {
				localStorage.userStation = station.stationId;
			}
		});
	}
	return stationList;
}

//Set this up to store good user login information. Need to probe the JSON method and see how it responds with bad
//login info so we can know that un/pw is bad before assuming it is.
//seems error 1002 is bad login info.

async function userLogin(response: ResponseOK<PRes.auth.partnerLogin>) {
	partnerId = response.result.partnerId;
	if (localStorage.username === undefined || localStorage.password === undefined) {
		return;
	}

	let request = JSON.stringify({
		"loginType": "user",
		"username": localStorage.username,
		"password": localStorage.password,
		"partnerAuthToken": response.result.partnerAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	let parameterObject = {
		"auth_token": encodeURIComponent(response.result.partnerAuthToken),
		"partner_id": response.result.partnerId
	};
	let parameters = formatStr("auth.userLogin&{0}", formatParameters(parameterObject));

	// let parameters = formatStr("auth.userLogin&auth_token={0}&partner_id={1}", encodeURIComponent(response.result.partnerAuthToken), response.result.partnerId);
	let res = await sendRequest(true, true, parameters, request);
	if (res.stat == "fail") {
		return "uncool credentials";
	}
	
	lastRequestFailed = false;

	userAuthToken = res.result.userAuthToken;
	userId = res.result.userId;
	if (stationList.length == 0) {
		await getStationList();
	}
}


async function partnerLogin(level = 0): Promise<ResponseOK<PRes.auth.partnerLogin>> {
	if (localStorage.username !== "" && localStorage.password !== "") {
		let request: PReq.auth.partnerLogin = {
			username: "android",
			password: "AC7IBG09A3DTSYM4R41UJWL07VLN8JI7",
			version: "5",
			deviceModel: "android-generic",
			includeUrls: true
		};
		let response: ResponseOK<PRes.auth.partnerLogin>;
		try {
			response = await sendRequest<PRes.auth.partnerLogin>(true, false, "auth.partnerLogin", request);
		} catch(e) {
			throw e;
		}
		let b = stringToBytes(decrypt(response.result.syncTime));
		// skip 4 bytes of garbage
		let s = "", i;
		for (i = 4; i < b.length; i++) {
			s += String.fromCharCode(b[i]);
		}
		syncTime = parseInt(s);
		clientStartTime = parseInt((new Date().getTime() + "").substr(0, 10));
		return response;
	}
}

//removes ads from fetched playlist. solves issue when player gets stuck on "undefined - undefined" [added by BukeMan]
function removeAds(playList) {
	playList.forEach(function (value, index) {
		if (Object.hasOwnProperty.call(value, "adToken")) {
			playList.splice(index, 1);
		}
	});
}

async function getPlaylist(stationToken) {
	sessionStorage.currentStation = stationToken;
	let audioFormats = [
		"HTTP_128_MP3",
		"HTTP_64_AACPLUS_ADTS"
	];
	if (is_android()) {
		audioFormats = [
			"HTTP_128_MP3"
		];
	}

	let request = {
		"stationToken": stationToken,
		"additionalAudioUrl": audioFormats.join(","),
	};
	let response = await sendRequest(true, true, "station.getPlaylist", request);
	if (!response.result) {
		failed = true;
		return;
	} else {
		failed = false;
	}
	currentPlaylist = response.result.items;
	//currentPlaylist.pop(); //Pop goes the advertisment.
	removeAds(currentPlaylist);
}

/**
 * @param {string} token 
 * @param {boolean} liked 
 */
async function addFeedbackFromToken(token, liked) {
	const song = [...prevSongs, currentSong, comingSong, ...currentPlaylist]
		.filter(e => !!e)
		.find(e => e.trackToken === token);

	if (!song) {
		throw new Error("Couldn't find song for token " + token);
	}

	if (song.songRating === (liked?1:-1)) {
		return; // no action needed
	}

	let request = JSON.stringify({
		"trackToken": song.trackToken,
		"isPositive": liked,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	song.songRating = (liked?1:-1);
	await sendRequest(false, true, "station.addFeedback", request);
}

async function addFeedback(songNum, liked) {
	if (currentSong.songRating === true && liked) { // Fixes for addFeedback being executed by bind()
		return; // edit by hucario, 5/22/2021: i have no idea why this is here but I don't want to reintroduce a bug
	}
	
	let song;
	if (songNum === -1) {
		song = currentSong;
	} else {
		song = prevSongs[songNum];
	}

	if (!songNum || typeof liked !== "boolean") {
		throw new Error("incorrect arguments passed to addFeedback");
	}
	if (!song) {
		throw new Error("out of range or something");
	}

	if (song.songRating === (liked?1:-1)) {
		return; // no action needed
	}

	let request = JSON.stringify({
		"trackToken": song.trackToken,
		"isPositive": liked,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	song.songRating = (liked?1:-1);
	await sendRequest(false, true, "station.addFeedback", request);
}

async function sleepSong() {
	let request = JSON.stringify({
		"trackToken": currentSong.trackToken,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	await sendRequest(false, true, "user.sleepSong", request);
}

async function setQuickMix(mixStations) {
	let request = JSON.stringify({
		"quickMixStationIds": mixStations,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	await sendRequest(false,true,"user.setQuickMix", request);
}

async function search(searchString) {
	let request = JSON.stringify({
		"searchText": searchString,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});

	return await sendRequest(false, true, "music.search", request);
}


async function createStation(musicToken) {
	let request = JSON.stringify({
		"musicToken": musicToken,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	let response = await sendRequest(false, true, "station.createStation", request);
	
	await play(response.result.stationId);
}

async function deleteStation(stationToken) {
	let request = JSON.stringify({
		"stationToken": stationToken,
		"userAuthToken": userAuthToken,
		"syncTime": getSyncTime(syncTime)
	});
	await sendRequest(false, true, "station.deleteStation", request);
}

export async function explainTrack(token: string) {
	let request = {
		"trackToken": token
	};
	return await sendRequest(false, true, "track.explainTrack", request);
}

if (localStorage.username !== "" && localStorage.password !== "") {
	partnerLogin();
}


/*global getPlaylist, currentPlaylist, platform_specific, get_browser, is_android*/
/*exported setCallbacks, play, downloadSong, nextSongStation, mp3Player*/

import {
	getBrowser
} from './platform_specific'

import type {
	OnBeforeSendHeadersDetails,
	HttpHeader
} from './webRequest'

let mp3Player = document.getElementById("mp3Player");

getBrowser().webRequest.onBeforeSendHeaders.addListener(
	(details: OnBeforeSendHeadersDetails) => {
		const h = details.requestHeaders;
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

const callbacks = {
	updatePlayer: [],
	drawPlayer: [],
	downloadSong: []
};

function setCallbacks(updatePlayer,drawPlayer,downloadSong){
	callbacks.updatePlayer.push(updatePlayer);
	callbacks.drawPlayer.push(drawPlayer);
	callbacks.downloadSong.push(downloadSong);
}

async function play(stationToken) {
	if (stationToken !== localStorage.lastStation) {
		currentSong = undefined;
		await getPlaylist(stationToken);
		//adding this so album covers get on the right location
		let prev_station = localStorage.lastStation;
		localStorage.lastStation = stationToken;
		await nextSong(1, prev_station);
	} else {
		if (currentSong === undefined) {
			await getPlaylist(localStorage.lastStation);
		}
		if (mp3Player.currentTime > 0) {
			mp3Player.play();
		} else {
			await nextSong();
		}
	}
}

async function nextSongStation(station) {
	//adding this so album covers get on the right location
	let prev_station = localStorage.lastStation;
	localStorage.lastStation = station;
	await getPlaylist(localStorage.lastStation);
	comingSong = undefined;
	//adding this so album covers get on the right location
	nextSong(1, prev_station);
}

async function nextSong(depth=1, prev_station=undefined) {
	if (depth > 4){
		return;
	}
	if (!prev_station) {
		//if the "prev_station" does not have a definition
		//then we didn't swap, use the existing one
		prev_station = localStorage.lastStation;
	}

	/* I (hucario) put this over here so that history and station art works for every song change. */
	if (currentSong) {
		stationImgs[prev_station] = (currentSong.albumArtUrl || stationImgs[prev_station]) || undefined; 
		localStorage.stationImgs = JSON.stringify(stationImgs);
		if (currentSong != prevSongs[prevSongs.length-1]) {
			prevSongs.push(currentSong);
			while(prevSongs.length > localStorage.historyNum){
				prevSongs.shift();
			}
		}
	}

	if (!currentPlaylist || currentPlaylist.length === 0) {
		await getPlaylist(localStorage.lastStation);
	}

	if (comingSong === undefined && currentPlaylist.length > 0) {
		comingSong = currentPlaylist.shift();
	}
	currentSong = comingSong;

	//in case the most recent shift emptied the playlist
	if (currentPlaylist.length === 0) {
		await getPlaylist(localStorage.lastStation);
	}
	comingSong = currentPlaylist.shift();

	let song_url;
	if (currentSong.additionalAudioUrl != null) {
		song_url = currentSong.additionalAudioUrl;
	} else {
		song_url = currentSong.audioUrlMap.highQuality.audioUrl;
	}
	mp3Player.setAttribute("src", song_url);
	mp3Player.play();

	let xhr = new XMLHttpRequest();
	xhr.open("HEAD", song_url);
	xhr.onerror = function () {
		nextSong(depth + 1);
	};
	xhr.onload = function() {
		if (xhr.status >= 300){
			//purge the current list, then run this function again
			nextSong(depth + 1);
		}

		if (localStorage.notifications === "true") {
			let options = {
				type: "list",
				title: "Now playing:\r\n" + currentSong.artistName + " - " + currentSong.songName,
				message: "by " + currentSong.artistName,
				eventTime: 5000,
				items: [
					{ title: "", message: "Coming next: " },
					{ title: "", message: comingSong.artistName + " - " + comingSong.songName }
				]
			};

			let xhr2 = new XMLHttpRequest();
			xhr2.open("GET", currentSong.albumArtUrl);
			xhr2.responseType = "blob";
			xhr2.onload = function(){
				let blob = this.response;
				options.iconUrl = window.URL.createObjectURL(blob);
			};
			xhr2.send(null);
		}
	};
	xhr.send();
}

function setup_commands() {
	try {
		if (!is_android()) {
			try {
				get_browser().commands.onCommand.addListener(function(command) {
					if (command === "pause_play") {
						if (!mp3Player.paused) {
							mp3Player.pause();
						} else {
							play(localStorage.lastStation);
						}
					} else if(command === "skip_song") {
						nextSong();
					}
				});
			} catch (TypeError) {
				// Just in case Android
			}
		}
	} catch (TypeError) {
		//Once again Android isn't being detected properly
	}
}

function setup_mediasession() {
	if (!("mediaSession" in navigator)) {
		return;
	}

	navigator.mediaSession.setActionHandler("play", async function() {
		if(mp3Player.paused) {
			play(localStorage.lastStation);
		}
	});
	navigator.mediaSession.setActionHandler("pause", async function() {
		if(!mp3Player.paused) {
			mp3Player.pause();
		}
	});
	navigator.mediaSession.setActionHandler("nexttrack", async function() {
		nextSong();
	});
	navigator.mediaSession.setActionHandler("seekto", function(details) {
		mp3Player.currentTime = details.seekTime;
	});
}

function update_mediasession() {
	if (!("mediaSession" in navigator)) {
		return;
	}

	// https://github.com/snaphat/pandora_media_session/blob/main/pandora_media_session.user.js#L45
	// Populate metadata
	let metadata = navigator.mediaSession.metadata;
	if (!metadata || (
		metadata.title != currentSong.songName ||
		metadata.artist != currentSong.artistName ||
		!metadata.artwork ||
		metadata.artwork.length === 0 ||
		metadata.artwork[0].src != currentSong.albumArtUrl)
	) { 
		navigator.mediaSession.metadata = new window.MediaMetadata({
			title: currentSong.songName,
			artist: currentSong.artistName,
			artwork: currentSong.albumArtUrl ? [{ src: currentSong.albumArtUrl, sizes: "500x500", type: "image/jpeg" }] : []
		});
	}

	if (mp3Player.paused) {
		navigator.mediaSession.playbackState = "paused";
	} else {
		navigator.mediaSession.playbackState = "playing";

		if (mp3Player.duration) {
			try {
				navigator.mediaSession.setPositionState({
					duration: mp3Player.duration,
					position: mp3Player.currentTime,
					playbackRate: 1
				});
			} catch (e) {
				// duration is probably NaN
			}
		}
	}
}

document.addEventListener("DOMContentLoaded", function () {
	mp3Player = document.getElementById("mp3Player");

	if (localStorage.volume) {
		mp3Player.volume = localStorage.volume;
	} else {
		mp3Player.volume = 0.1;
	}

	platform_specific(get_browser());

	setup_commands();

	setup_mediasession();

	mp3Player = document.getElementById("mp3Player");

	mp3Player.addEventListener("play", function () {
		try {
			//check if the window exists
			document.getElementById("mp3Player").yep = "thisexists";
			callbacks.updatePlayer.forEach((e) => {
				try {
					e();
				} catch(b) {
					callbacks.updatePlayer.splice(callbacks.updatePlayer.indexOf(e), 1);
				}
			});
			currentSong.startTime = Math.round(new Date().getTime() / 1000);
			update_mediasession();
		} catch (e) {
			//if it doesn"t exist, don"t draw here
			return;
		}
	});
	mp3Player.addEventListener("pause", function () {
		update_mediasession();
	});
	mp3Player.addEventListener("ended", function () {
		nextSong();
		update_mediasession();
	});
	mp3Player.addEventListener("timeupdate", function () {
		update_mediasession();
		try {
			//check if the window exists
			document.getElementById("mp3Player").yep = "thisexists";
			callbacks.drawPlayer.forEach((e) => {
				try {
					e();
				} catch(b) {
					callbacks.drawPlayer.splice(callbacks.drawPlayer.indexOf(e), 1);
				}
			});
		} catch(e){
			//if it doesn"t, don"t draw here
			return;
		}
	});
	mp3Player.addEventListener("error", function () {
	});
});
