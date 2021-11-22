import { InputKey, OutputKey } from './keys';

const mod = Math.pow(2, 32);

export function decrypt(string: string) {
    let dec = decodeFromHex(string);
    let ret = "";
    for (let i = 0; i < (dec.length); i += 8) {
        let l = ((dec.charCodeAt(i) << 24) | (dec.charCodeAt(i + 1) << 16) | (dec.charCodeAt(i + 2) << 8) | (dec.charCodeAt(i + 3))) >>> 0;
        let r = ((dec.charCodeAt(i + 4) << 24) | (dec.charCodeAt(i + 5) << 16) | (dec.charCodeAt(i + 6) << 8) | (dec.charCodeAt(i + 7))) >>> 0;
        for (let j = InputKey.n + 1; j > 1; j--) {
            l = (l ^ InputKey.p[j]) >>> 0;
            let a = (l & 0xFF000000) >>> 24;
            let b = (l & 0x00FF0000) >>> 16;
            let c = (l & 0x0000FF00) >>> 8;
            let d = (l & 0x000000FF);
            let f = (InputKey.s[0][a] + InputKey.s[1][b]) % mod;
            f = (f ^ InputKey.s[2][c]) >>> 0;
            f = f + InputKey.s[3][d];
            f = ((f % mod) & 0xFFFFFFFF) >>> 0;
            r = r ^ f;
            let temp = l;
            l = r;
            r = temp;
        }
        let temp = l;
        l = r;
        r = temp;

        r = r ^ InputKey.p[1];
        l = l ^ InputKey.p[0];

        ret += String.fromCharCode((l / Math.pow(2, 24)) & 0xff);
        ret += String.fromCharCode((l / Math.pow(2, 16)) & 0xff);
        ret += String.fromCharCode((l / Math.pow(2, 8)) & 0xff);
        ret += String.fromCharCode(l & 0xff);

        ret += String.fromCharCode((r / Math.pow(2, 24)) & 0xff);
        ret += String.fromCharCode((r / Math.pow(2, 16)) & 0xff);
        ret += String.fromCharCode((r / Math.pow(2, 8)) & 0xff);
        ret += String.fromCharCode(r & 0xff);

    }
    return ret;
}

export function encrypt(string) {
    let blocks = (string.length / 8);
    let ret = "";
    for (let h = 0; h < blocks; h++) {
        let i = h << 3; //h << 3;
        let l = ((string.charCodeAt(i) << 24) | (string.charCodeAt(i + 1) << 16) | (string.charCodeAt(i + 2) << 8) | (string.charCodeAt(i + 3))) >>> 0;
        let r = ((string.charCodeAt(i + 4) << 24) | (string.charCodeAt(i + 5) << 16) | (string.charCodeAt(i + 6) << 8) | (string.charCodeAt(i + 7))) >>> 0;
        for (let j = 0; j < OutputKey.n; j++) {
            l = (l ^ OutputKey.p[j]) >>> 0;
            let a = (l & 0xFF000000) >>> 24;
            let b = (l & 0x00FF0000) >>> 16;
            let c = (l & 0x0000FF00) >>> 8;
            let d = (l & 0x000000FF);
            let f = (OutputKey.s[0][a] + OutputKey.s[1][b]) % mod;
            f = (f ^ OutputKey.s[2][c]) >>> 0;
            f = f + OutputKey.s[3][d];
            f = ((f % mod) & 0xFFFFFFFF) >>> 0;
            r = (r ^ f) >>> 0;
            let temp = l;
            l = r;
            r = temp;
        }
        let temp = l;
        l = r;
        r = temp;
        r = (r ^ OutputKey.p[OutputKey.n]) >>> 0;
        l = (l ^ OutputKey.p[OutputKey.n + 1]) >>> 0;

        ret += String.fromCharCode((l / Math.pow(2, 24) & 0xff));
        ret += String.fromCharCode((l / Math.pow(2, 16) & 0xff));
        ret += String.fromCharCode((l / Math.pow(2, 8) & 0xff));
        ret += String.fromCharCode((l & 0xff));

        ret += String.fromCharCode((r / Math.pow(2, 24) & 0xff));
        ret += String.fromCharCode((r / Math.pow(2, 16) & 0xff));
        ret += String.fromCharCode((r / Math.pow(2, 8) & 0xff));
        ret += String.fromCharCode((r & 0xff));
    }
    return encodeToHex(ret);
}
function encodeToHex(str) {
    let r = "";
    let e = str.length;
    let c = 0;
    let h;
    while (c < e) {
        h = str.charCodeAt(c++).toString(16);
        while (h.length < 2) h = "0" + h;
        r += h;
    }
    return r;
}
function decodeFromHex(str) {
    let r = "";
    for (let i = str.length; i >= 1; i -= 2) {
        r = String.fromCharCode(parseInt("0x" + str.substring(i - 2, i))) + r;
    }
    return r;
}
