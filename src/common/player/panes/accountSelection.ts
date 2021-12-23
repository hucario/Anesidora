import { AnesidoraConfig } from "../../background/store.js";
import { Message } from "../../messages.js";

export default async function SetupAccountSelectionPane(
		config: AnesidoraConfig,
		message: <expectedResponse>(
			name: Message['name'],
			data?: Message['data']
		) => Promise<expectedResponse>,
		subscribe: (
			name: string,
			fn: (data: Message) => void
		) => void
	): Promise<HTMLDivElement> {
	
	return document.createElement("div");
}