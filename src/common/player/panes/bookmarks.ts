//TODO: Context menus: Delete, create station from artist & song

import { Bookmarks } from "../../background/pandora.js";
import { AnesidoraConfig } from "../../background/store.js";
import { Message } from "../../messages.js";

function throwHere(msg: string): never {
    console.error(`%cbookmarks.ts: "${msg}"`, `
        color: #15799d;
        font-weight: bold;
        font-family: 'Inter', sans-serif;
    `)
    throw new Error(msg)
}

function logHere(...data: any[]) {
    console.log('%cbookmarks.ts:', `
    color: #15799d;
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

function errorHere(...data: any[]) {
    console.error('%cbookmarks.ts:', `
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}


const bookmarksPaneHtml = `<div class="pane bookmarks"></div>`;

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

export default async function SetupBookmarksPane(
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
    const isLoggedIn = await message<boolean>("isLoggedIn");
    let bookmarks: Bookmarks;
    if (isLoggedIn) {
        bookmarks = await message<Bookmarks>("getBookmarks");
    } else {
        bookmarks = {
            artists: [],
            songs: []
        }
    }
    

    let bPNodes = buildPane(config, bookmarks);

    /**
     * Honestly the partial updating is the most complicated part
     */

    subscribe("configChanged", (reply) => {
        if (reply.name !== 'configChanged') {
            return;
        }

        if (reply.data.key === 'searchProvider') {
            const d = reply.data as {
                oldValue: AnesidoraConfig['searchProvider']
                newValue: AnesidoraConfig['searchProvider']
            }

            const anchors = bPNodes.getElementsByTagName("a");
            for (const anchor of anchors) {
                if (anchor.href.startsWith(d.oldValue)) {
                    anchor.href = anchor.href.replace(d.oldValue, d.newValue);
                }
            }
            return;
        }

        if (reply.data.key === 'bookmarksPane') {
            const d = reply.data as {
                newValue: AnesidoraConfig['bookmarksPane']
            }
            /**
             * There are no settings for this... yet...
             */

            return;
        }

        if (reply.data.key === 'theming') {
            const d = reply.data as {
                newValue: AnesidoraConfig['theming']
            };

            const oldTheme = {
                ...config.theming.bookmarks,
                ...config.theming.common
            }
            const newTheme = {
                ...d.newValue.bookmarks,
                ...d.newValue.common
            }
            

            bPNodes.style.padding = newTheme.padding;
            bPNodes.style.backgroundColor = newTheme.backgroundColor;
            bPNodes.style.color = newTheme.textColor;

            config.theming = d.newValue;

            /**
             * Things we need to rebuild for:
             * - Changing modes
             * 
             * We can't check objects for changes directly,
             * as runtime.sendMessage is pass-by-value, not by reference
             * 
             * So we'll just have to check values manually
             */

            let totally_rebuilding = false;

            let bPChildren: HTMLElement[] = [];
            [...bPNodes.children].forEach(e => {
                if (e instanceof HTMLElement) {
                    bPChildren.push(e);
                }
            });

            if (
                (newTheme.mode !== oldTheme.mode) ||
                (newTheme.combined !== oldTheme.combined)
            ) {
                totally_rebuilding = true;
            }
            if (!totally_rebuilding) {
                if (newTheme.backgroundColor !== oldTheme.backgroundColor) {
                    bPNodes.style.background = newTheme.backgroundColor;
                }
                if (newTheme.padding !== oldTheme.padding) {
                    bPNodes.style.padding = newTheme.padding;
                }
                if (newTheme.textColor !== oldTheme.textColor) {
                    bPNodes.style.color = newTheme.textColor;
                }
    
                let artistGroup: HTMLElement | null;
                let songGroup: HTMLElement | null;
                let combinedGroup: HTMLElement | null;
    
                if (oldTheme.combined) {
                    artistGroup = songGroup = null;
                    combinedGroup = bPChildren[1];
                } else if (oldTheme.groupMode === 'artist_first') {
                    artistGroup = bPChildren[1];
                    songGroup = bPChildren[3];
                    combinedGroup = null;
                } else {
                    artistGroup = bPChildren[3];
                    songGroup = bPChildren[1];
                    combinedGroup = null;
                }
    
                const groupKeys = [
                    ["artistGroup", artistGroup],
                    ["combinedGroup", combinedGroup],
                    ["songGroup", songGroup]
                ] as const;
    
                for (let key of groupKeys) {
                    if (oldTheme[key[0]].columns !== newTheme[key[0]].columns) {
                        key[1].style.setProperty('--column-count', '' + newTheme[key[0]].columns);
                    }
                    if (oldTheme[key[0]].gap !== newTheme[key[0]].gap) {
                        key[1].style.setProperty('--gap', newTheme[key[0]].gap);
                    }
                    if (oldTheme[key[0]].columns !== newTheme[key[0]].columns) {
                        key[1].style.setProperty('--img-size', newTheme[key[0]].imgSize);
                    }
                }
    
                if (newTheme.groupMode != oldTheme.groupMode && !oldTheme.combined) {
                    // just swap em around >:)
                    bPNodes.appendChild(bPChildren[2])
                    bPNodes.appendChild(bPChildren[3])    
                }
                if (newTheme.defaultAlbumCover !== oldTheme.defaultAlbumCover) {
                    for (const img of bPNodes.getElementsByTagName("img")) {
                        if (img.src === oldTheme.defaultAlbumCover) {
                            img.src = newTheme.defaultAlbumCover;
                        }
                    }
                }
            } else {
                config.theming = d.newValue;
                let oldbPNodes = bPNodes;
                bPNodes = buildPane(config, bookmarks);
                oldbPNodes.replaceWith(bPNodes)
            }
        }
    })

    return bPNodes;
}

function buildPane(config: AnesidoraConfig, bookmarks: Bookmarks): HTMLElement {

    /** Bookmarks Pane Nodes */
    let bPNodes = strToHtml(bookmarksPaneHtml)[0];

    const theme = {
        ...config.theming.bookmarks,
        ...config.theming.common
    }

    bPNodes.style.padding = theme.padding;
    bPNodes.style.backgroundColor = theme.backgroundColor;
    bPNodes.style.color = theme.textColor;

    bPNodes.classList.add(theme.mode);

    let artist_group: HTMLElement;
    let song_group: HTMLElement;

    let [artistsHeader, artistsGroup, songsHeader, songsGroup] = strToHtml(`
        <span class="bm_groupHeader">Artists</span>
        <div class="bm_group"></div>
        <span class="bm_groupHeader">Songs</span>
        <div class="bm_group"></div>
    `);

    if (theme.groupMode === "artist_first") {
        if (theme.combined) {
            artistsHeader.innerText = "Bookmarks"
            bPNodes.appendChild(artistsHeader);
            bPNodes.appendChild(artistsGroup);
            artist_group = artistsGroup;
            song_group = artistsGroup;
            artist_group.style.setProperty('--gap', theme.combinedGroup.gap);
            artist_group.style.setProperty('--column-count', '' + theme.combinedGroup.columns);
            artist_group.style.setProperty('--img-size', theme.combinedGroup.imgSize);
        } else {
            bPNodes.appendChild(artistsHeader);
            bPNodes.appendChild(artistsGroup);
            bPNodes.appendChild(songsHeader);
            bPNodes.appendChild(songsGroup);
            artist_group = artistsGroup;
            song_group = songsGroup;
            artist_group.style.setProperty('--gap', theme.artistGroup.gap);
            artist_group.style.setProperty('--column-count', '' + theme.artistGroup.columns);
            artist_group.style.setProperty('--img-size', theme.artistGroup.imgSize);
        
            song_group.style.setProperty('--gap', theme.songGroup.gap);
            song_group.style.setProperty('--column-count', '' + theme.songGroup.columns);
            song_group.style.setProperty('--img-size', theme.songGroup.imgSize);
        }
    } else {
        if (theme.combined) {
            artistsHeader.innerText = "Bookmarks"
            bPNodes.appendChild(artistsHeader);
            bPNodes.appendChild(artistsGroup);
            artist_group = artistsGroup;
            song_group = artistsGroup;
            artist_group.style.setProperty('--gap', theme.combinedGroup.gap);
            artist_group.style.setProperty('--column-count', '' + theme.combinedGroup.columns);
            artist_group.style.setProperty('--img-size', theme.combinedGroup.imgSize);
        } else {
            bPNodes.appendChild(songsHeader);
            bPNodes.appendChild(songsGroup);
            bPNodes.appendChild(artistsHeader);
            bPNodes.appendChild(artistsGroup);
            artist_group = artistsGroup;
            song_group = songsGroup;
            artist_group.style.setProperty('--gap', theme.artistGroup.gap);
            artist_group.style.setProperty('--column-count', '' + theme.artistGroup.columns);
            artist_group.style.setProperty('--img-size', theme.artistGroup.imgSize);
        
            song_group.style.setProperty('--gap', theme.songGroup.gap);
            song_group.style.setProperty('--column-count', '' + theme.songGroup.columns);
            song_group.style.setProperty('--img-size', theme.songGroup.imgSize);
        }
    }


    if (theme.mode === "squares") {
        const bmArtistNode = strToHtml(`
            <a class="bookmark">
                <img class="bm_img" />
                <div class="bm_infoGroup">
                    <span class="bm_head"></span>
                </div>
            </a>
        `)[0];
        const bmSongNode = strToHtml(`
        <div class="bookmark song">
            <img class="bm_img" />
            <a class="bm_playHolder" target="_blank">
                <i class="bx bx-play"></i>
            </a>
            <div class="bm_infoGroup">
                <a class="bm_head"></a><br />
                <span class="bm_head2"></span>
            </div>
        </div>`)[0];
        for (let bm of bookmarks.artists) {
            let thisBookmark = bmArtistNode.cloneNode(true);
            if (!(thisBookmark instanceof HTMLAnchorElement)) {
                continue;
            }
            thisBookmark.href = `https://pandora.com/artist/AR:${bm.musicToken.substr(1)}`

            thisBookmark.getElementsByTagName("img")[0].src = (
                typeof bm.artUrl !== "undefined" &&
                bm.artUrl.length !== 0 ?
                    bm.artUrl :
                    theme.defaultAlbumCover 
            );
            

            let h1 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head');
            h1.innerText = bm.artistName;


            artist_group.appendChild(thisBookmark);
        }
        for (let bm of bookmarks.songs) {
            let thisBookmark = bmSongNode.cloneNode(true);
            if (!(thisBookmark instanceof HTMLElement)) {
                continue;
            }

            thisBookmark.getElementsByTagName("img")[0].src = (
                typeof bm.artUrl !== "undefined" &&
                bm.artUrl.length !== 0 ?
                    bm.artUrl :
                    theme.defaultAlbumCover 
            );
            thisBookmark.querySelector<HTMLAnchorElement>('.bm_playHolder')
                .href = 
                    config.searchProvider + encodeURIComponent(
                        `${bm.songName} ${bm.artistName}`
                    );




            let h1 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head');
            h1.innerText = bm.songName;

            h1.href = `https://pandora.com/track/TR:${bm.musicToken.substr(1)}`
            
            let h2 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head2');
            h2.innerText = bm.artistName;

            song_group.appendChild(thisBookmark);
        }
    } else if (theme.mode === "widesquares") {
        const bmArtistNode = strToHtml(`
            <a class="bookmark">
                <div class="bm_imgGroup">
                    <img class="bm_img" />
                </div>
                <span class="bm_head"></span>
            </a>
        `)[0];
        const bmSongNode = strToHtml(`
        <div class="bookmark song">
            <div class="bm_imgGroup">
                <img class="bm_img" />
                <a class="bm_playHolder" target="_blank">
                    <i class="bx bx-play"></i>
                </a>
            </div>
            <div class="bm_infoGroup">
                <a class="bm_head"></a>
                <span class="bm_head2"></span>
            </div>
        </div>`)[0];
        for (let bm of bookmarks.artists) {
            let thisBookmark = bmArtistNode.cloneNode(true);
            if (!(thisBookmark instanceof HTMLAnchorElement)) {
                continue;
            }
            thisBookmark.href = `https://pandora.com/artist/AR:${bm.musicToken.substr(1)}`

            thisBookmark.getElementsByTagName("img")[0].src = (
                typeof bm.artUrl !== "undefined" &&
                bm.artUrl.length !== 0 ?
                    bm.artUrl :
                    theme.defaultAlbumCover 
            );
            

            let h1 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head');
            h1.innerText = bm.artistName;


            artist_group.appendChild(thisBookmark);
        }
        for (let bm of bookmarks.songs) {
            let thisBookmark = bmSongNode.cloneNode(true);
            if (!(thisBookmark instanceof HTMLElement)) {
                continue;
            }

            thisBookmark.getElementsByTagName("img")[0].src = (
                typeof bm.artUrl !== "undefined" &&
                bm.artUrl.length !== 0 ?
                    bm.artUrl :
                    theme.defaultAlbumCover 
            );
            thisBookmark.querySelector<HTMLAnchorElement>('.bm_playHolder')
                .href = 
                    config.searchProvider + encodeURIComponent(
                        `${bm.songName} ${bm.artistName}`
                    );




            let h1 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head');
            h1.innerText = bm.songName;

            h1.href = `https://pandora.com/track/TR:${bm.musicToken.substr(1)}`
            
            let h2 = thisBookmark.querySelector<HTMLAnchorElement>('.bm_head2');
            h2.innerText = bm.artistName;

            song_group.appendChild(thisBookmark);
        }
    }

    return bPNodes;
}