import { sendPlayerAction } from "./player";

export function loggedInToSpotify(): boolean {
    return sendPlayerAction('loggedInToSpotify');
}

export function loggedOutOfSpotify(): boolean {
    return sendPlayerAction('loggedOutOfSpotify');
}