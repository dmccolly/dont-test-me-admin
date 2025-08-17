# DON'T TEST ME - Audio Memory Game

A sophisticated audio memory game with advanced admin features for custom game creation and management.

## 🎮 Game Overview

"DON'T TEST ME" is an audio-based memory matching game where players listen to sounds and match pairs by memory. The game features a beautiful dark theme with glassmorphic design and includes comprehensive admin tools for creating custom games.

## ✨ Features

### 🎵 Game Modes
- **Tones**: Built-in frequency-based tones (18 different frequencies)
- **Custom Set 1**: Upload your own audio files
- **Custom Set 2**: Upload your own audio files

### 🎨 Visual Design
- Modern dark theme with gradient backgrounds
- Glassmorphic UI elements with blur effects
- Colorful button grid (6x6 layout)
- Speaker icons on all buttons for clarity
- Subtle glow effects when buttons are clicked
- Animated checkmarks for matched pairs
- Responsive design for mobile and desktop

### 📊 Game Features
- Real-time statistics (matches, attempts, accuracy)
- Timer with best time tracking
- Audio controls (mute/unmute)
- New game and scramble options
- Win screen with performance summary

## 🔧 Admin Features

Access the admin panel by clicking the gear (⚙) button in the top-right corner and entering password: **MUSIC**

### 📁 Batch File Upload
- **Drag & Drop**: Drop up to 18 audio files at once
- **Browse Files**: Click to select multiple files
- **Progress Bars**: Visual upload progress tracking
- **Format Support**: MP3, WAV, OGG, M4A, FLAC
- **File Validation**: Automatic format and count checking

### 🎮 Game Management
- **Rename Games**: Click text fields to customize game names
- **Real-time Updates**: Game tabs update as you type
- **Custom Titles**: Name games anything you want

### 🎲 Auto-Population
- **Random Placement**: "Auto-Populate Keys" shuffles audio into random positions
- **Automatic Pairing**: Creates pairs from your 18 uploaded files
- **One-Click Setup**: Ready to play immediately after upload

### 💾 File Management
- **Individual Preview**: Play button (▶) for each uploaded file
- **File Information**: Shows filename and duration
- **Remove Files**: Delete individual files with ✕ button
- **Clear All**: Wipe entire game slot
- **Status Tracking**: Shows file count (0/18, 18/18, etc.)

### 📊 Advanced Tools
- **Export Games**: Save game configurations as JSON
- **Import Games**: Load previously saved configurations
- **Test Game**: Jump directly to test uploaded games
- **Persistent Storage**: Games stay loaded between sessions

## 🚀 Deployment

### Netlify Deployment
1. Fork this repository
2. Connect your GitHub account to Netlify
3. Create new site from Git
4. Select this repository
5. Deploy with default settings

### Manual Deployment
1. Download all files
2. Upload to any static hosting service
3. Ensure `index.html` is in the root directory

## 🎯 How to Use

### For Players
1. Choose a game mode from the tabs
2. Click buttons to hear sounds
3. Match pairs by memory
4. Try to complete with fewest attempts and best time

### For Admins
1. Click the gear (⚙) button → Enter "MUSIC"
2. Upload 18 audio files per custom slot
3. Rename games by editing text fields
4. Click "Auto-Populate Keys" to randomize positions
5. Use "Test Game" to play immediately
6. Export/import configurations as needed

## 📱 Browser Compatibility

- Chrome/Chromium (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🔊 Audio Requirements

- **File Count**: Exactly 18 files per custom game
- **Formats**: MP3, WAV, OGG, M4A, FLAC
- **Duration**: 2-5 seconds recommended
- **Size**: Keep under 1MB per file for best performance

## 🛠️ Technical Details

- Pure HTML/CSS/JavaScript (no frameworks)
- Web Audio API for sound generation and playback
- LocalStorage for persistent data
- Responsive CSS Grid layout
- Modern ES6+ JavaScript features

## 🔒 Security

- Password-protected admin panel
- Admin button hidden from regular users
- Client-side only (no server required)
- No data transmitted to external servers

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests to improve the game.

---

**Password for Admin Access: MUSIC**

