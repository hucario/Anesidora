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
			.parseFromString(str.replace(/(	)|\t/g,''), "text/html")
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

// ConfigItem
type CI<t extends keyof AnesidoraConfig> = AnesidoraConfig[t];
// ThemeItem
type TI<t extends keyof AnesidoraConfig['theming']['bookmarks']> = 
	AnesidoraConfig['theming']['bookmarks'][t];

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
	let bookmarks: Bookmarks;
	bookmarks = await message<Bookmarks>("toBg_getBookmarks");
	

	let bPNodes = buildPane(config, bookmarks);

	/**
	 * Honestly the partial updating is the most complicated part
	 */

	subscribe("toTabs_configChanged", (reply) => {
		if (reply.name !== 'toTabs_configChanged') {
			return;
		}

		const d = {
			key: reply.data.key,
			old: <AnesidoraConfig[keyof AnesidoraConfig]>reply.data.oldValue,
			new: <AnesidoraConfig[keyof AnesidoraConfig]>reply.data.newValue
		}

		const segments = reply.data.key.split('.');
		const bkT = config.theming.bookmarks;
		const commT = config.theming.common;

		let groups: {
			artistGroup: null | Element,
			combinedGroup: null | Element,
			songGroup: null | Element
		} = {
			artistGroup: null,
			combinedGroup: null,
			songGroup: null
		}

		if (bkT.combined) {
			groups.combinedGroup = bPNodes.children[1];
		} else if (bkT.groupMode === 'artist_first') {
			groups.artistGroup = bPNodes.children[1];
			groups.songGroup = bPNodes.children[3];
		} else {
			groups.artistGroup = bPNodes.children[3];
			groups.songGroup = bPNodes.children[1];
		}

		switch (<keyof AnesidoraConfig>segments[0]) {
			case 'searchProvider':
				for (const anchor of bPNodes.getElementsByTagName("a")) {
					if (anchor.href.startsWith(<CI<'searchProvider'>>d.old)) {
						anchor.href = anchor.href
							.replace(
								<CI<'searchProvider'>>d.old,
								<CI<'searchProvider'>>d.new
							);
					}
				}
				break;
			case 'theming':
				if (segments.length === 1) {
					throwHere(`Do not set config.theming directly.`);
				}
				switch (<keyof AnesidoraConfig['theming']>segments[1]) {
					case 'bookmarks':
					case 'common':
						if (segments.length === 2) {
							throwHere(`Do not set config.theming.${segments[1]} directly.`);
						}
						switch (<keyof AnesidoraConfig['theming']['bookmarks']>segments[2]) {
							case 'padding':
								bPNodes.style.padding = <TI<'padding'>>d.new;
								break;
							case 'backgroundColor':
								bPNodes.style.background = <TI<'backgroundColor'>>d.new;
								break;
							case 'textColor':
								bPNodes.style.color = <TI<'textColor'>>d.new;
								break;
							case 'mode':
							case 'combined':
								let oldbPNodes = bPNodes;
								bPNodes = buildPane(config, bookmarks);
								oldbPNodes.replaceWith(bPNodes)
								break;

							case 'groupMode':
								if (!config.theming.bookmarks.combined) {
									bPNodes.appendChild(bPNodes.children[2])
									bPNodes.appendChild(bPNodes.children[3])	
								}
								break;

							case 'artistGroup':
							case 'combinedGroup':
							case 'songGroup':
								if (segments.length === 3) {
									throwHere(`Do not set config.theming.bookmarks.${segments[2]} directly.`);
								}
								switch (<keyof AnesidoraConfig['theming']['bookmarks']['artistGroup']>segments[3]) {
									case 'columns':
										(<HTMLElement>groups[segments[2]]).style.setProperty(
											'--column-count',
											'' + <TI<'artistGroup'>['columns']>d.new
										);
										break;
									case 'gap':
										(<HTMLElement>groups[segments[2]]).style.setProperty(
											'--gap',
											'' + <TI<'artistGroup'>['gap']>d.new
										);
										break;
									case 'imgSize':
										(<HTMLElement>groups[segments[2]]).style.setProperty(
											'--img-size',
											'' + <TI<'artistGroup'>['imgSize']>d.new
										);
										break;										
								}
								break;
							case 'defaultAlbumCover':
								for (const img of bPNodes.getElementsByTagName("img")) {
									if (img.src === <TI<'defaultAlbumCover'>>d.old) {
										img.src = <TI<'defaultAlbumCover'>>d.new;
									}
								}
								break;
						}
						break;
				} 
		}
	})

	subscribe('toTabs_bookmarkUpdated', (msg) => {
		if (msg.name !== 'toTabs_bookmarksUpdated') {
			return;
		}
		let oldbPNodes = bPNodes;
		bookmarks = msg.data;
		bPNodes = buildPane(config, msg.data);
		oldbPNodes.replaceWith(bPNodes)
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