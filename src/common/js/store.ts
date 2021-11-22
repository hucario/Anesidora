// ANCHOR: Top
/**
 * # store.ts
 * 
 * - Tries to get saved config from localStorage
 * - Provides functions to interact with said config
 * 
 * _**Do not** load this file from anywhere but background.ts_
 * 
 * Regions:
 * 1. Typedefs and constants
 * 2. Internal utility functions
 * 3. Parse existing (?) config from localStorage
 * 4. Functions to interact with said
 * 5. Exports
 */

import { LinkishString, NumberishString, PandoraTime } from "./pandora";


// ANCHOR: Typedefs and constants

const ANESIDORA_NAMESPACE = "anesidoraSettings";


export type PandoraAccount = BasePandoraAccount & (PopulatedPandoraAccount | LoggedOutPandoraAccount);

export type BasePandoraAccount = {
    populated: boolean
    email: string,

    /**
     * This should not be stored as plain text,
     * but it's the only choice we have due to Pandora's design choices.
     */
    password: string,
}
export type LoggedOutPandoraAccount = {
    populated: false,
}
export type PopulatedPandoraAccount = BasePandoraAccount & {
    populated: true

    /** Optional UI-only nickname for the account, e.g. "Home", "Work" */
    name?: string,

    /** User icon. May not be a blob. */
    pictureUrl: LinkishString | null,

    bookmarks?: {
        artists: {
            musicToken: string,
            artistName: string,
            artUrl: LinkishString,
            bookmarkToken: string,
            dateCreated: PandoraTime
        }[],
        songs: {
            sampleUrl: LinkishString,
            sampleGain: NumberishString,
            albumName: string,
            artistName: string,
            musicToken: string,
            dateCreated: PandoraTime,
            artUrl: LinkishString,
            bookmarkToken: string,
            songName: string
        }[]
    }

    /** Pandora ID - Will not change */
    userId: string

    /** These are wiped every session for relogin. */
    userAuthToken: string,
    partnerAuthToken: string,
    partnerId: string
    // These two are needed to calculate a parameter required in most requests.
    firstSyncTime: number;
    clientStartTime: number;
}

export type ConfigListenerData = {
    key: string,
    oldValue: unknown,
    newValue: unknown
};

export type ConfigListener = (opts: ConfigListenerData) => void

export type ListenerId = string;


export type AnesidoraConfig = {
    forceSecure?: boolean,
    accounts: PandoraAccount[],
    activeAccount: string | null
}

const defaultConfig: AnesidoraConfig = {
    forceSecure: true,
    accounts: [],
    activeAccount: null
}


// ANCHOR: Internal utility functions

function throwHere(msg: string): never {
    console.error(`%cstore.ts: "${msg}"`, `
        color: #15799d;
        font-weight: bold;
        font-family: 'Inter', sans-serif;
    `)
    throw new Error(msg)
}

function logHere(...data: any[]) {
    console.log('%cstore.ts:', `
    color: #15799d;
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

// ANCHOR: Parse existing(?) config from localStorage

let actualConfig: AnesidoraConfig | null = null;

try {
    let existingParsed: Partial<AnesidoraConfig> | null = null;
    const existing = localStorage.getItem(
        ANESIDORA_NAMESPACE
    );
    existingParsed = JSON.parse(existing);
    if (typeof existingParsed !== "object") {
        throwHere(`localStorage[${ANESIDORA_NAMESPACE}] not an object`);
    }
    
    for (const key in defaultConfig) {
        if (typeof existingParsed[key] === undefined) {
            logHere(`config['${key}'] is undefined, using default ${defaultConfig[key]}`)
        }
    }

    let fullyParsed: AnesidoraConfig = <AnesidoraConfig>existingParsed;

    for (const user of fullyParsed.accounts) {
        if (user.populated) {
            delete user.userAuthToken;
            delete user.partnerAuthToken;
            delete user.partnerId;
            delete user.firstSyncTime;
            delete user.clientStartTime;
        }
    }
    
    actualConfig = fullyParsed;

    logHere('Successfully loaded existing config.')
} catch(e) {
    actualConfig = defaultConfig;
    logHere('Could not load any existing config; using default.')
}

// ANCHOR: Functions to interact with config

const listeners: Map<ListenerId, ConfigListener> = new Map();

function set(key: string, value: unknown): typeof value {
    let oldValue = actualConfig[key];
    
    actualConfig[key] = value;

    fireListeners({
        key,
        oldValue,
        newValue: value
    })

    return value;
}

function fireListeners(data: ConfigListenerData): void {
    listeners.forEach(e => e(data));
}

function addListener(fn: ConfigListener): ListenerId {
    let newId: ListenerId;
    do {
        newId = Math.floor(Math.random() * 1e10).toString(16);
    } while (listeners.has(newId))

    listeners.set(
        newId,
        fn
    );

    return newId;
}

function removeListener(id: ListenerId): void {
    if (listeners.has(id)) {
        listeners.delete(id);
    } else {
        logHere(`removeListener: Listener ${id} does not exist in the first place`)
        console.trace();
    }
}

// ANCHOR: Exports

export {
    actualConfig,
    set,
    addListener,
    removeListener
}
