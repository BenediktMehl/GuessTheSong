# Players and GameHost all keep track of
- All players: Player = { id: string, name: string, score: number }
- Referee: Player
- Current song: { id: string, title: string, artist: string }
- Guessed players: Player[] 
- Buzzed players: Player[]
- Game state: 'waiting', 'playing', 'ended'
- Current round: number
- Music host: Player 
- Me: Player
- Music host is logged in: boolean
- sessionId: string
- wsStatus: 'connected', 'disconnected', 'reconnecting'

# Game Host

## send updates to all players:
- updatePlayers: Player[]
- updateReferee: Player
- updateCurrentTrack: song
- updateGuessedPlayers: Player[]
- updateBuzzedPlayers: Player[]
- updateGameState: 'waiting', 'playing', 'ended'
- updateCurrentRound: number
- updateMusicHost: Player and isloggedIn: boolean
- THIS IS NOT send by the game host, this is sent by the server on session join
- updateSessionId: string
- updateWsStatus: 'connected', 'disconnected', 'reconnecting'

# Player 

## send updates to game host:
- joinGame
- leaveGame
- buzz
- guess
### Music host actions:
- loggedInToSpotify
- loggedOutFromSpotify
### Referee actions:
- acceptAnswer
- rejectAnswer
- nextRound
