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
		.split('');
	
	if (path.length === 1) {
		o[path[0]] = value;
		return;
	}

	if (!(path[0] in o)) {
		o[path[0]] = {};
	}
	return setNestedProperty(o[path[0]], path.slice(1).join('.'), value);
}