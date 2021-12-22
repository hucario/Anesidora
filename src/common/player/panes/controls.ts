/**
 * TODO: Implement miniplayer mode
 * > perhaps a compact mode? With smaller font and no album art,
 * > so it's just the playhead, song/artist name, and controls?
 * > That ultimately would serve well to replace what I like most
 * > in the Old layout
 */


import { PandoraRating, PandoraSong } from "../../background/pandora.js";
import { AnesidoraConfig, AnesidoraFeedItem, AnesidoraState } from "../../background/store.js";
import { Message } from "../../messages.js";

let ignoreAutoScroll = false;
const SMOOTH_SCROLL_TIME = 5000;

function throwHere(msg: string): never {
    console.error(`%ccontrols.ts: "${msg}"`, `
        color: #15799d;
        font-weight: bold;
        font-family: 'Inter', sans-serif;
    `)
    throw new Error(msg)
}

function logHere(...data: any[]) {
    console.log('%ccontrols.ts:', `
    color: #15799d;
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

function errorHere(...data: any[]) {
    console.error('%ccontrols.ts:', `
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

function getFormattedTime(time: number): string {
    const d = new Date(0);
    d.setSeconds(time);
    if (d.getUTCHours() > 0) {
        return d.getUTCHours() + ':' + d.toISOString().substr(14, 5);
    } else {
        return d.toISOString().substr(14, 5)
    }
}


const getControlsPaneHtml = (s: AnesidoraState) => (`
    <div class="pane controls">
        <div class="ct_coversArea">
            <div class="ct_coversGradients">
                <div class="ct_coverGradLeft"></div>
                <div class="ct_coverGradCenter"></div>
                <div class="ct_coverGradRight"></div>
            </div>
            <div id="ct_covers"></div>
            <button id="ct_back" class="ct_backButton--out">
                Back to current song
                <i class="bx bx-right-arrow-alt"></i>
            </button>
        </div>
        <div class="range" style="--val: ${s.currentTime !== null && s.duration !== null ? (
            s.currentTime / s.duration
         ) : 0};">
            <input type="range" min="0" max="100" step="any">
            <div class="rangeShow"></div>
        </div>
        <span id="ct_timestamp">${
            s.currentTime !== null ?
                getFormattedTime(s.currentTime) : '<br>'
        }${
            s.currentTime !== null && s.duration !== null ?
                ' / ' + getFormattedTime(s.duration) : ''
        }</span>
        <div class="ct_musicInfo">
            <span>${s.currentEvent ? '' : 'Play to resume last station'}</span>
            <a id="ct_artistLink" ${
                s.currentEvent && 'artistDetailUrl' in s.currentEvent ?
                    ` href="${s.currentEvent.artistDetailUrl}"` : ""
            }>${s.currentEvent && 'artistName' in s.currentEvent ? s.currentEvent.artistName : ''}</a>
            <a id="ct_titleLink"${
                s.currentEvent && 'songDetailUrl' in s.currentEvent ?
                    ` href="${s.currentEvent.songDetailUrl}"` : ""
            }>${s.currentEvent && 'songName' in s.currentEvent ? s.currentEvent.songName : ''}</a>
            <a id="ct_albumLink"${
                s.currentEvent && 'albumDetailUrl' in s.currentEvent ?
                    ` href="${s.currentEvent.albumDetailUrl}"` : ""
            }>${s.currentEvent && 'albumName' in s.currentEvent ? s.currentEvent.albumName : ''}</a>
            <div>
                <button title="${
                    s.isPaused ? "Play" : "Pause"
                }">
                    <i class="bx bx-${
                        s.isPaused ? "play" : "pause"
                    }"></i>
                </button>
                <button title="Next song">
                    <i class='bx bx-skip-next'></i>
                </button>
            </div>
        </div>
        <div class="ct_otherButtons ${
            s.currentEvent ? '' :
            'ct_nothingPlaying'
        }">
            <button>
                <i class='bx bx${
                    s.currentEvent && 'songRating' in s.currentEvent && 
                    s.currentEvent.songRating === PandoraRating.THUMBS_UP ? 
                        's' : ''
                }-like'></i>
            </button>
            <button>
                <i class='bx bx-hourglass'></i>
            </button>
            <a download tabindex="0">
                <i class='bx bx-download'></i>
            </a>
            <a tabindex="0" href="../settings/settings.html" target="_blank">
                <i class='bx bx-cog'></i>
            </a>
            <button>
                <i class='bx bx-dislike'></i>
            </button>
        </div>
        <div class="ct_volumeGroup">
            <button class='bx bx-volume-${
                s.volume > 0.5 ? 'full' : (
                    s.volume !== 0 ? 'low' :
                        'mute'
                )
            }'></button>
            <div class="range" style="--val: ${s.volume};">
                <input type="range" min="0" max="100" step="any">
                <div class="rangeShow" id="volShow"></div>
            </div>
        </div>
    </div>
`);

const domP = new DOMParser();
function strToHtml(str: string): HTMLElement[] {
    let untypedNodes = domP
            .parseFromString(str.replace(/(    )|\t/g,''), "text/html")
            .body
            .children;

    let typedNodes: HTMLElement[] = [];
    for (const elem of untypedNodes) {
        if (elem instanceof HTMLElement) {
            typedNodes.push(elem);
        }
    };

    return typedNodes;
}

export default async function SetupControlsPane(
        config: AnesidoraConfig,
        message: <expectedResponse>(
            name: Message['name'],
            data?: Message['data']
        ) => Promise<expectedResponse>,
        subscribe: (
            name: string,
            fn: (data: Message) => void
        ) => void
    ): Promise<HTMLElement> {

    let state = await message<AnesidoraState>("toBg_getState");

    let ctNodes = buildPane(config, state, message);

    /**
     * Honestly the partial updating is the most complicated part
     */

    let timestamp = ctNodes.querySelector<HTMLSpanElement>("#ct_timestamp");
    let seekRange = ctNodes.querySelectorAll<HTMLDivElement>(".range")[0];

    let playPauseButton = ctNodes
        .querySelector<HTMLButtonElement>('.ct_musicInfo > div > :first-child');

    playPauseButton.addEventListener('click', () => message("toBg_playButton"));

    let skipButton = ctNodes
    .querySelector<HTMLButtonElement>('.ct_musicInfo > div > :nth-child(2)');

    skipButton.addEventListener('click', () => message("toBg_skipButton"));

    // Play/pause button pressed
    subscribe("toTabs_skipButton", (reply) => {
        if (reply.name !== "toTabs_skipButton") {
            // Typeguard
            return;
        }
        
        skipButton.style.pointerEvents = "none";
        skipButton.style.opacity = "0.7";
    })

    subscribe("toTabs_resetSkip", (msg) => {
        if (msg.name !== "toTabs_resetSkip") {
            return;
        }
        skipButton.style.pointerEvents = "";
        skipButton.style.opacity = "1";
    })

    // Play/pause button pressed
    subscribe("toTabs_playButton", (reply) => {
        if (reply.name !== "toTabs_playButton") {
            // Typeguard
            return;
        }
        
        playPauseButton.style.pointerEvents = "none";
        playPauseButton.style.opacity = "0.7";
    })

    subscribe("toTabs_resetPlay", (msg) => {
        if (msg.name !== "toTabs_resetPlay") {
            return;
        }
        playPauseButton.style.pointerEvents = "";
        playPauseButton.style.opacity = "1";

        
        if (msg.data) {
            playPauseButton.title = "Play";
            playPauseButton.children[0].className = "bx bx-play";
        } else {
            playPauseButton.title = "Pause";
            playPauseButton.children[0].className = "bx bx-pause";
        }
    })


    subscribe("toTabs_stateChanged", (msg) => {
        if (msg.name !== 'toTabs_stateChanged') {
            return;
        }

        const d = {
            key: <keyof AnesidoraState>msg.data.key,
            old: <AnesidoraState[keyof AnesidoraState]>msg.data.oldValue,
            new: <AnesidoraState[keyof AnesidoraState]>msg.data.newValue
        }

        switch (d.key) {
            case "currentTime":
            case "duration":
                if (typeof d.new !== "number") {
                    if (d.new === null) {
                        timestamp.innerText = '';
                        seekRange.style.setProperty(
                            '--val',
                            '100'
                        )
                        seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = 100;
                    }
                    break;
                }
                state.currentTime = d.new;
        
                timestamp.innerText = getFormattedTime(d.new);
                timestamp.innerText += state.duration !== null ?
                    ' / ' + getFormattedTime(state.duration)
                    : '';
        
                seekRange.style.setProperty(
                    '--val',
                    (d.new / state.duration) + ''
                )    
                seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = (state.duration / state.currentTime) * 100;
        
                break;
            
            case "currentEvent":
                if (d.new && typeof d.new === 'object' && 'trackToken' in d.new) {
                    ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span").style.display = "none";
                    ctNodes.querySelector(".ct_otherButtons").classList.remove("ct_nothingPlaying");
                    ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span")
                        .innerText = "Play to resume last station";
                    
                    let artistLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_artistLink");
                    let titleLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_titleLink");
                    let albumLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_albumLink");
    
                    artistLink.href = d.new.artistDetailUrl;
                    artistLink.innerText = d.new.artistName;
    
                    titleLink.href = d.new.songDetailUrl;
                    titleLink.innerText = d.new.songName;
    
                    albumLink.href = d.new.albumDetailUrl;
                    albumLink.innerText = d.new.albumName;
                } else {
                    ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span").style.display = "";
                    ctNodes.querySelector(".ct_otherButtons").classList.add("ct_nothingPlaying");
                    ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span")
                        .innerText = "";
                
                    let artistLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_artistLink");
                    let titleLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_titleLink");
                    let albumLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_albumLink");
    
                    artistLink.href = "";
                    artistLink.innerText = "";
    
                    titleLink.href = "";
                    titleLink.innerText = "";
    
                    albumLink.href = "";
                    albumLink.innerText = "";
                }

                if (!d.old || !(typeof d.old === 'object' && 'trackToken' in d.old)) {
                    let oldCTNodes = ctNodes;
                    ctNodes = buildPane(config, state, message)
                    oldCTNodes.replaceWith(ctNodes);
                    ctNodes.querySelector('#ct_covers .ct_current')?.scrollIntoView({
                        behavior: 'smooth',
                        inline: 'center',
                        block: 'center'
                    })
                } else {
                    updateCovers(
                        ctNodes.querySelector("#ct_covers"),
                        config,
                        state,
                        message
                    );
                }
                break;
            
            case "volume":
                if (typeof d.new !== "number" || d.new > 1 || d.new < 0) {
                    break;
                }
                const volumeRange = ctNodes.querySelectorAll<HTMLElement>(".range")[1];
                const volumeInput = volumeRange.querySelector<HTMLInputElement>("input");
                const volumeIcon = volumeRange.parentElement.children[0];

                volumeInput.valueAsNumber = (d.new * 100);
                volumeIcon.className = `bx bx-volume-${
                    (d.new * 100) > 50 ? 'full' : (
                        d.new !== 0 ? 'low' :
                            'mute'
                    )
                }`;
                volumeRange.style.setProperty(
                    '--val',
                    d.new + ''
                );
        }
        
    })

    subscribe("toTabs_removedFromQueue", (reply) => {
        if (reply.name !== 'toTabs_removedFromQueue') {
            return;
        }

        const index = state.comingEvents.findIndex(e => (
            'adToken' in e ? 
                e.adToken === reply.data : 
                ('trackToken' in e ?
                    e.trackToken === reply.data :
                    false
                )
        ));
        if (index !== -1) {
            state.comingEvents.splice(index, 1);
            updateCovers(
                ctNodes.querySelector<HTMLDivElement>("#ct_covers"),
                config,
                state,
                message
            )
        }
    });

/*
    subscribe("configChanged", (reply) => {
        if (reply.name !== 'configChanged') {
            return;
        }

        if (reply.data.key === 'controlsPane') {
            const d = reply.data as {
                newValue: AnesidoraConfig['controlsPane']
            }
            // There are no settings for this... yet...
            

            return;
        }

        if (reply.data.key === 'theming') {
            const d = reply.data as {
                newValue: AnesidoraConfig['theming']
            };

            const oldTheme = {
                ...config.theming.controls,
                ...config.theming.common
            }
            const newTheme = {
                ...d.newValue.controls,
                ...d.newValue.common
            }
            
            config.theming = d.newValue;

            ctNodes.style.background = newTheme.backgroundColor;
            ctNodes.style.color = newTheme.textColor;
            ctNodes.style.padding = newTheme.padding;
            ctNodes.style.setProperty(
                '--accent-color',
                newTheme.accentColor
            );
            ctNodes.style.setProperty(
                '--volume-color',
                newTheme.volumeColor ?? newTheme.rangeColor ?? newTheme.accentColor
            );
            ctNodes.style.setProperty(
                '--seek-color',
                newTheme.seekColor ?? newTheme.rangeColor ?? newTheme.accentColor
            );
            ctNodes.style.setProperty(
                '--volume-bgcolor',
                newTheme.volumeBgColor ?? newTheme.rangeBgColor
            );
            ctNodes.style.setProperty(
                '--seek-bgcolor',
                newTheme.seekBgColor ?? newTheme.rangeBgColor
            );

            /**
             * We can't check objects for changes directly,
             * as runtime.sendMessage is pass-by-value, not by reference
             * 
             * So we'll just have to check values manually
             * /

            let completely_rebuilding = false;

            let bPChildren: HTMLElement[] = [];
            [...ctNodes.children].forEach(e => {
                if (e instanceof HTMLElement) {
                    bPChildren.push(e);
                }
            });

            if (
                (false)
            ) {
                completely_rebuilding = true;
            }

            if (!completely_rebuilding) {
                if (newTheme.defaultAlbumCover !== oldTheme.defaultAlbumCover) {
                    for (const img of ctNodes.getElementsByTagName("img")) {
                        if (img.src === oldTheme.defaultAlbumCover) {
                            img.src = newTheme.defaultAlbumCover;
                        }
                    }
                }
            } else {
                let oldCTNodes = ctNodes;
                ctNodes = buildPane(config, state, message)
                oldCTNodes.replaceWith(ctNodes);
            }
        }
    })

    */
    return ctNodes;
}

// ANCHOR cover html
const genCover = (
    e: PandoraSong,
    i: {
        current: boolean,
        position: number
    },
    config: AnesidoraConfig,
    state: AnesidoraState,
    message: <expectedResponse>(
        name: Message['name'],
        data?: Message['data']
    ) => Promise<expectedResponse>
) => {

    let nodes = strToHtml(`
<div
 data-where="${i.position}"
 id="${e.trackToken}"
 class="ct_cover ${e.albumArtUrl ? '' : 'ct_noCover'} ${i.current ? "ct_current" : ''}"
>
    <div class="ct_info">
        <span class="ct_position">${i.position > 0 ? (
                i.position === 1 ?
                    "Next song" :
                    `Coming in ${i.position} songs`
            ) : (
                i.position === 0 ?
                    "Previous song" :
                    `${(i.position+1) * -1} songs ago`
        )}</span>
        <span class="ct_author">${e.artistName}</span>
        <span class="ct_songTitle">${e.songName}</span>
        <span class="ct_albumTitle">${e.albumName}</span>
        <div class="ct_coverActions">
            <button alt="Like this track">
                <i
                 class="bx bx${
                    e.songRating === PandoraRating.THUMBS_UP ?
                        "s" : ""
                }-like"></i>
            </button>
            <a
             href="${e.audioUrlMap.highQuality?.audioUrl ??
                e.audioUrlMap.mediumQuality?.audioUrl ??
                e.audioUrlMap.lowQuality?.audioUrl ??
                e.additionalAudioUrl}"
             alt="Download this track"
             tabindex="0"
            >
                <i class="bx bx-download"></i>
            </a>
            <button alt="Dislike this track">
                <i class="bx bx${
                    e.songRating === PandoraRating.THUMBS_DOWN ?
                        "s" : ""
                }-dislike"></i>
            </button>
                ${
                    i.position > 0 ? 
                    `<button class="ct_playCover" alt="Play this track">
                        <i class="bx bx-play"></i>
                    </button>` : ""
                }
                ${ i.position > 0 ? 
                    `<button class="ct_remove">
                        <i class="bx bx-x"></i>
                    </button>` : "" }
            </div>
        </div>
    <img
     class="ct_actualCover" 
     src="${e.albumArtUrl ?? ''}"
    />
</div>
    `)[0];

    const likeButton = nodes
    .querySelector<HTMLButtonElement>('.ct_coverActions > :first-child');
    const dislikeButton = nodes
    .querySelector<HTMLButtonElement>('.ct_coverActions > :nth-child(3)');
    const removeButton = nodes
    .querySelector<HTMLButtonElement>('.ct_remove');
    const playButton = nodes
    .querySelector<HTMLButtonElement>('.ct_coverActions > .ct_playCover');

    let tryingToPlay = false;
    playButton?.addEventListener('click', () => {
        (async()=>{
            const where = parseInt(nodes.getAttribute("data-where") || '0');
            if (!where || where <= 0 || tryingToPlay) { return; }
            tryingToPlay = true;
            for (let p = 0; p < where; p++) {
/*
                await message("removeFromQueue", {
                    token: state.comingEvents[0].trackToken
                });
*/
            }
//            await message("skip");
        })();
    })

    removeButton?.addEventListener('click', () => {
/*
        message("removeFromQueue", {
            token: e.trackToken
        });
*/
    })

    let tryingToLike = false;
    likeButton.addEventListener("click", () => {
        if (tryingToLike) { return; }
        tryingToLike = true;
        if (e.songRating !== PandoraRating.THUMBS_UP) {
/*            message("like", {
                token: e.trackToken
            });
*/
        }
    })

    let tryingToDislike = false;
    dislikeButton.addEventListener("click", () => {
        if (tryingToDislike) { return; }
        tryingToDislike = true;
        if (e.songRating !== PandoraRating.THUMBS_DOWN) {
/*            message("dislike", {
                token: e.trackToken
            });
*/
        }
    })

    return nodes;
}

function buildPane(
        config: AnesidoraConfig,
        state: AnesidoraState,
        message: <expectedResponse>(
            name: Message['name'],
            data?: Message['data']
        ) => Promise<expectedResponse>
    ): HTMLElement {
    
    /** Control Nodes */
    let ctNodes = strToHtml(getControlsPaneHtml(state))[0];

    const theme = {
        ...config.theming.controls,
        ...config.theming.common
    }

    ctNodes.style.background = theme.backgroundColor;
    ctNodes.style.color = theme.textColor;
    ctNodes.style.padding = theme.padding;
    ctNodes.style.setProperty(
        '--accent-color',
        theme.accentColor
    );
    ctNodes.style.setProperty(
        '--volume-color',
        theme.volumeColor ?? theme.rangeColor ?? theme.accentColor
    );
    ctNodes.style.setProperty(
        '--seek-color',
        theme.seekColor ?? theme.rangeColor ?? theme.accentColor
    );
    ctNodes.style.setProperty(
        '--volume-bgcolor',
        theme.volumeBgColor ?? theme.rangeBgColor
    );
    ctNodes.style.setProperty(
        '--seek-bgcolor',
        theme.seekBgColor ?? theme.rangeBgColor
    );


    const seekRange = ctNodes.querySelectorAll<HTMLElement>(".range")[0];
    const volumeRange = ctNodes.querySelectorAll<HTMLElement>(".range")[1];

    const seekInput = seekRange.querySelector<HTMLInputElement>("input");
    const volumeInput = volumeRange.querySelector<HTMLInputElement>("input");

    const volumeIcon = volumeRange.parentElement.children[0];

    seekInput.value = (
        state.currentTime !== null && state.duration !== null ? (
            (state.currentTime / state.duration) * 100
        ) : 0
     ) + "";

    volumeInput.value = (state.volume*100) + "";


    const timestamp = ctNodes.querySelector<HTMLSpanElement>("#ct_timestamp");
    seekInput.addEventListener("input", (e) => {
        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }
/*
        message("seek", state.duration * (e.target.valueAsNumber / 100));
*/

        timestamp.innerText = `${
            state.currentTime !== null ?
                getFormattedTime(state.duration * (e.target.valueAsNumber / 100)) : ''
        }${
            state.currentTime !== null && state.duration !== null ?
                ' / ' + getFormattedTime(state.duration) : ''
        }`;

        seekRange.style.setProperty(
            '--val',
            (e.target.valueAsNumber / 100) + ''
        )
    })

    let nonMutedVol: null | number = null;

    volumeIcon.addEventListener("click", () => {
        if (volumeInput.valueAsNumber !== 0) {
            /*
            message("changeVolume", 0);
            nonMutedVol = volumeInput.valueAsNumber / 100;
            */
        } else {
            /*
            message("changeVolume", nonMutedVol || 1);
            */
        }
    })

    volumeInput.addEventListener("input", (e) => {
        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }

//        message("changeVolume", e.target.valueAsNumber / 100);

        // Usually, classList is the right choice. This is one of the instances where it isn't.
        volumeIcon.className = `bx bx-volume-${
            e.target.valueAsNumber > 50 ? 'full' : (
                e.target.valueAsNumber !== 0 ? 'low' :
                    'mute'
            )
        }`;
        

        volumeRange.style.setProperty(
            '--val',
            (e.target.valueAsNumber / 100) + ''
        )
    })

    if (!config.theming.controls.singleCoverMode) {
        let covers = [];
        let pos = 0;
        state.eventHistory.forEach((song) => {
            if ('songName' in song) {
                let thisCover = genCover(song, {
                    current: false,
                    position: state.eventHistory.length - (++pos)
                }, config, state, message);
                covers.push(thisCover);
            }

        })

        if (state.currentEvent && 'songName' in state.currentEvent) {
            let currentCover = genCover(state.currentEvent, {
                current: true,
                position: 0
            }, config, state, message);
            covers.push(currentCover);
        }

        let pos2 = 0;
        state.comingEvents.forEach((song) => {
            if ('songName' in song) {
                let thisCover = genCover(song, {
                    current: false,
                    position: pos2++
                }, config, state, message);
                covers.push(thisCover);
            }
        })
        
        let coversNode = ctNodes.querySelector('#ct_covers');
        covers.forEach(e => coversNode.appendChild(e));

        setTimeout(() => {
            coversNode.querySelector(".ct_current")?.scrollIntoView({
                block: "center",
                behavior: "auto",
                inline: "center"
            })
        }, 100);
    } else {
        let coversNode = ctNodes.querySelector('#ct_covers');
        [...coversNode.children].forEach(e => coversNode.removeChild(e));
        if (state.currentEvent && 'songName' in state.currentEvent) {
            coversNode.appendChild(genCover(
                state.currentEvent, {
                    current: true,
                    position: 0
                },
                config,
                state,
                message
            ));
        }
    }

    return ctNodes;
}

function updateCovers(
    covers: HTMLDivElement,
    config: AnesidoraConfig,
    playerState: AnesidoraState,
    message: <expectedResponse>(
        name: Message['name'],
        data?: Message['data']
    ) => Promise<expectedResponse>
) {
    const children: HTMLDivElement[] = [];
    [...covers.children].forEach(e => e instanceof HTMLDivElement && children.push(e));

    const feed: AnesidoraFeedItem[] = [
        ...playerState.eventHistory,
        playerState.currentEvent,
        ...playerState.comingEvents
    ].filter(e => !!e); // if currentSong is undefined, pop it

    const prevSongsLength = playerState.eventHistory.filter(e => 'trackToken' in e).length;
    feed.forEach((song, i) => {
        let elem: HTMLElement;
        const where = (i - prevSongsLength);
        const oldElem = children.find(e => ((
            'adToken' in song ? 
                song.adToken === e.id : 
                ('trackToken' in song ?
                    song.trackToken === e.id :
                    false
                )
        )));
        if (oldElem) {
            elem = oldElem;
        }
        if (!elem && 'trackToken' in song) {
            elem = genCover(song, {
                position: where,
                current: where === 0
            }, config, playerState, message);
            covers.appendChild(elem);
        } else if ('trackToken' in song) {
            elem.querySelector<HTMLElement>(".ct_position").innerText = (
                where > 0 ? (
                    where === 1 ?
                        "Next song" :
                        `Coming in ${where} songs`
                ) : (
                    where === 0 ?
                        "Previous song" :
                        `${(where) * -1} songs ago`
                )
            );
            elem.setAttribute("data-where", where + '');
            if (where < 0) {
                let remB = elem.querySelector<HTMLButtonElement>('.ct_remove');
                if (remB) {
                    remB.parentElement.removeChild(remB);
                }
            }
        } else {
            //  Update
        }

        if (where === 0) {
            elem.classList.add("ct_current");
        } else {
            elem.classList.remove("ct_current");
        }
        if (where > 0) {
            elem.classList.add("ct_leftAlign");
        } else {
            elem.classList.remove("ct_leftAlign");
        }
    });
    const feedIds = feed.map(e => (
        'adToken' in e ? 
            e.adToken : 
            ('trackToken' in e ?
                e.trackToken :
                false
            )
    )).filter(e => !!e);
    const toRemove = children.filter(e => !feedIds.includes(e.id) && e.classList.contains('ct_cover'));
    toRemove.forEach(e => {
        covers.scrollLeft -= e.clientWidth;
        e.parentElement && e.parentElement.removeChild(e);
    });

    if (config.controlsPane.autoScroll && covers.querySelector(".ct_current")) {
        // janky as hell
        // but it doesn't work without two
        // look I don't know why either
        // just don't touch it
        ignoreAutoScroll = true;
        setTimeout(() => {
            ignoreAutoScroll = true;
            covers.querySelector(".ct_current").scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center"
            });
        }, 100);
        setTimeout(() => {
            ignoreAutoScroll = true;
            covers.querySelector(".ct_current").scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "center"
            });
            setTimeout(() => {
                ignoreAutoScroll = false;
            }, SMOOTH_SCROLL_TIME);
        }, 1000);
    }
}