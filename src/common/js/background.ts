// ANCHOR: Top
/**
 * Background.ts
 * Complete rewrite of {anesidora.js & background.js} for Typescript and multi-account support
 * 
 * Regions:
 * 1. Typedefs, imports, constants, util funcs
 * 
 * 2. Bootstrapping
 *      - Read settings from localStorage
 *      - Fire config off to any open popups (which there shouldn't be at startup, but who knows)
 *      - This is delegated to {@link store.ts}
 * 3. Pandorawide
 *      - SyncTime
 *      - UAToken
 *      - IDs
 * 
 * 4. Pandora login
 *      - Once there are configured accounts, start partner & user login.
 *      - Initialize functions that require Pandora data
 *          - Bookmarks
 *          - Stations
 *          - Pandora settings
 * 
 * 5. Player functions
 *      - Everything needed for the player to function, in response to buttons, etc. Namely:
 *          - Add feedback
 *          - Play station
 *          - Skip songs
 *          - Bookmark songs & artists
 *          - Sleep songs
 *          - Everything related to editing stations
 * 
 * 6. Settings functions
 *      - Everything needed for the settings page to function.
 *          - Set/get player settings (LIVE UPDATE TO PLAYER)
 *          - Set/get Pandora settings
 *          - Add/remove Pandora credentials
 * 
 * 7. Misc listeners
 *      - First run detection
 *      - Message passing from popups / settings
 */

// ANCHOR Typedefs, imports, constants, util funcs

import * as store from './store';
import { getBrowser } from './platform_specific'
import { BASE_API_URL, Bookmarks, LinkishString, NumberishString, PandoraRequestData, PandoraResponse, PandoraTime, PAPIError, PReq, PRes, ResponseOK } from './pandora';
import { formatParameters, stringToBytes } from './util';
import { decrypt, encrypt } from './crypt';

function throwHere(msg: string): never {
    console.error(`%cbackground.ts: "${msg}"`, `
        color: #15799d;
        font-weight: bold;
        font-family: 'Inter', sans-serif;
    `)
    throw new Error(msg)
}

function logHere(...data: any[]) {
    console.log('%cbackground.ts:', `
    color: #15799d;
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}

function errorHere(...data: any[]) {
    console.error('%cbackground.ts:', `
    font-weight: bold;
    font-family: 'Inter', sans-serif;
    `, ...data)
}


// ANCHOR Bootstrapping

// window.browser | window.chrome
const UA = getBrowser();

// Give all popups the current config.
UA.runtime.sendMessage("config", store);

// ANCHOR Pandorawide

// The active account, if there is one.
let currentAccount: store.PandoraAccount | null = null;

// IIFE, so I can return
(() => {
    // Any accounts stored?
    if (store.actualConfig.accounts.length > 0) {
        // Yes!
        // Is there an account selected already or should we guess one?
        if (store.actualConfig.activeAccount !== null) {
            // Config says there is one!
            // Let's find it.
            let activeAccount = store.actualConfig.accounts.find(account => {
                account.email === store.actualConfig.activeAccount
            })
            // Is it real?
            if (activeAccount) {
                // Neat, set it and we're done
                currentAccount = activeAccount;
                return;
            } else {
                // :wail:
                // make sure we never fall for this again
                store.actualConfig.activeAccount = null;
            }
        }
        // Alright, can't find it based on config.activeAccount
        // Using ✨ advanced heuristic algorithms ✨, determine the correct account
        currentAccount = store.actualConfig.accounts[0];
    }
})();


function calculateSyncTime() {
    if (!currentAccount) {
        throwHere(`calculateSyncTime: No active account`);
    }
    if (!currentAccount.populated) {
        throwHere(`calculateSyncTime: Active account unpopulated`);
    }
    if (!currentAccount.firstSyncTime || !currentAccount.clientStartTime) {
        let whatsWrong: string[] = [];
        if (!currentAccount.firstSyncTime) {
            whatsWrong.push("firstSyncTime");
        }
        if (!currentAccount.clientStartTime) {
            whatsWrong.push("clientStartTime")
        }
        let properConjunction = (
            whatsWrong.length === 1 ?
            "is" : "are"
        );

        throwHere(`calculateSyncTime: ${
            whatsWrong.join(" and ")
        } ${
            properConjunction
        } undefined`)
    }
    const time = (new Date()).getTime();
    const now = parseInt(String(time).substr(0, 10));
    return currentAccount.firstSyncTime + (now - currentAccount.clientStartTime);
}

/**
 * Will always return a successful request.
 * Throws on fail or network error.
 */
async function sendRequest<t>(
    method: string, 
    request: PandoraRequestData = {},
    additionalOpts: {
        /** Whether or not to use TLS. Overridden by config.forceSecure */
        secure?: boolean, 
        /** Whether or not to use Blowfish to encrypt request body. */
        encrypted?: boolean,
        /** How many times this has been retried. */
        depth?: number
    } = {
        secure: true,
        encrypted: true,
        depth: 0
    }
): Promise<ResponseOK<t>> {
    const USE_SECURE = store.actualConfig.forceSecure || additionalOpts.secure;
    const depth = additionalOpts.depth ?? 0;

    let url = `http${ USE_SECURE ? "s" : "" }://${BASE_API_URL}`;
    
    let parameters: string;

    if (currentAccount && currentAccount.populated) {
        let parameterObject: {
            auth_token?: string,
            partner_id?: string,
            user_id?: string
        } = {
            "auth_token": currentAccount.userAuthToken,
            "partner_id": currentAccount.partnerId,
            "user_id": currentAccount.userId
        };
        parameters = '&' + formatParameters(parameterObject);

        request.userAuthToken = request.userAuthToken ?? currentAccount.userAuthToken;
        request.syncTime = request.syncTime ?? calculateSyncTime();
    }

    const req_encrypted = (
        additionalOpts.encrypted ?
            encrypt(JSON.stringify(request)) :
            JSON.stringify(request)
    );

    let response = await fetch(url + method + parameters, {
        method: "POST",
        headers: {
            "Content-Type": additionalOpts.encrypted ? "text/plain" : "application/json"
        },
        body: req_encrypted
    });

    let responseData: PandoraResponse<t> = await response.json();

    if (responseData.stat === "fail") {
        if (responseData.code === 1001 && depth === 0) {
            try {
                if (currentAccount) {
                    await loginAndPopulate(currentAccount.email, currentAccount.password);
                } else {
                    throw "yeet";
                }
            } catch(e) {
                errorHere("Bad credentials, could not recover");
            }
            return await sendRequest<t>(method, request, {
                ...additionalOpts,
                depth: depth + 1
            });
        } else {
            throw new PAPIError(responseData);
        }
    }
    return responseData;
}

// ANCHOR Pandora login

async function loginAndPopulate(email, password): Promise<void> {
    if (!email || !password) {
        throwHere(`loginAndPopulate: email or password undefined`)
    }
    let partnerReq: PReq.auth.partnerLogin = {
        username: "android",
        password: "AC7IBG09A3DTSYM4R41UJWL07VLN8JI7",
        version: "5",
        deviceModel: "android-generic",
        includeUrls: true
    };
    let partnerRes = await sendRequest<PRes.auth.partnerLogin>(
        "auth.partnerLogin", 
        partnerReq, 
        {
            secure: true,
            encrypted: false,
        }
    );

    let b = stringToBytes(decrypt(partnerRes.result.syncTime));
    // skip 4 bytes of garbage
    let s = "", i;
    for (i = 4; i < b.length; i++) {
        s += String.fromCharCode(b[i]);
    }
    // synctime
    let sT = parseInt(s);
    // client start time
    let cST = parseInt((new Date().getTime() + "").substr(0, 10));


    let userReq: PReq.auth.userLogin = {
        loginType: "user",
        username: email,
        password: password,
        partnerAuthToken: partnerRes.result.partnerAuthToken
    };

    let userRes = await sendRequest<PRes.auth.userLogin>(
        "auth.userLogin",
        userReq
    );
    let r = userRes.result;


    let newAccount: store.PopulatedPandoraAccount = {
        email,
        password,
        populated: true,
        pictureUrl: null,
        userId: r.userId,
        userAuthToken: r.userAuthToken,
        partnerAuthToken: partnerRes.result.partnerAuthToken,
        partnerId: partnerRes.result.partnerId,
        firstSyncTime: sT,
        clientStartTime: cST
    }

    currentAccount = newAccount;

    let bookmarks = await getBookmarks();

    currentAccount.bookmarks = bookmarks;

    store.actualConfig.accounts.splice(
        store.actualConfig.accounts.findIndex(e => e.email === currentAccount.email),
        1
    );

    store.set('accounts', [
        ...store.actualConfig.accounts,
        currentAccount
    ])
}

async function getBookmarks(): Promise<Bookmarks> {
    let res = await sendRequest<PRes.user.getBookmarks>(
        'user.getBookmarks'
    )
    return res.result;
}


// ANCHOR Misc listeners
UA.runtime.onMessage.addEventListener((
    message: unknown,
    _sender: unknown,
    sendResponse: (...args: unknown[]) => void) => {
    switch (message) {
        case "getConfig": 
            sendResponse(store);
            break;
        default:
            logHere("Unhandled onMessage: ", message);
            return;
    }
})