import { PandoraStation } from "../../background/pandora.js";
import { AnesidoraConfig, AnesidoraState } from "../../background/store.js";
import { Message } from "../../messages.js";


function throwHere(msg: string): never {
	console.error(`%cstations.ts: "${msg}"`, `
		color: #15799d;
		font-weight: bold;
		font-family: 'Inter', sans-serif;
	`)
	throw new Error(msg)
}

function logHere(...data: any[]) {
	console.log('%cstations.ts:', `
	color: #15799d;
	font-weight: bold;
	font-family: 'Inter', sans-serif;
	`, ...data)
}

function errorHere(...data: any[]) {
	console.error('%cstations.ts:', `
	font-weight: bold;
	font-family: 'Inter', sans-serif;
	`, ...data)
}


const domP = new DOMParser();
function strToHtml(str: string): HTMLElement[] {
	let untypedNodes = domP
			.parseFromString(str.replace(/(  )|\t/g,''), "text/html")
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

export default async function SetupStationsPane(
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
	const state = await message<AnesidoraState>("toBg_getState");
	let stNodes = await buildPane(config, state, message);

	
	return stNodes;
}

async function buildPane(
	config: AnesidoraConfig,
	state: AnesidoraState,
	message: <expectedResponse>(
		name: Message['name'],
		data?: Message['data']
	) => Promise<expectedResponse>
): Promise<HTMLElement> {
	const stNodes = strToHtml(stationsPaneHtml(state, config))[0];

	const theme = {
		...config.theming.stations,
		...config.theming.common
	}

	stNodes.style.background = theme.backgroundColor;
	stNodes.style.padding = theme.padding;
	stNodes.style.color = theme.textColor;
	stNodes.style.setProperty(
		'--accent-color',
		theme.accentColor
	);

	const stations: PandoraStation[] = await message("toBg_getStations");
	const holder = stNodes.querySelector('.st_stationsHolder');
	const stationsElems = {};
	for (let i = 0; i < stations.length; i++) {
		const elem = strToHtml(stationHtml(
			stations[i],
			state,
			config
		))[0];

		elem.addEventListener('click', (e) => {
			e.preventDefault();

			message("toBg_playStation", stations[i].stationToken);
		})

		stationsElems[stations[i].stationId] = elem;
		holder.appendChild(elem);
	}



	return stNodes;
}


const stationsPaneHtml = (s: AnesidoraState, c: AnesidoraConfig) => (`
	<div class="pane stations">
		${c.theming.stations.showHeader ? 
		`<span class="st_stationsHeader">
				${
					// TODO: Localization?
					"Stations"
				}
			</span>
		` : ''}
		<div class="st_stationsHolder">

		</div>
	</div>
`)

const stationHtml = (i: PandoraStation, s: AnesidoraState, c: AnesidoraConfig) => (`
	<button class="st_station">
		<img
		 class="st_img"
		 src="${
			i.artUrl ?? 
				c.theming.common.defaultAlbumCover ??
				c.theming.stations.defaultAlbumCover
			}" />
		<span class="st_name">${i.stationName}</span>
	</button>
`)