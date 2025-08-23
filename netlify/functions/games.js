const https = require('https');
const http = require('http');

// Xano configuration
const XANO_BASE_URL = 'https://xajo-bs7d-cagt.n7e.xano.io/api:owXpCDEu';

// Helper function to make HTTP requests to Xano
function makeXanoRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(XANO_BASE_URL + endpoint);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname + url.search,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Netlify-Function/1.0'
            }
        };

        const req = client.request(options, (res) => {
            let body = '';
            
            res.on('data', (chunk) => {
                body += chunk;
            });
            
            res.on('end', () => {
                console.log(`Xano ${method} ${endpoint} - Status: ${res.statusCode}, Body: ${body.substring(0, 200)}...`);
                
                try {
                    const jsonData = JSON.parse(body);
                    
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(jsonData);
                    } else {
                        reject(new Error(`Xano API error: ${res.statusCode} - ${JSON.stringify(jsonData)}`));
                    }
                } catch (parseError) {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve({ message: body });
                    } else {
                        reject(new Error(`Xano API error: ${res.statusCode} - ${body}`));
                    }
                }
            });
        });

        req.on('error', (error) => {
            console.error('Request error:', error);
            reject(new Error(`Request failed: ${error.message}`));
        });

        if (data && (method === 'POST' || method === 'PUT')) {
            req.write(JSON.stringify(data));
        }

        req.end();
    });
}

// Initialize with demo game if none exists
async function ensureDemoGameExists() {
    try {
        console.log('Checking for existing games...');
        const games = await makeXanoRequest('GET', '/game');
        console.log(`Found ${games.length} existing games`);
        
        // Check if demo game exists
        const demoExists = games.find(game => game.name === 'Demo Game');
        if (demoExists) {
            console.log('Demo game already exists');
            return;
        }
        
        console.log('Creating demo game...');
        
        // Generate 18 demo audio files (0.3-second tones)
        const demoFiles = [];
        for (let i = 0; i < 18; i++) {
            // Create a simple tone data URL for demo
            const frequency = 220 + (i * 20); // Different frequency for each file
            const audioData = `data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmcfCSiN1/PQdCMFl`;
            demoFiles.push(audioData);
        }
        
        const demoGame = {
            name: 'Demo Game',
            files: JSON.stringify(demoFiles)
        };
        
        await makeXanoRequest('POST', '/game', demoGame);
        console.log('Demo game created successfully');
        
    } catch (error) {
        console.error('Error ensuring demo game exists:', error);
        // Don't throw - this is not critical for function operation
    }
}

// Parse multipart form data
function parseMultipart(body, boundary) {
    const parts = {};
    const files = {};
    
    try {
        const boundaryBuffer = Buffer.from('--' + boundary);
        const bodyBuffer = Buffer.from(body, 'binary');
        
        const parts_raw = [];
        let start = 0;
        
        while (true) {
            const boundaryIndex = bodyBuffer.indexOf(boundaryBuffer, start);
            if (boundaryIndex === -1) break;
            
            const nextBoundaryIndex = bodyBuffer.indexOf(boundaryBuffer, boundaryIndex + boundaryBuffer.length);
            if (nextBoundaryIndex === -1) break;
            
            const partBuffer = bodyBuffer.slice(boundaryIndex + boundaryBuffer.length + 2, nextBoundaryIndex - 2);
            parts_raw.push(partBuffer);
            start = nextBoundaryIndex;
        }
        
        parts_raw.forEach(part => {
            const headerEndIndex = part.indexOf('\r\n\r\n');
            if (headerEndIndex === -1) return;
            
            const headerBuffer = part.slice(0, headerEndIndex);
            const contentBuffer = part.slice(headerEndIndex + 4);
            const headerString = headerBuffer.toString();
            
            const nameMatch = headerString.match(/name="([^"]+)"/);
            if (!nameMatch) return;
            
            const fieldName = nameMatch[1];
            
            if (headerString.includes('filename=')) {
                // File field
                const contentType = headerString.match(/Content-Type:\s*([^\r\n]+)/);
                const mimeType = contentType ? contentType[1] : 'application/octet-stream';
                
                // Convert to base64 data URL
                const base64Data = contentBuffer.toString('base64');
                const dataUrl = `data:${mimeType};base64,${base64Data}`;
                
                files[fieldName] = {
                    data: dataUrl,
                    size: contentBuffer.length,
                    type: mimeType
                };
            } else {
                // Regular field
                parts[fieldName] = contentBuffer.toString();
            }
        });
        
        return { fields: parts, files: files };
        
    } catch (error) {
        console.error('Error parsing multipart:', error);
        throw new Error('Invalid multipart data');
    }
}

const handler = async (event, context) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS'
    };

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    try {
        console.log(`${event.httpMethod} request to games function`);
        
        if (event.httpMethod === 'GET') {
            // Get all games
            try {
                await ensureDemoGameExists();
                const games = await makeXanoRequest('GET', '/game');
                console.log(`Returning ${games.length} games`);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify(games)
                };
            } catch (error) {
                console.error('Error getting games:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Internal server error',
                        details: error.message 
                    })
                };
            }
        }
        
        if (event.httpMethod === 'POST') {
            // Create new game
            try {
                const contentType = event.headers['content-type'] || event.headers['Content-Type'] || '';
                
                if (!contentType.includes('multipart/form-data')) {
                    throw new Error('Content-Type must be multipart/form-data');
                }
                
                const boundary = contentType.split('boundary=')[1];
                if (!boundary) {
                    throw new Error('Missing boundary in Content-Type');
                }
                
                console.log('Parsing multipart form data...');
                const { fields, files } = parseMultipart(event.body, boundary);
                
                const gameName = fields.name;
                if (!gameName || gameName.trim() === '') {
                    throw new Error('Game name is required');
                }
                
                // Check game limit
                const existingGames = await makeXanoRequest('GET', '/game');
                if (existingGames.length >= 4) {
                    throw new Error('Maximum of 4 games allowed');
                }
                
                // Process audio files
                const audioFiles = [];
                for (let i = 0; i < 18; i++) {
                    const fileKey = `file_${i}`;
                    if (!files[fileKey]) {
                        throw new Error(`Missing audio file ${i + 1}`);
                    }
                    audioFiles.push(files[fileKey].data);
                }
                
                console.log(`Processing ${audioFiles.length} audio files for game: ${gameName}`);
                
                // Create game in Xano
                const gameData = {
                    name: gameName.trim(),
                    files: JSON.stringify(audioFiles)
                };
                
                const result = await makeXanoRequest('POST', '/game', gameData);
                console.log('Game created successfully:', result);
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true, game: result })
                };
                
            } catch (error) {
                console.error('Error creating game:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: error.message || 'Internal server error'
                    })
                };
            }
        }
        
        if (event.httpMethod === 'DELETE') {
            // Delete game
            try {
                const gameId = event.queryStringParameters?.id;
                if (!gameId) {
                    throw new Error('Game ID is required');
                }
                
                console.log(`Deleting game with ID: ${gameId}`);
                
                // First check if it's the demo game
                const games = await makeXanoRequest('GET', '/game');
                const gameToDelete = games.find(g => g.id.toString() === gameId.toString());
                
                if (!gameToDelete) {
                    throw new Error('Game not found');
                }
                
                if (gameToDelete.name === 'Demo Game') {
                    throw new Error('Cannot delete demo game');
                }
                
                // Delete from Xano
                await makeXanoRequest('DELETE', `/game/${gameId}`);
                console.log('Game deleted successfully');
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({ success: true })
                };
                
            } catch (error) {
                console.error('Error deleting game:', error);
                return {
                    statusCode: 500,
                    headers,
                    body: JSON.stringify({ 
                        error: error.message || 'Internal server error'
                    })
                };
            }
        }
        
        // Method not allowed
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
        
    } catch (error) {
        console.error('Handler error:', error);
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

exports.handler = handler;
