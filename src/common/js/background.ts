import { encrypt, decrypt } from './crypt';
import { PandoraSong } from './pandora';


const songHistory: PandoraSong[]      = [];
let currentSong: PandoraSong   | null = null;
const playlist: PandoraSong[]  | null = null;

/**
 * Regions:
 * 1. Bootstrapping
 *      - Read settings from localStorage
 *      - Fire config off to any open popups (which there shouldn't be, but who knows)
 *      - If there are no configured accounts, stop here.
 * 
 * 2. Pandora login
 *      - Once there are configured accounts, start partner & user login.
 *      - 
 */
export const songPiss = null;