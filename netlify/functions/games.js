const fs = require('fs');
const path = require('path');

// Use /tmp directory for persistent storage during function lifecycle
const STORAGE_FILE = '/tmp/audio-games-data.json';
let gameIdCounter = 1;

// Initialize storage
function initializeStorage() {
    try {
        // Try to load existing data from temp file
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            gameIdCounter = parsed.counter || 1;
            console.log('Loaded existing games from temp storage');
            return parsed.games || [];
        } else {
            // Initialize with demo game
            const initialGames = [{
                id: 1,
                name: "Demo Game",
                files: generateDemoAudioFiles()
            }];
            gameIdCounter = 2;
            
            // Save initial data
            saveToStorage(initialGames);
            console.log('Initialized new games in temp storage');
            return initialGames;
        }
    } catch (error) {
        console.error('Error initializing storage:', error);
        // Fallback to demo game
        const fallbackGames = [{
            id: 1,
            name: "Demo Game",
            files: generateDemoAudioFiles()
        }];
        gameIdCounter = 2;
        return fallbackGames;
    }
}

// Save games to temp storage
function saveToStorage(games) {
    try {
        const dataToSave = {
            games: games,
            counter: gameIdCounter,
            lastUpdated: new Date().toISOString()
        };
        
        fs.writeFileSync(STORAGE_FILE, JSON.stringify(dataToSave), 'utf8');
        console.log('Successfully saved games to temp storage');
        return true;
    } catch (error) {
        console.error('Error saving to temp storage:', error);
        return false;
    }
}

// Load games from temp storage
function loadFromStorage() {
    try {
        if (fs.existsSync(STORAGE_FILE)) {
            const data = fs.readFileSync(STORAGE_FILE, 'utf8');
            const parsed = JSON.parse(data);
            gameIdCounter = parsed.counter || 1;
            return parsed.games || [];
        }
        return [];
    } catch (error) {
        console.error('Error loading from temp storage:', error);
        return [];
    }
}

// Generate demo audio files with different frequencies
function generateDemoAudioFiles() {
    const files = [];
    for (let i = 0; i < 18; i++) {
        const frequency = 200 + (i * 50);
        const audioData = generateSineWave(frequency, 0.3, 44100); // 0.3 seconds duration
        files.push({
            filename: `demo_file_${i + 1}.mp3`,
            original_name: `demo_${i + 1}.mp3`,
            path: `data:audio/wav;base64,${audioData}`
        });
    }
    return files;
}

// Generate sine wave audio data
function generateSineWave(frequency, duration, sampleRate) {
    const samples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + samples * 2);
    const view = new DataView(buffer);
    
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + samples * 2, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, 'data');
    view.setUint32(40, samples * 2, true);
    
    for (let i = 0; i < samples; i++) {
        const sample = Math.sin(2 * Math.PI * frequency * i / sampleRate) * 0.3;
        view.setInt16(44 + i * 2, sample * 32767, true);
    }
    
    return Buffer.from(buffer).toString('base64');
}

// MULTIPART PARSER - working solution without external dependencies
function parseMultipartFormData(body, boundary) {
    console.log('=== MULTIPART PARSING DEBUG ===');
    console.log('Boundary:', boundary);
    console.log('Body type:', typeof body);
    console.log('Body length:', body ? body.length : 'null/undefined');
    
    if (!body) {
        console.log('ERROR: No body provided');
        return { fields: {}, files: [] };
    }
    
    // Ensure we're working with a string
    const bodyStr = typeof body === 'string' ? body : body.toString();
    console.log('Body string length:', bodyStr.length);
    console.log('First 500 chars of body:', bodyStr.substring(0, 500));
    
    const fields = {};
    const files = [];
    
    // Split by boundary
    const delimiter = `--${boundary}`;
    const parts = bodyStr.split(delimiter);
    
    console.log('Found parts:', parts.length);
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        console.log(`\n--- Processing part ${i} ---`);
        console.log('Part length:', part.length);
        
        if (part.length < 10) {
            console.log('Skipping short part');
            continue;
        }
        
        // Skip the final boundary marker
        if (part.trim() === '--' || part.trim() === '') {
            console.log('Skipping boundary marker');
            continue;
        }
        
        // Find the double newline that separates headers from content
        const headerEndIndex = part.indexOf('\r\n\r\n');
        if (headerEndIndex === -1) {
            console.log('No header separator found, trying \\n\\n');
            const headerEndIndex2 = part.indexOf('\n\n');
            if (headerEndIndex2 === -1) {
                console.log('No header separator found at all, skipping');
                continue;
            }
        }
        
        const actualHeaderEnd = headerEndIndex !== -1 ? headerEndIndex : part.indexOf('\n\n');
        const headers = part.substring(0, actualHeaderEnd);
        const content = part.substring(actualHeaderEnd + (headerEndIndex !== -1 ? 4 : 2));
        
        console.log('Headers:', headers);
        console.log('Content length:', content.length);
        console.log('Content preview:', content.substring(0, 100));
        
        // Parse the Content-Disposition header
        const dispositionMatch = headers.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
        
        if (dispositionMatch) {
            const fieldName = dispositionMatch[1];
            const fileName = dispositionMatch[2];
            
            console.log(`Found field: ${fieldName}`);
            console.log(`Filename: ${fileName || 'none'}`);
            
            if (fileName) {
                // This is a file
                console.log('Processing as file');
                
                // Convert content to base64 (assuming it's binary data)
                const contentBuffer = Buffer.from(content, 'binary');
                const base64Data = contentBuffer.toString('base64');
                
                // Determine MIME type
                let mimeType = 'audio/mpeg';
                const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
                if (contentTypeMatch) {
                    mimeType = contentTypeMatch[1].trim();
                }
                
                files.push({
                    fieldName: fieldName,
                    filename: fileName,
                    mimeType: mimeType,
                    base64: base64Data,
                    dataUrl: `data:${mimeType};base64,${base64Data}`,
                    size: contentBuffer.length
                });
                
                console.log(`File processed: ${fileName}, size: ${contentBuffer.length} bytes`);
            } else {
                // This is a regular form field
                console.log('Processing as form field');
                
                // Clean up the content (remove trailing newlines)
                let fieldValue = content;
                // Remove trailing \r\n
                if (fieldValue.endsWith('\r\n')) {
                    fieldValue = fieldValue.slice(0, -2);
                }
                // Remove trailing \n
                if (fieldValue.endsWith('\n')) {
                    fieldValue = fieldValue.slice(0, -1);
                }
                
                fields[fieldName] = fieldValue;
                console.log(`Field processed: ${fieldName} = "${fieldValue}"`);
            }
        } else {
            console.log('No Content-Disposition header found in part');
        }
    }
    
    console.log('\n=== PARSING COMPLETE ===');
    console.log('Fields found:', Object.keys(fields));
    console.log('Field values:', fields);
    console.log('Files found:', files.length);
    console.log('=========================\n');
    
    return { fields, files };
}

const handler = async (event, context) => {
    // Initialize storage and load games
    let games = initializeStorage();
    
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    const path = event.path.replace('/.netlify/functions/games', '');
    
    try {
        if (event.httpMethod === 'GET') {
            if (path === '' || path === '/') {
                // Reload from storage to get latest data
                games = loadFromStorage();
                if (games.length === 0) {
                    games = initializeStorage();
                }
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(games)
                };
            } else {
                // Get specific game
                const gameId = parseInt(path.split('/')[1]);
                games = loadFromStorage();
                const game = games.find(g => g.id === gameId);
                if (!game) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Game not found' })
                    };
                }
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(game)
                };
            }
        }
        
        if (event.httpMethod === 'POST') {
            console.log('\n=== NETLIFY FUNCTION POST REQUEST ===');
            console.log('Event keys:', Object.keys(event));
            console.log('Headers received:', JSON.stringify(event.headers, null, 2));
            console.log('Body type:', typeof event.body);
            console.log('Body length:', event.body ? event.body.length : 'null/undefined');
            console.log('isBase64Encoded:', event.isBase64Encoded);
            
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            console.log('Content-Type:', contentType);
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                console.log('ERROR: Invalid content type');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Content-Type must be multipart/form-data',
                        received: contentType 
                    })
                };
            }
            
            // Extract boundary
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                console.log('ERROR: No boundary found');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No boundary found in Content-Type' })
                };
            }
            
            const boundary = boundaryMatch[1].replace(/"/g, '');
            console.log('Extracted boundary:', boundary);
            
            // Handle base64 encoded body (common in Netlify Functions)
            let bodyData = event.body;
            if (event.isBase64Encoded) {
                console.log('Body is base64 encoded, decoding...');
                bodyData = Buffer.from(event.body, 'base64').toString('binary');
                console.log('Decoded body length:', bodyData.length);
            }
            
            // Parse the multipart data
            const { fields, files } = parseMultipartFormData(bodyData, boundary);
            
            // Validate game name
            const gameName = fields.name;
            console.log('Game name extracted:', gameName);
            
            if (!gameName) {
                console.log('ERROR: No game name found');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Game name is required',
                        received_fields: Object.keys(fields),
                        field_values: fields,
                        debug_info: {
                            boundary: boundary,
                            content_type: contentType,
                            body_length: bodyData ? bodyData.length : 0,
                            is_base64: event.isBase64Encoded
                        }
                    })
                };
            }
            
            // Validate files
            const audioFiles = files.filter(f => f.fieldName === 'files');
            console.log('Audio files found:', audioFiles.length);
            
            if (audioFiles.length === 0) {
                console.log('ERROR: No audio files found');
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'At least one audio file is required',
                        received_files: files.length,
                        file_details: files.map(f => ({ name: f.filename, field: f.fieldName, size: f.size }))
                    })
                };
            }
            
            // Load current games from storage
            games = loadFromStorage();
            
            // Process audio files
            const processedFiles = [];
            for (let i = 0; i < Math.min(audioFiles.length, 18); i++) {
                const file = audioFiles[i];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${i + 1}.mp3`,
                    original_name: file.filename,
                    path: file.dataUrl
                });
            }
            
            // Ensure we have exactly 18 files
            while (processedFiles.length < 18) {
                const sourceIndex = processedFiles.length % audioFiles.length;
                const sourceFile = audioFiles[sourceIndex];
                processedFiles.push({
                    filename: `game_${gameIdCounter}_file_${processedFiles.length + 1}.mp3`,
                    original_name: sourceFile.filename,
                    path: sourceFile.dataUrl
                });
            }
            
            // Create new game
            const newGame = {
                id: gameIdCounter++,
                name: gameName,
                files: processedFiles.slice(0, 18),
                created: new Date().toISOString()
            };
            
            games.push(newGame);
            
            // Save to storage
            const saveSuccess = saveToStorage(games);
            if (!saveSuccess) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to save game to storage' })
                };
            }
            
            console.log(`SUCCESS: Created game "${gameName}" with ${newGame.files.length} files`);
            console.log('=== END REQUEST ===\n');
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game uploaded successfully',
                    game_name: gameName,
                    files_uploaded: audioFiles.length,
                    total_files: newGame.files.length,
                    game_id: newGame.id
                })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const gameId = parseInt(path.split('/')[1]);
            
            // Load current games
            games = loadFromStorage();
            const gameIndex = games.findIndex(g => g.id === gameId);
            
            if (gameIndex === -1) {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({ error: 'Game not found' })
                };
            }
            
            const deletedGame = games.splice(gameIndex, 1)[0];
            
            // Save updated games to storage
            const saveSuccess = saveToStorage(games);
            if (!saveSuccess) {
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ error: 'Failed to delete game from storage' })
                };
            }
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game deleted successfully',
                    deleted_game: deletedGame.name
                })
            };
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('FUNCTION ERROR:', error);
        console.error('Stack trace:', error.stack);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message,
                stack: error.stack
            })
        };
    }
};

module.exports = { handler };
