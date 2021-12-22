import { PandoraStation } from "../../background/pandora.js";
import { AnesidoraConfig } from "../../background/store.js";
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

    const loggedIn = await message<boolean>("isLoggedIn");

    let stNodes = await buildPane(config, message);

    if (loggedIn) {
        return stNodes;
    } else {
        return document.createElement("div");
    }
}

async function buildPane(
    config: AnesidoraConfig,
    message: <expectedResponse>(
        name: Message['name'],
        data?: Message['data']
    ) => Promise<expectedResponse>
): Promise<HTMLElement> {
    const stNodes = strToHtml(stationsPaneHtml)[0];

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

    const loggedIn = await message<boolean>("isLoggedIn");

    if (loggedIn) {
        const stations: PandoraStation[] = await message("getStations");

        for (let i = 0; i < stations.length; i++) {
            const elem = strToHtml(stationHtml(
                stations[i],
                config
            ))[0];

            elem.addEventListener('click', (e) => {
                e.preventDefault();

                message("playStation", stations[i].stationToken);
            })

            stNodes.appendChild(elem);
        }
    }



    return stNodes;
}


const stationsPaneHtml = `
    <div class="pane stations">

    </div>
`

const stationHtml = (s: PandoraStation, c: AnesidoraConfig) => (`
    <button class="st_station">
        <img
         class="st_img"
         src="${
            s.artUrl ?? 
                c.theming.common.defaultAlbumCover ??
                c.theming.stations.defaultAlbumCover
            }" />
        <span class="st_name">${s.stationName}</span>
    </button>
`)