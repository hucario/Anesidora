/**
 * TODO: Implement miniplayer mode
 * > perhaps a compact mode? With smaller font and no album art,
 * > so it's just the playhead, song/artist name, and controls?
 * > That ultimately would serve well to replace what I like most
 * > in the Old layout
 */


import { PandoraRating, PandoraSong, PopulatedPandoraAd, UnpopulatedPandoraAd } from "../../background/pandora.js";
import { AnesidoraConfig, AnesidoraFeedItem, AnesidoraState } from "../../background/store.js";
import { Message } from "../../messages.js";
import { setNestedProperty, stripTrackersFromUrl as stripTrackers } from "../../util.js";

let focusedCover = null;

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
			<button id="ct_likeCurrent">
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
			<button id="ct_dislikeCurrent">
				<i class='bx bx-dislike'></i>
			</button>
		</div>
		<div class="ct_volumeGroup">
			<button>
				<i class='bx bx-volume-${
				s.volume > 0.5 ? 'full' : (
					s.volume !== 0 ? 'low' :
						'mute'
				)
				}'></i>
			</button>
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

// Theme Item
type TI<
	t extends keyof (
		AnesidoraConfig['theming']['controls'] &
		AnesidoraConfig['theming']['common']
	)
> = (
	AnesidoraConfig['theming']['controls'] &
	AnesidoraConfig['theming']['common']
)[t];

function ensureInBounds(num: number): number {
	let covers = document.querySelector('#ct_covers');
	return Math.min(
		covers.children.length - 1,
		Math.max(0, num)
	)
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

	addEventListener("keydown", e => {
		if (!e.shiftKey) {
			return;
		}
		let covers = document.querySelector('#ct_covers');
		if (e.key === 'ArrowLeft') {
			e.preventDefault();
			covers.children[ensureInBounds(focusedCover)].classList.remove('ct_active');
			focusedCover = ensureInBounds(focusedCover - 1);
			covers.children[focusedCover].classList.add('ct_active');
			covers.children[focusedCover].scrollIntoView({
				behavior: config.theming.smoothScroll ? 'smooth' : 'auto',
				inline: 'center',
				block: 'center'
			})
		} else if (e.key === 'ArrowRight') {
			e.preventDefault();
			covers.children[ensureInBounds(focusedCover)].classList.remove('ct_active');
			focusedCover = ensureInBounds(focusedCover + 1);
			covers.children[focusedCover].classList.add('ct_active');
			covers.children[focusedCover].scrollIntoView({
				behavior: config.theming.smoothScroll ? 'smooth' : 'auto',
				inline: 'center',
				block: 'center'
			})
		}
	}, { passive: false });

	/*
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

	let likeButton = ctNodes.querySelector<HTMLButtonElement>('#ct_likeCurrent');
	let dislikeButton = ctNodes.querySelector<HTMLButtonElement>('#ct_dislikeCurrent');

	likeButton.addEventListener('click', () => {
		if (
			state.currentStation &&
			state.currentEvent &&
			'trackToken' in state.currentEvent
		) {
			message("toBg_setFeedback", {
				stationToken: state.currentStation,
				trackToken: state.currentEvent.trackToken,
				rating: PandoraRating.THUMBS_UP
			})
		}
	});
	dislikeButton.addEventListener('click', () => {
		if (
			state.currentStation &&
			state.currentEvent &&
			'trackToken' in state.currentEvent
		) {
			message("toBg_setFeedback", {
				stationToken: state.currentStation,
				trackToken: state.currentEvent.trackToken,
				rating: PandoraRating.THUMBS_DOWN
			})
		}
	});

	subscribe("toTabs_seekBarAck", (reply) => {
		if (reply.name !== "toTabs_seekBarAck") {
			return;
		}
		state.currentTime = reply.data;

		if (typeof state.currentTime !== "number") {
			if (state.currentTime === null) {
				timestamp.innerText = '';
				seekRange.style.setProperty(
					'--val',
					'100'
				)
				seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = 100;
			}
			return;
		}
		if (state.currentTime === 0) {
			timestamp.innerText = getFormattedTime(state.currentTime);
			timestamp.innerText += state.duration !== null ?
				' / ' + getFormattedTime(state.duration)
				: '';

			seekRange.style.setProperty(
				'--val',
				'0'
			)	
			seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = 0;
		} else {
			timestamp.innerText = getFormattedTime(state.currentTime);
			timestamp.innerText += state.duration !== null ?
				' / ' + getFormattedTime(state.duration)
				: '';
	
			seekRange.style.setProperty(
				'--val',
				(state.currentTime / state.duration) + ''
			)	
			seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = (state.duration / state.currentTime) * 100;
		}
	})

	// Play/pause button pressed
	subscribe("toTabs_skipButton", (reply) => {
		if (reply.name !== "toTabs_skipButton") {
			// Typeguard
			return;
		}
		
		skipButton.classList.add('activeButton');
	})

	subscribe("toTabs_resetSkip", (msg) => {
		if (msg.name !== "toTabs_resetSkip") {
			return;
		}
		skipButton.classList.remove('activeButton');
	})

	// Play/pause button pressed
	subscribe("toTabs_playButton", (reply) => {
		if (reply.name !== "toTabs_playButton") {
			// Typeguard
			return;
		}
		
		playPauseButton.classList.add('activeButton');
	})

	subscribe("toTabs_resetPlay", (msg) => {
		if (msg.name !== "toTabs_resetPlay") {
			return;
		}
		playPauseButton.classList.remove('activeButton');

		
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
		
		state[msg.data.key] = msg.data.newValue;

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
				if (d.key === 'currentTime') {
					state.currentTime = d.new;
				} else {
					state.duration = d.new;
				}
		
				timestamp.innerText = getFormattedTime(state.currentTime);
				timestamp.innerText += state.duration !== null ?
					' / ' + getFormattedTime(state.duration)
					: '';
		
				seekRange.style.setProperty(
					'--val',
					(state.currentTime / state.duration) + ''
				)	
				seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = (state.duration / state.currentTime) * 100;
		
				break;
			
			case "currentEvent":
				if (d.new && typeof d.new === 'object') {
					if ('trackToken' in d.new) {
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
					} else if (d.new && 'adToken' in d.new) {
						if (d.new.populated) {
							ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span").style.display = "none";
							ctNodes.querySelector(".ct_otherButtons").classList.remove("ct_nothingPlaying");
							ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span")
							.innerText = "Play to resume last station";
							
							let artistLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_artistLink");
							let titleLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_titleLink");
							let albumLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_albumLink");
							
							artistLink.href = d.new.clickThroughUrl;
							artistLink.innerText = d.new.companyName;
							
							titleLink.href = d.new.clickThroughUrl;
							titleLink.innerText = d.new.title;
							
							albumLink.href = d.new.clickThroughUrl;
							// TODO: Config option for this?
							albumLink.innerText = "Advertisement";
						}
					}
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

				updateCovers(
					ctNodes.querySelector("#ct_covers"),
					config,
					state,
					message
				);
				break;
			
			case "volume":
				if (typeof d.new !== "number" || d.new > 1 || d.new < 0) {
					break;
				}
				const volumeRange = ctNodes.querySelectorAll<HTMLElement>(".range")[1];
				const volumeInput = volumeRange.querySelector<HTMLInputElement>("input");
				const volumeIcon = volumeRange.parentElement.children[0].children[0];

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
				break;

			default:
				logHere(`Unhandled state change: ${d.key} = ${d.new}, (was: ${d.old})`);
		}
	})

	subscribe("toTabs_removedFromQueue", (reply) => {
		if (reply.name !== 'toTabs_removedFromQueue') {
			return;
		}

		const index = state.comingEvents.findIndex(e => e.uniqueSessionId === reply.data);
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

	subscribe("toTabs_settingFeedback", msg => {
		if (msg.name !== 'toTabs_settingFeedback') {
			return;
		}

		if (
			state.currentEvent &&
			'trackToken' in state.currentEvent &&
			state.currentEvent.trackToken === msg.data.trackToken &&
			state.currentStation === msg.data.stationToken
		) {
			if (msg.data.rating === PandoraRating.THUMBS_UP) {
				likeButton.classList.add('activeButton');
			} else if (msg.data.rating === PandoraRating.THUMBS_DOWN) {
				dislikeButton.classList.add('activeButton');
			}
		}

		let elems = ratingButtons[msg.data.stationToken + msg.data.trackToken]
		if (elems) {
			if (document.contains(elems.likeButton)) {
				if (msg.data.rating === PandoraRating.THUMBS_UP) {
					elems.likeButton.classList.add('activeButton')
				} else if (msg.data.rating === PandoraRating.THUMBS_DOWN) {
					elems.dislikeButton.classList.add('activeButton');
				}
			} else {
				delete ratingButtons[msg.data.stationToken + msg.data.trackToken];
			}
		}
	})

	subscribe("toTabs_feedbackSet", msg => {
		if (msg.name !== 'toTabs_feedbackSet') {
			return;
		}

		if (
			state.currentEvent &&
			'trackToken' in state.currentEvent &&
			state.currentEvent.trackToken === msg.data.trackToken &&
			state.currentStation === msg.data.stationToken
		) {
			if (msg.data.rating === PandoraRating.THUMBS_UP) {
				likeButton.classList.remove('activeButton');
				likeButton.children[0].className = "bx bxs-like";
				dislikeButton.children[0].className = "bx bx-dislike";
			} else if (msg.data.rating === PandoraRating.THUMBS_DOWN) {
				dislikeButton.classList.remove('activeButton');
				likeButton.children[0].className = "bx bx-like";
				dislikeButton.children[0].className = "bx bxs-dislike";
			}
		}

		let elems = ratingButtons[msg.data.stationToken + msg.data.trackToken]
		if (elems) {
			if (document.contains(elems.likeButton)) {
				if (msg.data.rating === PandoraRating.THUMBS_UP) {
					elems.likeButton.classList.remove('activeButton');
					elems.likeButton.children[0].className = "bx bxs-like";
					elems.dislikeButton.children[0].className = "bx bx-dislike";
				} else if (msg.data.rating === PandoraRating.THUMBS_DOWN) {
					elems.dislikeButton.classList.remove('activeButton');
					elems.likeButton.children[0].className = "bx bx-like";
					elems.dislikeButton.children[0].className = "bx bxs-dislike";
				}
			} else {
				delete ratingButtons[msg.data.stationToken + msg.data.trackToken];
			}
		}
	})

	subscribe("toTabs_updatedFeed", msg => {
		if (msg.name !== 'toTabs_updatedFeed') {
			return;
		}
		let newState: AnesidoraState = {
			...state,
			currentEvent: msg.data.curr,
			comingEvents: msg.data.next,
			eventHistory: msg.data.history,
			duration: msg.data.newDuration,
			currentTime: 0
		}
		state = newState;

		timestamp.innerText = getFormattedTime(newState.currentTime);
		timestamp.innerText += newState.duration !== null ?
			' / ' + getFormattedTime(newState.duration)
			: '';

		seekRange.style.setProperty(
			'--val',
			'0'
		)	
		seekRange.querySelector<HTMLInputElement>("input").valueAsNumber = 0;

		if (newState.currentEvent && typeof newState.currentEvent === 'object') {
			if ('trackToken' in newState.currentEvent) {
				ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span").style.display = "none";
				ctNodes.querySelector(".ct_otherButtons").classList.remove("ct_nothingPlaying");
				ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span")
				.innerText = "Play to resume last station";
				
				let artistLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_artistLink");
				let titleLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_titleLink");
				let albumLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_albumLink");
				
				artistLink.href = newState.currentEvent.artistDetailUrl;
				artistLink.innerText = newState.currentEvent.artistName;
				
				titleLink.href = newState.currentEvent.songDetailUrl;
				titleLink.innerText = newState.currentEvent.songName;
				
				albumLink.href = newState.currentEvent.albumDetailUrl;
				albumLink.innerText = newState.currentEvent.albumName;
			} else if (newState.currentEvent && 'adToken' in newState.currentEvent) {
				if (newState.currentEvent.populated) {
					ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span").style.display = "none";
					ctNodes.querySelector(".ct_otherButtons").classList.remove("ct_nothingPlaying");
					ctNodes.querySelector<HTMLSpanElement>(".ct_musicInfo > span")
					.innerText = "Play to resume last station";
					
					let artistLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_artistLink");
					let titleLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_titleLink");
					let albumLink = ctNodes.querySelector<HTMLAnchorElement>("#ct_albumLink");
					
					artistLink.href = newState.currentEvent.clickThroughUrl;
					artistLink.innerText = newState.currentEvent.companyName;
					
					titleLink.href = newState.currentEvent.clickThroughUrl;
					titleLink.innerText = newState.currentEvent.title;
					
					albumLink.href = newState.currentEvent.clickThroughUrl;
					// TODO: Config option for this?
					albumLink.innerText = "Advertisement";
				}
			}
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

		updateCovers(
			ctNodes.querySelector("#ct_covers"),
			config,
			newState,
			message
		);
	})

	subscribe("toTabs_playingStation", reply => {
		if (reply.name !== 'toTabs_playingStation') {
			return;
		}
		state.currentStation = reply.data;
	})

	subscribe("toTabs_configChanged", (reply) => {
		if (reply.name !== 'toTabs_configChanged') {
			return;
		}

		setNestedProperty(config, reply.data.key, reply.data.newValue);

		const d = {
			key: reply.data.key,
			new: reply.data.newValue,
			old: reply.data.oldValue
		};

		const segments = d.key.split('.');
		switch (<keyof AnesidoraConfig>segments[0]) {
			case 'theming':
				if (segments.length === 1) {
					throwHere(`config.theming should not be set directly.`);
				}
				switch (<keyof AnesidoraConfig['theming']>segments[1]) {
					case 'common':
					case 'controls':
						if (segments.length === 2) {
							throwHere(`config.theming.${segments[1]} should not be set directly.`)
						}
						const common = config.theming.common;
						const ctl = config.theming.controls;
						switch (<keyof (AnesidoraConfig['theming']['controls'] & AnesidoraConfig['theming']['common'])>segments[2]) {
							case 'accentColor':
								ctNodes.style.setProperty(
									'--accent-color',
									common.accentColor ?? <TI<'accentColor'>>d.new
								);
								break;

							case 'backgroundColor':
								ctNodes.style.background = common.backgroundColor ?? <TI<'backgroundColor'>>d.new;
								break;

							case 'defaultAlbumCover':
								for (let img of ctNodes.getElementsByTagName('img')) {
									if (img.src === d.old) {
										img.src = <TI<'defaultAlbumCover'>>d.new;
									}
								}
								break;

							case 'miniPlayerMode':
								// TODO: Miniplayer mode
								break;

							case 'padding':
								ctNodes.style.padding = common.padding ?? <TI<'padding'>>d.new;
								break;

							case 'rangeBgColor':
								ctNodes.style.setProperty(
									'--seek-bgcolor',
									ctl.seekBgColor ?? <TI<'rangeBgColor'>>d.new
								);
								ctNodes.style.setProperty(
									'--volume-bgcolor',
									ctl.volumeBgColor ?? <TI<'rangeBgColor'>>d.new
								);
								break;

							case 'singleCoverMode':
								// TODO: Switch between Single/Multi cover mode
								break;

							case 'textColor':
								ctNodes.style.color = common.textColor ?? <TI<'textColor'>>d.new;
								break;
							case 'volumeColor':
								ctNodes.style.setProperty(
									'--volume-color',
									<TI<'volumeColor'>>d.new ?? ctl.rangeColor ?? common.accentColor ?? ctl.accentColor
								);
								break;
							case 'seekColor':
								ctNodes.style.setProperty(
									'--seek-color',
									<TI<'seekColor'>>d.new ?? ctl.rangeColor ?? common.accentColor ?? ctl.accentColor
								);
								break;
							case 'volumeBgColor':
								ctNodes.style.setProperty(
									'--volume-bgcolor',
									<TI<'volumeBgColor'>>d.new ?? ctl.rangeBgColor
								);
								break;
							case 'seekBgColor':
								ctNodes.style.setProperty(
									'--seek-bgcolor',
									<TI<'seekBgColor'>>d.new ?? ctl.rangeBgColor
								);
								break;

							default:
								logHere(`Attempt was made to set config.${d.key}, but nothing happened as it's not a real key(?)`);
								break;
						}
						break;
				}
				break;

				case 'stripTrackers':
					if (d.new && !d.old) {
						// bad -> good
						for (let anchor of ctNodes.getElementsByTagName('a')) {
							if (anchor.href.includes('pandora.com')) {
								anchor.setAttribute('data-trackerlink', anchor.href);
								anchor.href = stripTrackers(anchor.href);
							}
						}	
					} else if (!d.new && d.old) {
						// good -> bad, restore backups
						for (let anchor of ctNodes.getElementsByTagName('a')) {
							if (anchor.getAttribute('data-trackerlink')) {
								anchor.href = anchor.getAttribute('data-trackerlink');
								anchor.removeAttribute('data-trackerlink')
							}
						}
					}
					break;

				case 'controlsPane':
					if (segments.length === 1) {
						throwHere(`config.controlsPane should not be set directly.`)
					}
					switch (<keyof AnesidoraConfig['controlsPane']>segments[1]) {
						case 'autoScroll':
							// Do nothing, it's automatically set.
							// Good to have noted as covered, though.
							break;
					}
		}
	});
	return ctNodes;
}

const ratingButtons: {
	[key: string]: {
		likeButton: HTMLElement,
		dislikeButton: HTMLElement
	}
} = {}

// ANCHOR cover html
const genCover = (
	e: PandoraSong | PopulatedPandoraAd,
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
 id="${e.uniqueSessionId}"
 class="ct_cover ${
	(
		 ('albumArtUrl' in e && e.albumArtUrl) ||
		 ('imageUrl' in e && e.imageUrl)
	) ? 
		'' : 
		'ct_noCover'
	} ${i.current ? "ct_current" : ''}"
>
	<div class="ct_info">
		<span class="ct_position">${i.position > 0 ? (
				i.position === 1 ?
					"Next song" :
					`Coming in ${i.position} songs`
			) : (
				i.position === -1 ?
					"Previous song" :
					`${(i.position) * -1} songs ago`
		)}</span>
		<span class="ct_author">${
			'trackToken' in e ?
				e.artistName :
				e.companyName
		}</span>
		<span class="ct_songTitle">${
			'trackToken' in e ?
				e.songName : 
				e.title
		}</span>
		<span class="ct_albumTitle">${
			'trackToken' in e 
				? e.albumName :
				// TODO: Config option for this? Localization?
				'Advertisement'
		}</span>
		<div class="ct_coverActions">
			${'songRating' in e ? 
			`<button class="ct_coverLike" alt="Like this track">
				<i
				 class="bx bx${
					e.songRating === PandoraRating.THUMBS_UP ?
						"s" : ""
				}-like"></i>
			</button>${/* Yes, this is on purpose.*/''}
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
			<button class="ct_coverDislike" alt="Dislike this track">
				<i class="bx bx${
					e.songRating === PandoraRating.THUMBS_DOWN ?
						"s" : ""
				}-dislike"></i>
			</button>` : ''}
				${
					i.position > 0 ? 
					`<button class="ct_playCover" alt="Play this track">
						<i class="bx bx-play"></i>
					</button>` : ""
				}
				${ i.position > 0 ? // TODO: Config option for whether this is a thing you can do
					`<button class="ct_remove">
						<i class="bx bx-x"></i>
					</button>` : "" }
			</div>
		</div>
	<img
	 class="ct_actualCover" 
	 src="${
		 'trackToken' in e ? 
		 	(e.albumArtUrl && e.albumArtUrl.length !== 0 ?
				e.albumArtUrl :
				(
					config.theming.common.defaultAlbumCover ??
					config.theming.controls.defaultAlbumCover
				)
			) : 
			e.imageUrl && e.imageUrl.length !== 0 ?
				e.imageUrl :
				(
					config.theming.common.defaultAlbumCover ??
					config.theming.controls.defaultAlbumCover
				)
	}"
	/>
</div>
	`)[0];

	const stationToken = state.currentStation;

	const likeButton = nodes
	.querySelector<HTMLButtonElement>('.ct_coverLike');
	const dislikeButton = nodes
	.querySelector<HTMLButtonElement>('.ct_coverDislike');
	const removeButton = nodes
	.querySelector<HTMLButtonElement>('.ct_remove');
	const playButton = nodes
	.querySelector<HTMLButtonElement>('.ct_playCover');

	playButton?.addEventListener('click', () => message("toBg_coverPlayButtonPress", e.uniqueSessionId))
	removeButton?.addEventListener('click', () => message("toBg_removeFromQueue", e.uniqueSessionId))
	likeButton?.addEventListener("click", () => {
		if ('trackToken' in e) {
			message("toBg_setFeedback", {
				trackToken: e.trackToken,
				stationToken,
				rating: PandoraRating.THUMBS_UP
			});
		}
	})
	dislikeButton?.addEventListener("click", () => {
		if ('trackToken' in e) {
			message("toBg_setFeedback", {
				trackToken: e.trackToken,
				stationToken,
				rating: PandoraRating.THUMBS_DOWN
			});
		}
	})

	if (likeButton && dislikeButton && 'trackToken' in e) {
		ratingButtons[stationToken + e.trackToken] = {
			likeButton,
			dislikeButton
		}
	}

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

	const volumeIcon = volumeRange.parentElement.children[0].children[0];

	seekInput.valueAsNumber = (
		state.currentTime !== null && state.duration !== null ? (
			(state.currentTime / state.duration) * 100
		) : 0
	);

	volumeInput.valueAsNumber = state.volume * 100;

	seekInput.addEventListener("input", (e) => {
		if (!(e.target instanceof HTMLInputElement)) {
			return;
		}
		message("toBg_seekBarDrag", state.duration * e.target.valueAsNumber / 100);
	})

	volumeRange.parentElement.children[0].addEventListener("click", () => {
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

//		message("changeVolume", e.target.valueAsNumber / 100);

		// Usually, classList is the right choice. This is one of the instances where it isn't.
/*		volumeIcon.className = `bx bx-volume-${
			e.target.valueAsNumber > 50 ? 'full' : (
				e.target.valueAsNumber !== 0 ? 'low' :
					'mute'
			)
		}`;
		

		volumeRange.style.setProperty(
			'--val',
			(e.target.valueAsNumber / 100) + ''
		)*/
	})

	if (!config.theming.controls.singleCoverMode) {
		updateCovers(
			ctNodes.querySelector('#ct_covers'),
			config,
			state,
			message
		);

	} else {
		let coversNode = ctNodes.querySelector('#ct_covers');
		for (let child of coversNode.children) {
			coversNode.removeChild(child);
		}
		if (state.currentEvent && !('eventType' in state.currentEvent)) {
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
	const feed: AnesidoraFeedItem[] = [
		...playerState.eventHistory,
		playerState.currentEvent,
		...playerState.comingEvents
	].filter(e => !!e); // if currentSong is undefined, pop it

	let shouldBeHere = [];

	feed.forEach((item, i) => {
		shouldBeHere.push(item.uniqueSessionId);
		let elem: HTMLElement = covers.children[item.uniqueSessionId];
		const where = (i - playerState.eventHistory.length);
		if (!elem) {
			if ('eventType' in item) {
				switch (item.eventType) {
					case 'stationChange':
						// TODO: Options for different stationchange indicators?
						elem = strToHtml(`
							<div class="ct_event ct_stationChangeIndicator" id="${item.uniqueSessionId}">
								<span class="ct_eventHeader">${
									item.data.from ? "Station change" : "Station start"
								}</span>
								<div class="ct_stationEvent__group ${
									item.data.from ? '' : 'ct_stationEvent__noStart'
								}">
									${item.data.from ? 
										`<div class="ct_stationEvent__gridGroup">
											<span class="ct_stationEvent__gridIcon">
												<i class="bx bx-chevron-left" ></i>
											</span>
											<div class="ct_stationEvent__station">
												<img class="ct_stationEvent__stationIcon" src=${
													item.data.from?.artUrl ??
													config.theming.common.defaultAlbumCover ??
													config.theming.controls.defaultAlbumCover
												} />
												<span class="ct_stationEvent__stationName">${
													item.data.from?.stationName ?? "(None)"
												}</span>
											</div>
										</div>`:
									''}
									<div class="ct_stationEvent__gridGroup">
										<div class="ct_stationEvent__gridSpacer"></div>
										<div class="ct_stationEvent__station">
											<span class="ct_stationEvent__stationName">${
												// TODO: Localization?
												item.data.to?.stationName ?? "(None)"
											}</span>
											<img class="ct_stationEvent__stationIcon" src=${
												item.data.to?.artUrl ??
												config.theming.common.defaultAlbumCover ??
												config.theming.controls.defaultAlbumCover
											}>
										</div>
										<span class="ct_stationEvent__gridIcon">
											<i class="bx bx-chevron-right" ></i>
										</span>
									</div>
								</div>
							</div>
						`)[0]
						covers.appendChild(elem);
						break;
				}
			} else {
				elem = genCover(item, {
					position: where,
					current: where === 0
				}, config, playerState, message);
				covers.appendChild(elem);
			}
		} else {
			// Element exists, just update it
			let posIndicator = elem.querySelector<HTMLElement>(".ct_position");
			if (posIndicator) {
				posIndicator.innerText = (
					where > 0 ? (
						where === 1 ?
							"Next song" :
							`Coming in ${where} songs`
					) : (
						where === -1 ?
						"Previous song" :
						`${(where) * -1} songs ago`
					)
				);
			}
			if (where < 0) {
				let remB = elem.querySelector<HTMLButtonElement>('.ct_remove');
				let playB = elem.querySelector<HTMLButtonElement>('.ct_playCover');
				if (remB) {
					remB.parentElement.removeChild(remB);
				}
				if (playB) {
					playB.parentElement.removeChild(playB);
				}
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
		}
	});
	for (let child of covers.children) {
		if (
			!shouldBeHere.includes(child.id)
		) {
			covers.scrollLeft -= child.clientWidth;
			child.parentElement?.removeChild(child);
		}
	}
	// Why this needs to be done twice?
	// No clue.
	// But if I don't then it bugs on station change.
	// Race condition??
	for (let child of covers.children) {
		if (
			!shouldBeHere.includes(child.id)
		) {
			covers.scrollLeft -= child.clientWidth;
			child.parentElement?.removeChild(child);
		}
	}
	if (config.controlsPane.autoScroll && covers.querySelector('.ct_current')) {
		// janky as hell
		// but it doesn't work without two
		// look I don't know why either
		// just don't touch it
		setTimeout(() => {
			covers.querySelector(".ct_current")?.scrollIntoView({
				behavior: config.theming.smoothScroll ? 'smooth' : 'auto',
				block: "center",
				inline: "center"
			});
		}, 100);
		setTimeout(() => {
			covers.querySelector(".ct_current")?.scrollIntoView({
				behavior: config.theming.smoothScroll ? 'smooth' : 'auto',
				block: "center",
				inline: "center"
			});
			let current = covers.querySelector('.ct_current');
			for (let i = 0; i < covers.children.length; i++) {
				if (covers.children[i] === current) {
					covers.children[ensureInBounds(focusedCover)].classList.remove('ct_active');
					focusedCover = i;
					break;
				}
			}
		}, 1000);
	}
}

