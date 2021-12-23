import { Bookmarks, PandoraRating, PandoraSong, PandoraStation } from "./background/pandora.js"
import { AnesidoraConfig, ConfigListenerData, AnesidoraState } from "./background/store.js"

export type Message = ToTabsMessages | ToBgMessages;

export type ToTabsMessages = {
	toBg: false,
	name: `toTabs_${string}`,
	data: unknown | never
} & (
	ConfigWasChanged |
	SkipButtonWasPressed |
	ResetSkipButton |
	PlayButtonWasPressed |
	ResetPlayButton |
	UpdateTabTime |
	StateWasChanged |
	QueueYeeted
)
type QueueYeeted = {
	name: "toTabs_removedFromQueue",
	/** Track token or ad id yeeted */
	data: string
}

type StateWasChanged = {
	name: "toTabs_stateChanged",
	data: ConfigListenerData
}

type ConfigWasChanged = {
	name: "toTabs_configChanged",
	data: ConfigListenerData
}

type PlayButtonWasPressed = {
	name: "toTabs_playButton",
	data: never
}
type ResetPlayButton = {
	name: "toTabs_resetPlay",
	/** Paused? */
	data: boolean
}
type UpdateTabTime = {
	name: "toTabs_setCurrTime",
	data: AnesidoraState['currentTime']
}

type SkipButtonWasPressed = {
	name: "toTabs_skipButton",
	data: never
}
type ResetSkipButton = {
	name: "toTabs_resetSkip",
	data: never
}

export type ToBgMessages = {
	toBg: true,
	name: `toBg_${string}`,
	data: unknown | never
} & (
	GetConfigMessage |
	GetStateMessage |
	PlayButtonPress |
	SkipButtonPress |
	QueueYeet
)

type QueueYeet = {
	name: "toBg_removeFromQueue",
	/** Track token (or advertisement id) to be yeeted */
	data: string
}
export type QueueYeetResponse = never;

type PlayButtonPress = {
	name: "toBg_playButton",
	data: never
}
export type PlayButtonPressedResponse = never;

type SkipButtonPress = {
	name: "toBg_skipButton",
	data: never
}
export type SkipButtonPressedResponse = never;

type GetConfigMessage = {
	name: "toBg_getConfig",
	data: never
}
export type GetConfigResponse = AnesidoraConfig;

type GetStateMessage = {
	name: "toBg_getState",
	data: never
}
export type GetStateResponse = AnesidoraState;