"use strict"
/*global partnerLogin, getPlaylist, currentPlaylist, platform_specific, get_browser, is_android*/
/*exported setCallbacks, play, downloadSong, playStation, mp3Player*/

get_browser().runtime.onInstalled.addListener(async () => {
    const rules = [
        {
            id: 1,
            action: {
                type: 'modifyHeaders',
                requestHeaders: [{
                    header: "User-Agent",
                    operation: "set",
                    value: "libcurl"
                }],
            },
            condition: {
                domains: [get_browser().runtime.id],
                urlFilter: '|tuner.pandora.com',
                resourceTypes: ['xmlhttprequest'],
            },
        }
    ];
    await get_browser().declarativeNetRequest.updateDynamicRules({
        removeRuleIds: rules.map(r => r.id),
        addRules: rules,
    });
});

let usedPopup = localStorage.getItem("whichPlayer") === "old" ? "old.htm" : "new.htm";
get_browser().browserAction.setPopup({
    popup: usedPopup
});

let mp3Player = document.getElementById('mp3Player');

var callbacks = {
    updatePlayer: [],
    drawPlayer: [],
    downloadSong: []
};
var currentSong;
var prevSongs = [];

function toHTTPS(url) {
    if (!url) { return url; }
    if (localStorage.getItem('forceSecure') === 'true') {
        return url.replace('http://', 'https://');
    }
    return url;
}

function setCallbacks(updatePlayer,drawPlayer,downloadSong){
    callbacks.updatePlayer.push(updatePlayer);
    callbacks.drawPlayer.push(drawPlayer);
    callbacks.downloadSong.push(downloadSong);
}

async function play() {
    if (mp3Player.currentTime > 0) {
        mp3Player.play();
    } else {
        await nextSong();
    }
}

const MAX_PLAYTIME_BEFORE_SONG_RESTART = 4; // in seconds

async function seekBack() {
    if (mp3Player?.currentTime > MAX_PLAYTIME_BEFORE_SONG_RESTART) {
        await restartSong();
    } else {
        await replaySong(prevSongs[0], true);
    }
}

async function restartSong() {
    if (mp3Player.currentTime === 0) {
        return;
    }

    mp3Player.currentTime = 0;
}

async function replaySong(track, pushForwards=false) {
    if (!track) {
        return;
    }
    if (currentSong) {
        // If skipping back through history linearly,
        // we want "discarded" songs to go back into "next songs queue" - currentPlaylist
        // so that going forward plays them again, in order.

        // If we're playing selected tracks from the history,
        // we want to "discard" the songs onto the top of history,
        // as no linear direction is inferred.
        if (pushForwards) {
            if (currentSong != currentPlaylist[0]) {
                currentPlaylist.unshift(currentSong);
            }
        } else {
            if (currentSong != prevSongs[0]) {
                prevSongs.unshift(currentSong);
            }
        }
    }

    currentSong = track;

    let prevIndex = prevSongs.indexOf(track);
    if (prevIndex !== -1) {
        prevSongs.splice(prevIndex, 1);
    }
    
    let song_url;
    if (currentSong.additionalAudioUrl != null && ('0' in currentSong.additionalAudioUrl)) {
        song_url = currentSong.additionalAudioUrl[0];
    } else {
        song_url = currentSong.audioUrlMap.highQuality.audioUrl;
    }
    mp3Player.src = song_url;
    mp3Player.play();

    if (currentPlaylist[0]?.albumArtUrl) {
        let preloadImage = new Image();
        let fullImage = toHTTPS(currentPlaylist[0].albumArtUrl);
        let smallImage = fullImage.replace('1080W_1080H', '500W_500H');
        preloadImage.addEventListener("error", () => {
            preloadImage.src = fullImage;
        }, { once: true });
        preloadImage.src = smallImage;
    }

    updatePlayers();
}

async function playStation(stationToken) {
    if (stationToken === currentStationToken) {
        return;
    }
    localStorage.setItem('lastStation', stationToken);
    currentStationToken = stationToken;
    currentPlaylist = [];
    await getPlaylist(stationToken);
    await nextSong();
}

async function nextSong(depth=1) {
    if (depth > 4){
        return;
    }
    if (currentSong) {
        if (currentSong != prevSongs[0]) {
            prevSongs.unshift(currentSong);

            if (prevSongs.length > localStorage.historyNum) {
                prevSongs.splice(localStorage.historyNum, prevSongs.length - (localStorage.historyNum ?? 25));
            }
        }
    }
    if (!currentStationToken) {
        currentStationToken = localStorage.getItem('lastStation');
    }

    if (currentPlaylist.length < 2) {
        // Want one for "next" (soon to be this) song,
        // and one to preload one after that 
        await getPlaylist(currentStationToken);
    }

    currentSong = currentPlaylist.shift();
    

    let song_url;
    if (currentSong.additionalAudioUrl != null && ('0' in currentSong.additionalAudioUrl)) {
        song_url = currentSong.additionalAudioUrl[0];
    } else {
        song_url = currentSong.audioUrlMap.highQuality.audioUrl;
    }
    mp3Player.src = song_url;
    mp3Player.play();

    if (currentPlaylist[0]?.albumArtUrl) {
        let preloadImage = new Image();
        let fullImage = toHTTPS(currentPlaylist[0].albumArtUrl);
        let smallImage = fullImage.replace('1080W_1080H', '500W_500H');
        preloadImage.addEventListener("error", () => {
            preloadImage.src = fullImage;
        }, { once: true });
        preloadImage.src = smallImage;
    }

    updatePlayers();
}

function setup_commands() {
    if (!is_android()) {
        get_browser().commands.onCommand.addListener(function(command) {
            if (command === "pause_play") {
                if (!mp3Player.paused) {
                    mp3Player.pause();
                } else {
                    play();
                }
            } else if(command === "skip_song") {
                nextSong();
            }
        });
    }
}

function setup_mediasession() {
    if (!('mediaSession' in navigator)) {
        return;
    }

    navigator.mediaSession.setActionHandler("play", play);
    navigator.mediaSession.setActionHandler("pause", () => mp3Player.pause());
    navigator.mediaSession.setActionHandler("previoustrack", seekBack);
    navigator.mediaSession.setActionHandler("nexttrack", () => nextSong());
    navigator.mediaSession.setActionHandler("seekto", function(details) {
        mp3Player.currentTime = details.seekTime;
    });
}

function update_mediasession() {
    if (!('mediaSession' in navigator)) {
        return;
    }

    // https://github.com/snaphat/pandora_media_session/blob/main/pandora_media_session.user.js#L45
    // Populate metadata
    var metadata = navigator.mediaSession.metadata;
    if (!metadata || (
        metadata.title != currentSong.songName ||
        metadata.artist != currentSong.artistName ||
        metadata.artwork[0].src != currentSong.albumArtUrl)
        ) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentSong.songName,
            artist: currentSong.artistName,
            artwork: [{ src: currentSong.albumArtUrl, sizes: '500x500', type: 'image/jpeg' }]
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

const updatePlayers = () => {
    update_mediasession();
    callbacks.updatePlayer.forEach((e) => {
        try {
            e();
        } catch(b) {
            callbacks.updatePlayer.splice(callbacks.updatePlayer.indexOf(e), 1);
        }
    });
}

document.addEventListener('DOMContentLoaded', function () {
    mp3Player = document.getElementById('mp3Player');
    mp3Player.volume = 1;

    platform_specific();

    setup_commands();

    setup_mediasession();

    mp3Player = document.getElementById('mp3Player');

    mp3Player.addEventListener("play", updatePlayers);
    mp3Player.addEventListener("pause", updatePlayers);
    mp3Player.addEventListener("canplay", updatePlayers);
    mp3Player.addEventListener("ended", function () {
        nextSong().then(update_mediasession);
    });
    mp3Player.addEventListener("timeupdate", function () {
        update_mediasession();
        callbacks.drawPlayer.forEach((e) => {
            try {
                e();
            } catch(b) {
                callbacks.drawPlayer.splice(callbacks.drawPlayer.indexOf(e), 1);
            }
        });
    });
    // small rate limit.
    // should not affect manual skips
    let lastError = Date.now();
    let waitingOnSkip = false;
    let MIN_ERRORSKIP_DELAY = 2000;
    mp3Player.addEventListener("error", () => {
        if (waitingOnSkip) {
            return;
        }
        if (lastError > (Date.now() - MIN_ERRORSKIP_DELAY)) {
            waitingOnSkip = true;
            setTimeout(() => {
                waitingOnSkip = false;
                nextSong().then(update_mediasession);
            }, MIN_ERRORSKIP_DELAY - (Date.now() - lastError))
        } else {
            nextSong().then(update_mediasession);
        }
    });
});
