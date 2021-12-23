/**
 * @link http://stackoverflow.com/questions/1240408/reading-bytes-from-a-javascript-string
 */
 export function stringToBytes(str: string) {
	let ch: number,
		st: number[],
		re: number[] = [];
	for (let i = 0; i < str.length; i ++) {
		ch = str.charCodeAt(i); // get char
		st = [];				// set up "stack"
		do {
			st.push(ch & 0xFF); // push byte to stack
			ch = ch >> 8;		// shift value down by 1 byte
		}
		while (ch);
		// add stack contents to result
		// done because chars have "wrong" endianness
		re = re.concat(st.reverse());
	}
	// return an array of bytes
	return re;
}

export function formatParameters(parameterObject: {
	[key: string]: string
}) {
	let params = [];
	for(let key in parameterObject) {
		let value = parameterObject[key];
		if (typeof value !== "undefined" && value.length > 0) {
			params.push(
				`${key}=${encodeURIComponent(value)}`
			);
		} else {
			params.push(key);
		}
	}
	return params.join("&");
}