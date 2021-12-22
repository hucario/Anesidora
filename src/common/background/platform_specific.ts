let ua: "chrome" | "firefox" = (
    // @ts-expect-error No, it's not in the spec. That's why I'm checking for it.
    typeof window.chrome !== "undefined" ?
        "chrome" :
        /**
         * I would do more checks here, but... it's only an extension for Chrome and Firefox.
         * Anything else is unsupported anyways ¯\_(ツ)_/¯
         */
        "firefox"
)

/**
 * Cached result of isAndroid();
 */
let c_IsAndroid: null | boolean = null;

export async function isAndroid(): Promise<boolean> {
    // THIS isn't going to change anytime soon, so I don't have to worry about revalidation
    if (c_IsAndroid) {
        return c_IsAndroid; 
    }

    const platform = await getBrowser().runtime.getPlatformInfo();
    c_IsAndroid = (platform.os === "android");

    return c_IsAndroid;
}

/**
 * Run things that need to be run at least once.
 */
export async function platformSpecific() {
    if (ua === "firefox") {
        if (c_IsAndroid === null) {
            await isAndroid();
        }

        if (!c_IsAndroid) {
            getBrowser().browserAction.setPopup({popup: "/popup.htm"});
        }

        getBrowser().browserAction.onClicked.addListener(() => {
            getBrowser().tabs.create({
                url: "/popup.htm"
            });
        });
    }

}

/*
 * `any` is a Bad Idea™ but I *CANNOT* be bothered to type
 * the entirety of window.browser and window.chrome
 */
/**
 * Returns window.browser (firefox) or window.chrome depending on platform
 */
export function getBrowser(): any {
    if (ua === "chrome") {
        // @ts-expect-error Not to spec
        return window.chrome;
    } else {
        // @ts-expect-error Not to spec
        return window.browser;
    }
}