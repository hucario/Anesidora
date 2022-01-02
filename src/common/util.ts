import { LinkishString } from "./background/pandora";

/**
 * @author https://stackoverflow.com/a/6491621
 */
export function getNestedProperty(o: unknown, s: string) {
	let obj: {} = o;
	s = s.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
	s = s.replace(/^\./, '');           // strip a leading dot
	var a = s.split('.');
	try {
		for (var i = 0, n = a.length; i < n; ++i) {
			var k = a[i];
			if (k in obj) {
				obj = obj[k];
			} else {
				return;
			}
		}
	} catch(e) {
		return undefined;
	}
	return obj;
}
export function setNestedProperty(o: {}, key: string, value: unknown) {
	let path: string[] = key
		.replace(/\[(\w+)\]/g, '.$1') // convert indexes to properties
		.replace(/^\./, '')           // strip a leading dot
		.split('.');
	
	if (path.length === 1) {
		o[path[0]] = value;
		return;
	}

	if (!(path[0] in o)) {
		o[path[0]] = {};
	}
	return setNestedProperty(o[path[0]], path.slice(1).join('.'), value);
}

export function stripTrackersFromUrl(url: LinkishString): LinkishString {
	// TODO: Something more advanced that doesn't just strip all query params.
	// Maybe get a list of all the tracker QPs?
	return url.split('?')[0];
}

export class TimedCache<k, v> extends Map {
	timeout: number;
	constructor(timeout: number) {
		super();
		this.timeout = timeout;
	}
	set(key: k, value: v): this {
		super.set.apply(this, [key, [value, Date.now()]]);
		return this;
	}
	get(key: k, forceRevalidate = false): v | undefined {
		let val: [
			any,
			number
		] = super.get.apply(this, [key]);

		if (forceRevalidate || 
			!val || 
			val[1] < Date.now() - this.timeout
		) {
			this.delete(key);
			return undefined;
		} else if (val) {
			return val[0];
		} else {
			return undefined;
		}
	}
}