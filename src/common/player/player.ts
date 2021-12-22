// ANCHOR: Top
/*
 * player.ts
 * Makes the player interactive
 * 
 * Regions:
 * - Imports and constants
 * - Utility functions
 * - Config & config listeners
 * - Final setup
*/


// ANCHOR: Imports and constants

import { getBrowser } from '../background/platform_specific.js'
import { AnesidoraConfig, ConfigListener } from '../background/store.js';
import { Message } from '../messages.js';

import SetupBookmarksPane from './panes/bookmarks.js';
import SetupControlsPane from './panes/controls.js';
import SetupStationsPane from './panes/stations.js';
import SetupAccountSelectionPane from './panes/accountSelection.js';
import SetupHistoryPane from './panes/history.js';

/**
 * How long to wait for smooth scroll before reenabling scroll detection on the Covers panel.
 */
const SMOOTH_SCROLL_TIMEOUT = 2000;
const UA = getBrowser();

const panesParent = document.getElementById("panes");
const leftTab = document.getElementById("prevTab");
const rightTab = document.getElementById("nextTab");

// ANCHOR: Utility functions

function throwHere(msg: string): never {
    console.error(`%cplayer.ts: "${msg}"`, `
        color: #15799d;
        font-weight: bold;
        font-family: 'Inter', sans-serif;
    `)
    throw new Error(msg)
}

function logHere(...data: any[]) {
    console.log('%cplayer.ts:', `
    color: #15799d;
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

function errorHere(...data: any[]) {
    console.error('%cplayer.ts:', `
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}


function message<expectedResponse>(name: Message['name'], data?: Message['data']): Promise<expectedResponse> {
    return new Promise(res => {
        UA.runtime.sendMessage({
            name,
            data,
            toBg: true
        } as Message, (a) => {
            console.log(name, a);
            res(a);
        });
    });
}

// ANCHOR: Config & listeners

const actualConfig = await message<AnesidoraConfig>("getConfig");


type MessageListener = (data: Message) => void;
const messageListeners = new Map<string, MessageListener[]>();
function subscribe(name: Message['name'], fn: (data: Message) => void) {
    if (messageListeners.get(name)) {
        messageListeners.get(name).push(fn);
    } else {
        messageListeners.set(name, [fn]);
    }
}
UA.runtime.onMessage.addListener(
    (message: Message) => {
        handleMessage(message);
        return false;
    }
)

async function handleMessage(message: Message): Promise<void> {
    if (message.toBg) {
        return;
    }
    if (messageListeners.get(message.name)) {
        messageListeners.get(message.name).forEach(e => e(message));
    }
}

// ANCHOR: Panes
const paneSetupArgs = [
    actualConfig,
    message,
    subscribe
] as const;

for (const pane of actualConfig.playerPanes) {
    switch (pane) {
        case "accountSelection":
            panesParent.appendChild(
                await SetupAccountSelectionPane(...paneSetupArgs)
            )
            break;
        case "bookmarks":
            panesParent.appendChild(
                await SetupBookmarksPane(...paneSetupArgs)
            );
            break;
        case "controls":
            panesParent.appendChild(
                await SetupControlsPane(...paneSetupArgs)
            );
            break;
        case "history":
            panesParent.appendChild(
                await SetupHistoryPane(...paneSetupArgs)
            );
            break;
        case "stations":
            panesParent.appendChild(
                await SetupStationsPane(...paneSetupArgs)
            );
            break;
    }
}

let paneOn: number;

if (actualConfig.defaultPane) {
    const index = actualConfig.playerPanes.indexOf(actualConfig.defaultPane);
    if (index !== -1) {
        showPane(index);
    }
} else {
    showPane(0);
}

function showPane(to: number) {
    const toUsed = Math.min(
        Math.max(
            to,
            0
        ),
        actualConfig.playerPanes.length - 1
    )
    panesParent.style.transform = `translateX(-${100 * toUsed}vw)`;

    if (toUsed === 0) {
        leftTab.style.display  = 'none';
        rightTab.style.display = 'block';
    } else if (toUsed === actualConfig.playerPanes.length - 1) {
        leftTab.style.display = 'block';
        rightTab.style.display = 'none';
    } else {
        leftTab.style.display  = 'block';
        rightTab.style.display = 'block';
    }

    paneOn = toUsed;
}

leftTab.addEventListener('click', (e) => {
    e.preventDefault();
    showPane(paneOn - 1);
})

rightTab.addEventListener('click', (e) => {
    e.preventDefault();
    showPane(paneOn + 1);
})


// ANCHOR: Theming

for (let key in actualConfig.theming.cssVars) {
    document.documentElement.style.setProperty(
        `--${key}`,
        actualConfig.theming.cssVars[key]
    )
}

if (actualConfig.theming.customCSS) {
    document.head.appendChild(new DOMParser()
        .parseFromString(`
            <style>
                ${actualConfig.theming.customCSS}
            </style>
        `.replace(/(    )|\t/g,''), "text/html")
        .body
        .children[0]
    )
}

if (actualConfig.theming) {
    document.documentElement.style.width = actualConfig.theming.popupWidth;
    document.documentElement.style.height = actualConfig.theming.popupHeight;
}

subscribe("configChanged", (reply) => {
    if (reply.name !== 'configChanged') {
        return;
    }
    if (reply.data.key === "theming") {
        const d = reply.data as {
            newValue: AnesidoraConfig['theming']
            oldValue: AnesidoraConfig['theming']
        };

        for (let key in d.newValue.cssVars) {
            document.documentElement.style.setProperty(
                `--${key}`,
                d.newValue.cssVars[key]
            )
        }

        if (d.newValue.customCSS !== d.oldValue.customCSS) {
            document.head.getElementsByTagName("style")[
                document.head.getElementsByTagName("style").length - 1
            ].replaceWith(new DOMParser()
                .parseFromString(`
                    <style>
                        ${actualConfig.theming.customCSS}
                    </style>
                `.replace(/(    )|\t/g,''), "text/html")
                .body
                .children[0]
            )
        }
    }
})


setTimeout(() => {
    panesParent.style.transition = 'transform 350ms';
}, 150);