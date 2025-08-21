# Audio Memory Game

A sophisticated audio memory challenge game with glassmorphism design and admin functionality.

## Features

- **Audio Memory Challenge**: Match pairs of sounds across 36 cards (18 pairs)
- **Admin Panel**: Password-protected admin access with "MUSIC" password
- **Game Management**: Upload new games with 18 audio files each
- **Custom Ticker Messages**: Upload custom funny messages for the ticker display
- **Beautiful Design**: Glassmorphism UI with responsive design
- **Persistent Data**: Uses Netlify Functions for backend with proper data persistence

## Deployment

### Netlify Deployment

1. Connect this repository to Netlify
2. Build settings:
   - Build command: `npm install` (optional)
   - Publish directory: `public`
   - Functions directory: `netlify/functions`

### Manual Deployment

1. Download/clone this repository
2. Deploy the `public` folder to any static hosting service
3. For full functionality, deploy to Netlify to enable the Functions backend

## Usage

### Playing the Game

1. Click on cards to hear sounds
2. Find matching pairs of sounds
3. Complete all 18 pairs to win
4. Use "New Game" to restart

### Admin Functions

1. Click the gear (⚙) icon in bottom-right corner
2. Enter password: `MUSIC`
3. Upload new games (18 audio files required)
4. Upload custom ticker messages (one per line)
5. Delete existing games

### Ticker Sequence

The ticker displays messages in this sequence:
1. 10-second delay (blank)
2. "Welcome to This" (6 seconds)
3. Blank (3 seconds)
4. "A NEW way to waste time!" (5 seconds)
5. Blank (5 seconds)
6. Custom messages cycle (10 seconds on, 20 seconds off)

## Technical Details

- **Frontend**: Pure HTML/CSS/JavaScript with glassmorphism design
- **Backend**: Netlify Functions (Node.js)
- **Audio**: Web Audio API for demo sounds
- **Storage**: File-based persistence via Netlify Functions
- **Responsive**: Works on desktop and mobile devices

## Embed Code

For embedding in other websites:

```html
<iframe src="YOUR_NETLIFY_URL" 
        width="100%" 
        height="700px" 
        frameborder="0" 
        style="border-radius: 20px;">
</iframe>
```

## File Structure

```
├── public/
│   └── index.html          # Main game interface
├── netlify/
│   └── functions/
│       ├── games.js        # Games API endpoint
│       └── messages.js     # Ticker messages API endpoint
├── netlify.toml            # Netlify configuration
├── package.json            # Dependencies
└── README.md              # This file
```

## License

Created for media archives integration.

