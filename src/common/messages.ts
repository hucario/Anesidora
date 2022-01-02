import { Bookmarks, PandoraRating, PandoraSong, PandoraStation } from "./background/pandora.js"
import { AnesidoraConfig, ConfigListenerData, AnesidoraState, AnesidoraFeedItem } from "./background/store.js"

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
	QueueYeeted |
	SeekBarAck |
	BookmarksUpdated |
	StationsUpdated |
	SettingFeedback |
	FeedbackSet |
	StationStartingPlaying |
	StationResolved |
	UpdatedFeed
)

type UpdatedFeed = {
	name: "toTabs_updatedFeed",
	data: {
		history: AnesidoraFeedItem[],
		curr: AnesidoraFeedItem,
		next: AnesidoraFeedItem[],
		newDuration: number
	}
}

type StationResolved = {
	name: "toTabs_stationResolved",
	/** Token */
	data: string
}

type StationStartingPlaying = {
	name: "toTabs_playingStation",
	/** Token */
	data: string
}

type SettingFeedback = {
	name: "toTabs_settingFeedback",
	data: {
		trackToken: string,
		stationToken: string,
		rating: PandoraRating
	}
}

type FeedbackSet = {
	name: "toTabs_feedbackSet",
	data: {
		trackToken: string,
		stationToken: string,
		rating: PandoraRating
	}
}

type StationsUpdated = {
	name: "toTabs_stationsUpdated",
	data: PandoraStation[]
}

type BookmarksUpdated = {
	name: "toTabs_bookmarksUpdated",
	data: Bookmarks
}


type SeekBarAck = {
	name: "toTabs_seekBarAck",
	data: number
}

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
	QueueYeet |
	Cover_PlayButtonPress |
	SetFeedback |
	SeekBarDragged |
	GetBookmarks |
	GetStations |
	PlayStation
)

type PlayStation = {
	name: "toBg_playStation",
	/** Station token */
	data: string
}

type GetStations = {
	name: "toBg_getStations",
	/** Force (cachebust)? */
	data?: boolean
}

export type GetStationsResponse = PandoraStation[];

type GetBookmarks = {
	name: "toBg_getBookmarks",
	/** Force (cachebust)? */
	data?: boolean
}

export type GetBookmarksResponse = Bookmarks;


type SeekBarDragged = {
	name: "toBg_seekBarDrag",
	/** Seconds through, 0 < data < duration */
	data: number
}

type Cover_PlayButtonPress = {
	name: "toBg_coverPlayButtonPress",
	/** Track token */
	data: string
}
export type Cover_PlayButtonPressResponse = never;

type SetFeedback = {
	name: "toBg_setFeedback",
	data: {
		trackToken: string,
		stationToken: string,
		rating: PandoraRating
	}
}
export type SetFeedbackresponse = never;

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