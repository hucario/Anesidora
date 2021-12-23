/*
 * Pandora JSON API types
 * Made with information from https://6xq.net/pandora-apidoc/json/
 */

export const BASE_API_URL = "tuner.pandora.com/services/json/?method=";

export type PandoraResponse<D> = ResponseOK<D> | ResponseFail;

export type ResponseFail = {
	stat: "fail",
	message: string,
	code: PAPI_ERRORS
}

export type ResponseOK<ExpectedResponse> = {
	stat: "ok",
	result: ExpectedResponse
}

/**
 * String that can be parsed to a number.
 * ```
 * "42", "0x555", "1234"
 * ```
 */
export type NumberishString = string;

/**
 * String that is a link.
 * ```
 * "https://www.example.com", "protocol://domain.tld"
 */
export type LinkishString = string;

export type AudioInfo = {
	/** Bitrate in kbps */
	bitrate: NumberishString,
	encoding: string,
	audioUrl: LinkishString,
	protocol: "http" | "https"
}

export enum PandoraRating {
	THUMBS_UP = 1,
	UNRATED = 0,
	/** This will never occur in a getPlaylist call */
	THUMBS_DOWN = -1
}

export type PandoraSong = {
	trackToken: string,
	artistName: string,
	albumName: string,
	amazonAlbumUrl: LinkishString,
	songExplorerUrl: LinkishString,
	albumArtUrl: LinkishString,
	artistDetailUrl: LinkishString,
	/**
	 * Song audio format and bitrates returned differ
	 * based on what partner credentials are used.
	 */
	audioUrlMap: {
		highQuality?: AudioInfo,
		mediumQuality?: AudioInfo,
		lowQuality?: AudioInfo
	},
	itunesSongUrl: LinkishString,
	/**
	 * List of additional audio urls in the requested order
	 * or single string if only one format was requested
	 */
	additionalAudioUrl: LinkishString | LinkishString[],
	amazonAlbumAsin?: string,
	amazonAlbumDigitalAsin: string,
	artistExplorerUrl: LinkishString,
	songName: string,
	albumDetailUrl: LinkishString,
	songDetailUrl: LinkishString,
	stationId: NumberishString,
	songRating: PandoraRating,
	trackGain: NumberishString,
	albumExplorerUrl: LinkishString,
	allowFeedback: boolean,
	amazonSongDigitalAsin: string,
	nowPlayingStationAdUrl: LinkishString
}

export type UnpopulatedPandoraAd = {
	populated: false,
	adToken: string
}


export type PopulatedPandoraAd = {
	populated: true,
	adToken: string,
	clickThroughUrl: LinkishString,
	imageUrl: LinkishString,
	audioUrlMap: {
		highQuality: AudioInfo,
		mediumQuality: AudioInfo,
		lowQuality: AudioInfo
	},
	adTrackingTokens?: string[],
	bannerAdMap?: {
		html: string
	},
	companyName: string,
	trackGain: NumberishString,
	title: string
}

export type PandoraTime = Partial<{
	date: number,
	day: number,
	hours: number,
	minutes: number,
	month: number,
	nanos: number,
	seconds: number,
	/**
	 * Number of milliseconds since Unix epoch
	 */
	time: number,
	timezoneOffset: number,
	year: number
 }>

export type PandoraStation = {
	artUrl?: LinkishString,
	suppressVideoAds: boolean,
	isQuickMix: boolean,
	stationId: NumberishString,
	stationDetailUrl: LinkishString,
	isShared: boolean,
	dateCreated: PandoraTime,
	stationToken: NumberishString,
	stationName: string,
	stationSharingUrl: LinkishString,
	requiresCleanAds: boolean,
	allowRename: boolean,
	allowAddMusic: boolean,
	/**
	 * QuickMix stations only:
	 * a list of station ids (`quickMixStationIds`) that are currently selected for the mix.
	 */
	quickMixStationIds?: NumberishString[],
	allowDelete: boolean,
	allowEditDescription: boolean
 }

export type PandoraPlaylist = Array<PandoraSong | UnpopulatedPandoraAd>;


export type PandoraAudioFormat = 
	"HTTP_40_AAC_MONO" |
	"HTTP_64_AAC" |
	"HTTP_32_AACPLUS" |
	"HTTP_64_AACPLUS" |
	"HTTP_24_AACPLUS_ADTS" |
	"HTTP_32_AACPLUS_ADTS" |
	"HTTP_64_AACPLUS_ADTS" |
	"HTTP_128_MP3" |
	"HTTP_32_WMA";

export type PandoraResponseData = {};
export type PandoraRequestData = {
	userAuthToken?: string,
	syncTime?: number
};

export type PandoraAccountSettings = {
	gender: "Male" | "Female",
	birthYear: number,
	zipCode: string,
	isProfilePrivate: boolean,
	enableComments: boolean,
	emailOptIn: boolean,
	emailComments: boolean,
	emailNewFollowers: boolean,
	isExplicitContentFilterEnabled: boolean,
	isExplicitContentFilterPINProtected: boolean,
	newUsername: string,
	newPassword: string,
	facebookAutoShareEnabled: boolean,
	autoShareTrackPlay: boolean,
	autoShareLikes: boolean,
	autoShareFollows: boolean,
	facebookSettingChecksum: boolean,
}

export type Bookmarks = {
	artists: {
		musicToken: string,
		artistName: string,
		artUrl: LinkishString,
		bookmarkToken: string,
		dateCreated: PandoraTime
	}[],
	songs: {
		sampleUrl: LinkishString,
		sampleGain: NumberishString,
		albumName: string,
		artistName: string,
		musicToken: string,
		dateCreated: PandoraTime,
		artUrl: LinkishString,
		bookmarkToken: string,
		songName: string
	}[]
};

export namespace PRes {
	export namespace test {
		export type checkLicensing = {
			isAllowed: boolean
		} & PandoraResponseData;
	}
	export namespace user {
		export type getStationList = {
			stations: PandoraStation[]
		} & PandoraResponseData;

		export type getStationListChecksum = {
			checksum: string
		} & PandoraResponseData;

		/** This method returns no data. */
		export type setQuickMix = PandoraResponseData;

		/** This method returns no data. */
		export type sleepSong = PandoraResponseData;

		export type getBookmarks = Bookmarks & PandoraResponseData;

		export type validateUsername = {
			isValid: boolean
			isUnique: boolean
		} & PandoraResponseData;

		export type getSettings = PandoraAccountSettings;

		/** This method returns no data. */
		export type changeSettings = PandoraResponseData;

		export type canSubscribe = {
			canSubscribe: boolean,
			isSubscriber: boolean
		} & PandoraResponseData;
	}
	export namespace auth {
		/**
		 * `syncTime` is used to calculate the server time.
		 * 
		 * `partnerId` and `authToken` are required to proceed with user authentication.
		 * 
		 * **Common errors:**
		 * 
		 * {@link PAPI_ERRORS.INVALID_PARTNER_LOGIN 1002 - Invalid partner credentials.}
		 */
		export type partnerLogin = {
			/**
			 * Hex-encoded, encrypted server time.
			 * Decrypt with password from Partner passwords and
			 * skip first four bytes of garbage.
			 * 
			 */
			syncTime: string,
			partnerAuthToken: string,
			partnerId: string
			/**
			 * Included if {@link PReq.auth.partnerLogin.returnDeviceType auth.partnerLogin['returnDeviceType']} is true
			 */
			deviceProperties?: {
				videoAdRefreshInterval: number,
				videoAdUniqueInterval: number,
				adRefreshInterval: number,
				videoAdStartInterval: number
			},
			stationSkipUnit: string,
			/**
			 * Included if {@link PReq.auth.partnerLogin.includeUrls auth.partnerLogin['includeUrls']} is true
			 */
			urls?: {
				autoComplete: LinkishString
			},
			stationSkipLimit: number
		} & PandoraResponseData;

		/**
		 * **Common errors:**
		 * 
		 * {@link PAPI_ERRORS.INVALID_PARTNER_LOGIN 1002 - Invalid or wrong user credentials. }
		 */
		export type userLogin = {
			/** Used to authenticate access to other API methods. */
			userAuthToken: string,
			canListen?: boolean,
			isCapped?: boolean
			
			/** email */
			username?: string,
			userId?: NumberishString,
			maxStationsAllowed?: number,
			minimumAdRefreshInterval?: number,
			listeningTimeoutMinutes?: NumberishString,

			hasAudioAds?: boolean,
			stationCreationAdUrl?: LinkishString,
			splashScreenAdUrl?: LinkishString,
			videoAdUrl?: LinkishString,
			listeningTimeoutAlertMsgUri?: LinkishString,
			userProfileUrl?: LinkishString,
			nowPlayingAdUrl?: LinkishString,
		} & PandoraResponseData;
	}
	export namespace music {
		/**
		 * Matching songs, artists, and genre stations are
		 * returned in three separate lists.
		 */
		export type search = {
			nearMatchesAvailable?: boolean,
			explanation?: string,
			songs: {
				artistName: string,
				/**
				 * Token starts with ‘S’ followed by one or more digits 
				 * (e.g. ‘S1234567’).
				 */
				musicToken: string,
				songName: string,
				score: number
			}[],
			artists: {
				artistName: string,
				/**
				 * Results can be either for artists (token starts with ‘R’) or
				 * composers (token starts with ‘C’).
				 */
				musicToken: string,
				likelyMatch: boolean,
				score: number
			}[],
			genreStations: {
				/**
				 * Token starts with ‘G’ followed by one or more digits (e.g. ‘G123’).
				 */
				musicToken: string,
				score: number,
				stationName: string
			}[]
		} & PandoraResponseData;
	}
	export namespace station {
		export type getPlaylist = {
			items: PandoraPlaylist
		} & PandoraResponseData;
		export type addFeedback = {
			totalThumbsUp: number,
			totalThumbsDown: number,
			stationPersonalizationPercent: number,
			dateCreated: PandoraTime,
			albumArtUrl: LinkishString,
			musicToken: string,
			songName: string,
			artistName: string,
			/**
			 * See {@link PReq.station.deleteFeedback station.deleteFeedback}
			 */
			feedbackId: NumberishString,
			isPositive: boolean
		} & PandoraResponseData;
		/**
		 * **FIXME:** Couldn't find data this method returns.
		 */
		export type createStation = unknown;
		export type addSeed = {
			/**
			 * Can be used to remove seed with
			 * {@link PReq.station.deleteMusic station.deleteMusic}
			 */
			seedId: string,

			artistName: string,
			musicToken: string,
			artUrl: LinkishString	
		} & PandoraResponseData;
		/**
		 * This method does not return data.
		 * 
		 * **Common errors:**
		 * 
		 * {@link PAPI_ERRORS.CANNOT_YEET_LAST_SEED 1032 - Cannot remove last seed}
		 **/
		export type deleteMusic = PandoraResponseData;
		/** This method does not return data. */
		export type renameStation = PandoraResponseData;
		/** This method does not return data. */
		export type deleteStation = PandoraResponseData;
		/**
		 * Retrieves station information.
		 */
		export type getStation = {
			suppressVideoAds: boolean,
			/** For now, this is the same as stationToken */
			stationId: string,
			modes: {
				takeoverModes: [],
				takeoverModesHeader: string,
				algorithmicModes: [],
				algorithmicModesHeader: string,
				annotations: {}
			},
			allowAddMusic: string,
			dateCreated: PandoraTime,
			stationDetailUrl: LinkishString,
			allowEditDescription: boolean,
			requiresCleanAds: boolean,
			isGenreStation: boolean,
			/** For now, this is the same as stationId */
			stationToken: string,
			stationName: string,
			hasTakeoverModes: boolean,
			isShared: boolean,
			hasCuratedModes: boolean,
			allowDelete: boolean,
			genre: string[],
			isQuickMix: string,
			allowRename: string,
			stationSharingUrl: LinkishString

			/* Begin extended attributes */

			/** Whether this exists depends on whether the request had `includeExtendedAttributes` */
			artUrl?: string
			/** Whether this exists depends on whether the request had `includeExtendedAttributes` */
			music?: {
				artists: {
					artistName: string,
					musicToken: string,
					seedId: string,
					artUrl: string
				}[],
				songs: {
					seedId: string,
					artistName: string,
					artUrl: string,
					songName: string,
					musicToken: string
				}[],
				genres: {
					musicToken: string,
					genreName: string,
					seedId: string
				}[]
			}
			/** Whether this exists depends on whether the request had `includeExtendedAttributes` */
			feedback?: {
				thumbsUp: {
					pandoraId: string,
					dateCreated: PandoraTime,
					pandoraType: string,
					albumArtUrl: LinkishString,
					songIdentity: string,
					musicToken: string,
					songName: string,
					artistName: string,
					feedbackId: string,
					isPositive: true
				}[],
				thumbsDown: {
					pandoraId: string,
					dateCreated: PandoraTime,
					pandoraType: string,
					albumArtUrl: LinkishString,
					songIdentity: string,
					musicToken: string,
					songName: string,
					artistName: string,
					feedbackId: string,
					isPositive: false
				}[],
				totalThumbsUp: number,
				totalThumbsDown: number
			}
		} & PandoraResponseData;
		/** This method does not return data. */
		export type deleteFeedback = PandoraResponseData;
		/**
		 * Each station belongs to one category, usually a genre name.
		 * `stationToken` can be used as `musicToken` to create a new station with
		 * {@link PReq.station.createStation station.createStation}.
		 */
		export type getGenreStations = {
			/** List of categories */
			categories: {
				/** List of stations in category */
				stations: {
					/** Actually a musicToken, see
					 * {@link PReq.station.createStation station.createStation}. */
					stationToken: string,
					stationName: string,
					stationId: string
				}[],
				categoryName: string
			}[]
		} & PandoraResponseData;

		export type getGenreStationsChecksum = {
			checksum: string
		} & PandoraResponseData;

		/** This method returns no data. */
		export type shareStation = PandoraResponseData;

		/** This method returns no data. */
		export type transformSharedStation = PandoraResponseData;
	}
	export namespace track {
		/**
		 * The request returns a list of attributes. 
		 * ## The last item is not an actual attribute.
		 * It needs to be popped off the end.
		 */
		export type explainTrack = {
			explanations: {
				focusTraitName: string,
				focusTraitId: string
			}[]
		} & PandoraResponseData;
	}
	export namespace bookmark {
		export type addArtistBookmark = {
			artistName: string,
			dateCreated: PandoraTime,
			bookmarkToken: string,
			artUrl: LinkishString,
			musicToken: string
		} & PandoraResponseData;
		export type addSongBookmark = {
			sampleGain: NumberishString,
			musicToken: string,
			bookmarkToken: string,
			sampleUrl: LinkishString,
			albumName: string,
			songName: string,
			artUrl: LinkishString,
			dateCreated: PandoraTime,
			artistName: string
		} & PandoraResponseData;
	}

	export namespace ad {
		export type getAdMetadata = {
			clickThroughUrl: LinkishString,
			imageUrl: LinkishString,
			/**
			 * Whether this is included or not depends on whether
			 * {@link PReq.ad.getAdMetadata['supportAudioAds'] ad.getAdMetadata.supportAudioAds}
			 * is set to true.
			 */
			audioUrlMap?: {
				highQuality: AudioInfo,
				mediumQuality: AudioInfo,
				lowQuality: AudioInfo
			},
			/**
			 * Whether this is included or not depends on whether
			 * {@link PReq.ad.getAdMetadata.returnAdTrackingTokens ad.getAdMetadata['returnAdTrackingTokens']}
			 * is set to true.
			 */
			adTrackingTokens?: string[],
			/**
			 * `bannerAdMap` contains an HTML fragment for a banner ad.
			 * 
			 * Whether this is included or not depends on whether
			 * {@link PReq.ad.getAdMetadata.includeBannerAd ad.getAdMetadata['includeBannerAd']}
			 * is set to true.
			 */
			bannerAdMap?: {
				html: string
			},
			companyName: string,
			trackGain: NumberishString,
			title: string
		} & PandoraResponseData;

		/** This method returns no data. */
		export type registerAd = PandoraResponseData;
	}
}

export namespace PReq {
	/**
	 * Pandora is ad-free for Pandora One users.
	 * For all other account types, the playlist returned by
	 * {@link PReq.station.getPlaylist station.getPlaylist} or
	 * {@link PReq.auth.userLogin auth.userLogin}
	 * will contain tracks with adToken values for the advertisements that should be played
	 * (if audioUrl is provided) or displayed using imageUrl and bannerAdMap.
	 */
	export namespace ad {
		/**
		 * Register the tracking tokens associated with the advertisement.
		 * The theory is that this should be done just as the advertisement is about to play.
		 */
		export type registerAd = {
			/**
			 * The ID of an existing station
			 * (see {@link PReq.station.getStation station.getStation},
			 * {@link PReq.user.getStationList user.getStationList})
			 * to register the ads against 
			 */
			stationId?: string,
			/**
			 * The tokens of the ads to register (see
			 * {@link PReq.ad.getAdMetadata ad.getAdMetadata})
			 */
			adTrackingTokens: string,
		} & PandoraRequestData;


		/**
		 * Retrieve the metadata for the associated advertisement token
		 * (usually provided by one of the other methods responsible
		 * for retrieving the playlist).
		 */
		export type getAdMetadata = {
			/**
			 * The adToken to retrieve the metadata for.
			 * (see {@link PReq.station.getPlaylist station.getPlaylist})
			 */
			adToken: string,
			/**
			 * `adTrackingTokens` are required by {@link PReq.ad.registerAd ad.registerAd}.
			 */
			returnAdTrackingTokens?: boolean,
			/**
			 * audioUrl links for the ads are included in the results if set to ‘True’. 
			 */
			supportAudioAds?: boolean,
			/**
			 * bannerAdMap containing an HTML fragment that can be embedded in web pages is included in the results if set to ‘True’. 
			 */
			includeBannerAd?: boolean,
		} & PandoraRequestData;
	}
	export namespace bookmark {
		export type addArtistBookmark = {
			/** See {@link PReq.station.getPlaylist station.getPlaylist} */
			trackToken: string
		} & PandoraRequestData;
		export type addSongBookmark = {
			/** See {@link PReq.station.getPlaylist station.getPlaylist} */
			trackToken: string
		} & PandoraRequestData;
	}
	export namespace station {
		/** 
		 * Stations created by other users are added as reference
		 * to the user’s station list.
		 * These stations cannot be modified (i.e. rate tracks) unless transformed (unlinked).
		 */
		export type transformSharedStation = {
			/** See {@link PReq.user.getStationList user.getStationList} */
			stationToken: string
		} & PandoraRequestData;
		/** Shares a station with specified email addresses. */
		export type shareStation = {
			stationId: string,
			stationToken: string,
			/** What emails to share with. */
			emails: string[]
		} & PandoraRequestData;
		/**
		 * See {@link PReq.user.getStationListChecksum user.getStationListChecksum}
		 */
		export type getGenreStationsChecksum = {
			/**
			 * Honestly it doesn't matter what you
			 * put here as long as it's always the same.
			 * 
			 * I'd go with false though.*/
			includeGenreCategoryAdUrl: boolean
		} & PandoraRequestData;
		/**
		 * Pandora provides a list of predefined stations (“genre stations”).
		 * This method has no parameters.
		 */
		export type getGenreStations = PandoraRequestData;
		/**
		 * Feedback added by
		 * {@link PReq.station.addFeedback station.addFeedback}
		 * can be removed from the station.
		 */
		export type deleteFeedback = {
			/** 
			 * See {@link PReq.station.getStation station.getStation}
			 */
			feedbackId: string
		} & PandoraRequestData;
		/** Extended station information includes seeds and feedback. */
		export type getStation = {
			/**
			 * Existing station, see
			 * {@link PReq.user.getStationList user.getStationList}
			 */
			stationToken: string,
			includeExtendedAttributes: boolean
		} & PandoraRequestData;
		/** Deletes a station. */
		export type deleteStation = {
			/**
			 * Existing station, see
			 * {@link PReq.user.getStationList user.getStationList}
			 */
			stationToken: string
		} & PandoraRequestData;
		/** Renames a station. */
		export type renameStation = {
			/**
			 * Existing station, see
			 * {@link PReq.user.getStationList user.getStationList}
			 */
			stationToken: string,
			/**
			 * New station name
			 */
			stationName: string,
		} & PandoraRequestData;
		/**
		 * Seeds can be removed from a station, except for the last seed.
		 */
		export type deleteMusic = {
			/**
			 * See
			 * {@link PReq.station.getStation station.getStation}
			 * and
			 * {@link PReq.station.addSeed station.addSeed}
			 */
			seedId: string
		} & PandoraRequestData;
		/**
		 * {@link PReq.music.search music.search}
		 * results can be used to add new seeds to an existing station.
		 */
		export type addSeed = {
			/**
			 * Existing station, see {@link PReq.user.getStationList}
			 */
			stationToken: string,

			/**
			 * Obtained via {@link PReq.music.search music.search}
			 */
			musicToken: string
		} & PandoraRequestData;
		/**
		 * Stations can either be created with a musicToken
		 * obtained by Search
		 * ({@link PReq.music.search music.search}) 
		 * or trackToken from playlists
		 * ({@link PReq.station.getPlaylist station.getPlaylist}).
		 * 
		 * The latter needs a musicType to specify whether
		 * the track itself or its artist should be used as seed.
		 */
		export type createStation = {
			/** “song” for genre stations */
			musicType: "song" | "artist"
		} & (createStationWithTrackToken | createStationWithMusicToken) & PandoraRequestData;
		type createStationWithTrackToken = {
			trackToken: string,
			musicToken: never
		};
		type createStationWithMusicToken = {
			trackToken: never,
			musicToken: string
		};
		/**
		 * This method must be sent over a TLS-encrypted connection.
		 */
		export type getPlaylist = {
			/**
			 * Station token from
			 * {@link PReq.user.getStationList user.getStationList}
			 */
			stationToken: string,
			/**
			 * Comma separated list of additional audio formats to return.
			 */
			additionalAudioUrl?: string,

			stationIsStarting?: boolean,
			includeTrackLength?: boolean,
			includeAudioToken?: boolean,
			xplatformAdCapable?: boolean,
			includeAudioReceiptUrl?: boolean,
			includeBackstageAdUrl?: boolean,
			includeSharingAdUrl?: boolean,
			includeSocialAdUrl?: boolean,
			includeCompetitiveSepIndicator?: boolean,
			includeCompletePlaylist?: boolean,
			includeTrackOptions?: boolean,
			audioAdPodCapable?: boolean, 
		} & PandoraRequestData;

		/**
		 * Songs can be "loved" or "banned".
		 * Both influence the music played on the station.
		 * Banned songs are never played again on this particular station.
		 */
		export type addFeedback = {
			/**
			 * Obtained via `{@link PReq.user.getStationList user.getStationList}`
			 */
			stationToken: string
			trackToken: string
			/**
			 * True "loves" (likes) the track
			 * False "bans" (dislikes) track
			 */
			isPositive: boolean
		} & PandoraRequestData;
	}
	export namespace music {
		/**
		 * This is a free text search that matches artist and track names.
		 */
		export type search = {
			/**
			 * Artist name or track title
			 */
			searchText: string,
			includeNearMatches?: boolean,
			includeGenreStations?: boolean,
		} & PandoraRequestData;
	}
	export namespace user {
		/**
		 * Returns whether a user is subscribed or
		 * if they can subscribe to Pandora One.
		 * Can be useful to determine which Partner password to use.
		 */
		export type canSubscribe = {
			/** I don't know what this does, but it's optional so just leave it out I guess */
			iapVendor?: string
		} & PandoraRequestData;
		export type changeSettings = {
			currentUsername: string,
			currentPassword: string,
			userInitiatedChange?: boolean,
			includeFacebook?: boolean
		} & Partial<PandoraAccountSettings> & PandoraRequestData;
		export type getSettings = {
			includeFacebook: boolean
		} & PandoraRequestData;
		export type createUser = {
			username: string,
			password: string,
			gender: "Male" | "Female",
			birthYear: number,
			zipCode: number,
			emailOptIn: boolean,
			countryCode: string,
			accountType: "registered",
			registeredType: "user",
			includePandoraOneInfo: boolean,
			includeAccountMessage: boolean,
			returnCollectTrackLifetimeStats: boolean,
			returnIsSubscriber: boolean,
			xplatformAdCapable: boolean,
			includeFacebook: boolean,
			includeGoogleplay: boolean,
			includeShowUserRecommendations: boolean,
			includeAdvertiserAttributes: boolean,
		} & PandoraRequestData;
		export type validateUsername = {
			username: string
		} & PandoraRequestData;
		/**
		 * Currently stationId and stationToken are the same.
		 * QuickMix stations additionally include a list of
		 * station ids (`quickMixStationIds`) that are currently selected for the mix.
		 */
		export type getStationList = {
			/**
			 * Includes “artUrl” field in result.
			 */
			includeStationArtUrl?: boolean
			stationArtSize?: `W${number}H${number}`,
			includeAdAttributes?: boolean,
			includeStationSeeds?: boolean,

			/**
			 * Include search recommendations in response
			 */		 
			includeRecommendations?: boolean,

			/**
			 * include explanation strings in the recommendations
			 */
			includeExplanations?: boolean,
			
			/**
			 * Include “extras” lists in the recomendations
			 */
			includeExtras?: boolean
		} & PandoraRequestData;
		/**
		 * To check if the station list was modified by another client,
		 * the checksum can be fetched.
		 * This method has no parameters.
		 */
		export type getStationListChecksum = PandoraRequestData;
		export type setQuickMix = {
			/** 
			 * List of station ids (see {@link PReq.user.getStationList user.getStationList})
			*/
			 quickMixStationIds: string[]
		} & PandoraRequestData;
		/**
		 * A song can be banned from _all stations_ temporarily (one month).
		 */
		export type sleepSong = {
			/** See {@link PReq.station.getPlaylist station.getPlaylist} */
			trackToken: string
		} & PandoraRequestData;
		/**
		 * Users can bookmark artists or songs.
		 * This method has no parameters.
		 */
		export type getBookmarks = PandoraRequestData;
	}
	export namespace test {
		/**
		 * Check whether Pandora is available in the connecting client’s country,
		 * based on geoip database. This is not strictly required since {@link PReq.auth.partnerLogin Partner login}
		 * enforces this restriction.
		 * 
		 * This request has no parameters,
		 * and does not require syncTime or userAuthToken.
		 */
		export type checkLicensing = PandoraRequestData;
	}
	export namespace auth {
		/**
		 * This request serves as API version validation,
		 * time synchronization and endpoint detection and must be sent over a
		 * TLS-encrypted link. 
		 * 
		 * The POST body is **not** encrypted.
		 * 
		 * For more information, please check
		 * https://6xq.net/pandora-apidoc/json/partners/#partners
		 */
		export type partnerLogin = {
			username: string,
			password: string,
			deviceModel: string,
			/**
			 * Current version number is "5"
			 */
			version: string,
			
			includeUrls?: boolean,
			returnDeviceType?: boolean,
			returnUpdatePromptVersions?: boolean
		} & PandoraRequestData;

		/**
		 * This request must be sent over a TLS-encrypted link. It authenticates
		 * the Pandora user by sending his username, usually his email address,
		 * and password as well as the partnerAuthToken obtained by Partner login.
		 */
		export type userLogin = {
			loginType: "user",
			/**
			 * Username. To validate whether this is correct or unique, use
			 * {@link PReq.user.validateUsername user.validateUsername}
			 */
			username: string,
			/**
			 * User’s password
			 */
			password: string,
			/**
			 * Partner token obtained by Partner Login
			 * 
			 * See {@link PReq.auth.partnerLogin auth.partnerLogin}
			 */
			partnerAuthToken: string,


			returnGenreStations?: boolean,
			returnCapped?: boolean,
			includePandoraOneInfo?: boolean,
			includeDemographics?: boolean,
			includeAdAttributes?: boolean,

			/**
			 * Return station list, see 
			 * {@link PReq.user.getStationList user.getStationList}
			 */
			returnStationList?: boolean,
			includeStationArtUrl?: boolean,
			includeStationSeeds?: boolean,
			includeShuffleInsteadOfQuickMix?: boolean,

			stationArtSize?: `W${number}H${number}`,
			returnCollectTrackLifetimeStats?: boolean,
			returnIsSubscriber?: boolean,
			xplatformAdCapable?: boolean,
			complimentarySponsorSupported?: boolean,
			includeSubscriptionExpiration?: boolean,
			returnHasUsedTrial?: boolean,
			returnUserstate?: boolean,
			includeAccountMessage?: boolean,
			includeUserWebname?: boolean,
			includeListeningHours?: boolean,
			includeFacebook?: boolean,
			includeTwitter?: boolean,
			includeDailySkipLimit?: boolean,
			includeSkipDelay?: boolean,
			includeGoogleplay?: boolean,
			includeShowUserRecommendations?: boolean,
			includeAdvertiserAttributes?: boolean,
		} & PandoraRequestData;
	}
	export namespace track {
		/**
		 * Get (incomplete) list of attributes assigned to song by Music Genome Project.
		 */
		export type explainTrack = {
			/** See {@link PReq.station.getPlaylist station.getPlaylist} */
			trackToken: string
		} & PandoraRequestData;
	}
}

export class PAPIError extends Error {
	code: PAPI_ERRORS;
	/** MUST be one of {@link PAPI_ERRORS}, I just can't figure out how type it */
	humanCode: string;

	constructor(opts: {
		message: string,
		code: PAPI_ERRORS,
	}) {
		super(opts.message);
		this.code = opts.code;
		this.humanCode = PAPI_ERRORS[opts.code];
	}
}

/**
 * Known Pandora API error codes. Use {@link PAPIError} when actually _throwing_ one.
 */
export enum PAPI_ERRORS {
	/**
	 * Internal error. It can denote that your account has been temporarily blocked due to having too frequent station.getPlaylist calls.
	 */
	INTERNAL_ERROR = 0,
	MAINTENANCE_MODE = 1,
	URL_PARAM_MISSING_METHOD = 2,
	URL_PARAM_MISSING_AUTH_TOKEN = 3,
	URL_PARAM_MISSING_PARTNER_ID = 4,
	URL_PARAM_MISSING_USER_ID = 5,
	SECURE_PROTOCOL_REQUIRED = 6,
	CERTIFICATE_REQUIRED = 7,
	PARAMETER_TYPE_MISMATCH = 8,

	/**
	 * Usually occurs when one or more required parameters are missing for the method called.
	 */
	PARAMETER_MISSING = 9, 
	PARAMETER_VALUE_INVALID = 10,
	API_VERSION_NOT_SUPPORTED = 11,

	/**
	 * Pandora not available in this country.
	 */
	LICENSING_RESTRICTIONS = 12,

	/**
	 * Bad sync time?
	 */
	INSUFFICIENT_CONNECTIVITY = 13, 

	/**
	 * Unknown method name?
	 */
	METHOD_NOT_FOUND = 14,

	/**
	 * Wrong protocol (http/https)?
	 */
	WRONG_PROTOCOL = 15,
	READ_ONLY_MODE = 1000,

	/**
	 * Occurs once a user auth token expires.
	 */
	INVALID_AUTH_TOKEN = 1001,

	/**
	 * Occurs with
	 * {@link PReq.auth.partnerLogin auth.partnerLogin} and 
	 * {@link PReq.auth.userLogin auth.userLogin}.
	 */
	INVALID_PARTNER_LOGIN = 1002,

	/**
	 * Occurs with `station.getPlaylist`.
	 * Pandora One Subscription or Trial Expired. Possibly account suspended?
	 */
	LISTENER_NOT_AUTHORIZED = 1003, 

	/**
	 * User not authorized to perform action. Is your station token correct?
	 */
	USER_NOT_AUTHORIZED = 1004, 

	/**
	 * Station limit reached.
	 */
	MAX_STATIONS_REACHED = 1005,

	/**
	 * Station does not exist.
	 */
	STATION_DOES_NOT_EXIST = 1006,
	COMPLIMENTARY_PERIOD_ALREADY_IN_USE = 1007,

	/**
	 * Occurs with `station.addFeedback`
	 * Returned when attempting to add feedback to shared station.
	 */
	CALL_NOT_ALLOWED = 1008,
	DEVICE_NOT_FOUND = 1009,
	PARTNER_NOT_AUTHORIZED = 1010,
	INVALID_USERNAME = 1011,
	INVALID_PASSWORD = 1012,
	USERNAME_ALREADY_EXISTS = 1013,
	DEVICE_ALREADY_ASSOCIATED_TO_ACCOUNT = 1014,
	UPGRADE_DEVICE_MODEL_INVALID = 1015,
	EXPLICIT_PIN_INCORRECT = 1018,
	EXPLICIT_PIN_MALFORMED = 1020,
	DEVICE_MODEL_INVALID = 1023,
	ZIP_CODE_INVALID = 1024,
	BIRTH_YEAR_INVALID = 1025,
	BIRTH_YEAR_TOO_YOUNG = 1026,
	INVALID_COUNTRY_CODE = 1027,
	INVALID_GENDER = 1027,
	/**
	 * Occurs with {@link PReq.station.deleteMusic station.deleteMusic}
	 * when you try to remove the last seed of a station,
	 * as they require at least one seed to function.
	 */
	CANNOT_YEET_LAST_SEED = 1032,
	DEVICE_DISABLED = 1034,
	DAILY_TRIAL_LIMIT_REACHED = 1035,
	INVALID_SPONSOR = 1036,
	USER_ALREADY_USED_TRIAL = 1037,

	/**
	 * Too many requests for a new playlist.
	 */
	PLAYLIST_EXCEEDED = 1039
}