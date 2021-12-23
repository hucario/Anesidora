export type HttpHeader = {
	/**
	 * Name of the HTTP header.
	 */
	name: string,
	/**
	 * Value of the HTTP header if it can be represented by UTF-8.
	 */
	value: string
}

export type OnBeforeSendHeadersDetails = {
	/**
	 * The HTTP request headers that will be sent with this request.
	 */
	requestHeaders?: HttpHeader[]
}