const https = require('https');
const http = require('http');

// Xano configuration
const XANO_BASE_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:pYeQctVX';

// Helper function to make HTTP requests to Xano
function makeXanoRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(`${XANO_BASE_URL}${endpoint}`);
        const isHttps = url.protocol === 'https:';
        const httpModule = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        };

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            const jsonData = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(jsonData);
        }

        const req = httpModule.request(options, (res) => {
            let responseData = '';

            res.on('data', (chunk) => {
                responseData += chunk;
            });

            res.on('end', () => {
                try {
                    const parsedData = responseData ? JSON.parse(responseData) : {};
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsedData);
                    } else {
                        reject(new Error(`Xano API error: ${res.statusCode} - ${responseData}`));
                    }
                } catch (error) {
                    reject(new Error(`JSON parse error: ${error.message}`));
                }
            });
        });

        req.on('error', (error) => {
            reject(new Error(`Request error: ${error.message}`));
        });

        if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Generate demo audio files
function generateDemoAudioFiles() {
    const files = [];
    for (let i = 0; i < 18; i++) {
        const frequency = 200 + (i * 50);
        const audioData = generateSineWave(frequency, 0.3, 44100);
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

// Initialize with demo game if none exists
async function ensureDemoGameExists() {
    try {
        const games = await makeXanoRequest('GET', '/game');
        
        // Check if demo game exists
        const demoExists = games.some(game => game.name === "Demo Game");
        
        if (!demoExists) {
            console.log('Demo game not found, creating...');
            const demoGame = {
                name: "Demo Game",
                files: generateDemoAudioFiles()
            };
            
            await makeXanoRequest('POST', '/game', demoGame);
            console.log('Demo game created successfully');
        }
        
        return true;
    } catch (error) {
        console.error('Error ensuring demo game exists:', error);
        return false;
    }
}

// MULTIPART PARSER - working solution without external dependencies
function parseMultipartFormData(body, boundary) {
    console.log('=== MULTIPART PARSING DEBUG ===');
    console.log('Boundary:', boundary);
    console.log('Body length:', body ? body.length : 'null/undefined');
    
    if (!body) {
        console.log('ERROR: No body provided');
        return { fields: {}, files: [] };
    }
    
    const bodyStr = typeof body === 'string' ? body : body.toString();
    const fields = {};
    const files = [];
    
    const delimiter = `--${boundary}`;
    const parts = bodyStr.split(delimiter);
    
    console.log('Found parts:', parts.length);
    
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (part.length < 10 || part.trim() === '--' || part.trim() === '') {
            continue;
        }
        
        const headerEndIndex = part.indexOf('\r\n\r\n');
        const actualHeaderEnd = headerEndIndex !== -1 ? headerEndIndex : part.indexOf('\n\n');
        
        if (actualHeaderEnd === -1) continue;
        
        const headers = part.substring(0, actualHeaderEnd);
        const content = part.substring(actualHeaderEnd + (headerEndIndex !== -1 ? 4 : 2));
        
        const dispositionMatch = headers.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]*)")?/i);
        
        if (dispositionMatch) {
            const fieldName = dispositionMatch[1];
            const fileName = dispositionMatch[2];
            
            console.log(`Found field: ${fieldName}, filename: ${fileName || 'none'}`);
            
            if (fileName) {
                const contentBuffer = Buffer.from(content, 'binary');
                const base64Data = contentBuffer.toString('base64');
                
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
                let fieldValue = content;
                if (fieldValue.endsWith('\r\n')) {
                    fieldValue = fieldValue.slice(0, -2);
                }
                if (fieldValue.endsWith('\n')) {
                    fieldValue = fieldValue.slice(0, -1);
                }
                
                fields[fieldName] = fieldValue;
                console.log(`Field processed: ${fieldName} = "${fieldValue}"`);
            }
        }
    }
    
    console.log('=== PARSING COMPLETE ===');
    console.log('Fields found:', Object.keys(fields));
    console.log('Files found:', files.length);
    
    return { fields, files };
}

const handler = async (event, context) => {
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
        // Ensure demo game exists on first request
        await ensureDemoGameExists();
        
        if (event.httpMethod === 'GET') {
            if (path === '' || path === '/') {
                console.log('Fetching all games from Xano...');
                const games = await makeXanoRequest('GET', '/game');
                console.log(`Retrieved ${games.length} games from Xano`);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(games)
                };
            } else {
                const gameId = parseInt(path.split('/')[1]);
                console.log(`Fetching game ${gameId} from Xano...`);
                
                try {
                    const game = await makeXanoRequest('GET', `/game/${gameId}`);
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify(game)
                    };
                } catch (error) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Game not found' })
                    };
                }
            }
        }
        
        if (event.httpMethod === 'POST') {
            console.log('\n=== NETLIFY FUNCTION POST REQUEST ===');
            
            const contentType = event.headers['content-type'] || event.headers['Content-Type'];
            
            if (!contentType || !contentType.includes('multipart/form-data')) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Content-Type must be multipart/form-data',
                        received: contentType 
                    })
                };
            }
            
            const boundaryMatch = contentType.match(/boundary=([^;]+)/);
            if (!boundaryMatch) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'No boundary found in Content-Type' })
                };
            }
            
            const boundary = boundaryMatch[1].replace(/"/g, '');
            
            let bodyData = event.body;
            if (event.isBase64Encoded) {
                console.log('Body is base64 encoded, decoding...');
                bodyData = Buffer.from(event.body, 'base64').toString('binary');
            }
            
            const { fields, files } = parseMultipartFormData(bodyData, boundary);
            
            const gameName = fields.name;
            if (!gameName) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Game name is required',
                        received_fields: Object.keys(fields),
                        field_values: fields
                    })
                };
            }
            
            const audioFiles = files.filter(f => f.fieldName === 'files');
            if (audioFiles.length === 0) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'At least one audio file is required',
                        received_files: files.length
                    })
                };
            }
            
            // Check game limit (demo + 3 custom = 4 max)
            const existingGames = await makeXanoRequest('GET', '/game');
            if (existingGames.length >= 4) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Maximum of 4 games allowed. Please delete a game first.',
                        current_count: existingGames.length
                    })
                };
            }
            
            const processedFiles = [];
            for (let i = 0; i < Math.min(audioFiles.length, 18); i++) {
                const file = audioFiles[i];
                processedFiles.push({
                    filename: `game_file_${i + 1}.mp3`,
                    original_name: file.filename,
                    path: file.dataUrl
                });
            }
            
            // Ensure we have exactly 18 files
            while (processedFiles.length < 18) {
                const sourceIndex = processedFiles.length % audioFiles.length;
                const sourceFile = audioFiles[sourceIndex];
                processedFiles.push({
                    filename: `game_file_${processedFiles.length + 1}.mp3`,
                    original_name: sourceFile.filename,
                    path: sourceFile.dataUrl
                });
            }
            
            const gameData = {
                name: gameName,
                files: processedFiles.slice(0, 18)
            };
            
            console.log(`Creating game "${gameName}" in Xano with ${gameData.files.length} files`);
            
            const newGame = await makeXanoRequest('POST', '/game', gameData);
            
            console.log(`SUCCESS: Game created in Xano with ID ${newGame.id}`);
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    message: 'Game uploaded successfully',
                    game_name: gameName,
                    files_uploaded: audioFiles.length,
                    total_files: gameData.files.length,
                    game_id: newGame.id
                })
            };
        }
        
        if (event.httpMethod === 'DELETE') {
            const gameId = parseInt(path.split('/')[1]);
            console.log(`Deleting game ${gameId} from Xano...`);
            
            try {
                // Check if game exists first
                const game = await makeXanoRequest('GET', `/game/${gameId}`);
                
                // Prevent deletion of demo game
                if (game.name === "Demo Game") {
                    return {
                        statusCode: 400,
                        headers,
                        body: JSON.stringify({ error: 'Cannot delete the demo game' })
                    };
                }
                
                // Delete the game
                await makeXanoRequest('DELETE', `/game/${gameId}`);
                
                console.log(`Successfully deleted game: ${game.name}`);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        message: 'Game deleted successfully',
                        deleted_game: game.name
                    })
                };
            } catch (error) {
                if (error.message.includes('404')) {
                    return {
                        statusCode: 404,
                        headers,
                        body: JSON.stringify({ error: 'Game not found' })
                    };
                }
                throw error;
            }
        }
        
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('FUNCTION ERROR:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                details: error.message
            })
        };
    }
};

module.exports = { handler };
