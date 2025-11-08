# Buzzer Sounds

This folder contains MP3 sound files that are randomly assigned to players when they start a game.

## How to Use

1. **Add sounds**: Simply drop `.mp3` files into this folder
2. **Remove sounds**: Delete any `.mp3` files you no longer want
3. **No code changes needed**: The application will automatically discover and use all MP3 files in this folder

## Requirements

- **File format**: MP3 (`.mp3` extension)
- **File naming**: Any name is fine, but avoid special characters and spaces
- **File size**: Recommended to keep files under 500KB for faster loading

## How It Works

- When a player's game starts, a random sound file is selected from this folder
- The same sound will play every time that player presses the buzzer
- If no MP3 files are found in this folder, the application will fall back to the default Web Audio API buzzer sound
- Each player gets their own randomly selected sound (independent of other players)

## Example

```
buzzer-sounds/
  ├── buzzer1.mp3
  ├── buzzer2.mp3
  ├── buzzer3.mp3
  └── custom-sound.mp3
```

