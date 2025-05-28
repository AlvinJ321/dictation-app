import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

const app = express();
const port = 3001;

const AK = process.env.BAIDU_API_KEY;
const SK = process.env.BAIDU_SECRET_KEY;

// Increase all limits
app.use(cors());
app.use(express.json({
    limit: '50mb'
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: '500mb',
    parameterLimit: 50000 
}));
app.use(express.raw({ limit: '500mb' }));

// Store token in memory (in production, use a proper cache/database)
let accessToken: string | null = null;
let tokenExpiry: Date | null = null;

// Get access token from Baidu API
async function getAccessToken() {
    if (accessToken && tokenExpiry && tokenExpiry > new Date()) {
        console.log('Using cached token');
        return accessToken;
    }

    try {
        console.log('Fetching new access token...');
        const response = await axios({
            method: 'POST',
            url: `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${AK}&client_secret=${SK}`,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        accessToken = response.data.access_token;
        const expiresIn = response.data.expires_in;
        tokenExpiry = new Date(Date.now() + expiresIn * 1000);
        console.log('New token obtained, expires in:', expiresIn, 'seconds');

        return accessToken;
    } catch (error) {
        console.error('Error getting access token:', error);
        throw error;
    }
}

// Endpoint to get access token
app.get('/api/token', async (req, res) => {
    try {
        const token = await getAccessToken();
        res.json({ access_token: token });
    } catch (error) {
        console.error('Token error:', error);
        res.status(500).json({ error: 'Failed to get access token' });
    }
});

// Validate audio data
function validateAudioData(speech: string): { isValid: boolean; error?: string } {
    if (!speech) {
        return { isValid: false, error: 'No audio data provided' };
    }

    try {
        const audioBuffer = Buffer.from(speech, 'base64');
        if (audioBuffer.length < 100) {
            return { isValid: false, error: 'Audio data too short' };
        }
        return { isValid: true };
    } catch (error) {
        return { isValid: false, error: 'Invalid base64 audio data' };
    }
}

// Endpoint for speech recognition
app.post('/api/speech', async (req, res) => {
    try {
        console.log('Received speech recognition request');
        const token = await getAccessToken();
        const { speech } = req.body;
        
        // Validate audio data
        const validation = validateAudioData(speech);
        if (!validation.isValid) {
            console.error('Audio validation failed:', validation.error);
            return res.status(400).json({ error: validation.error });
        }

        const audioBuffer = Buffer.from(speech, 'base64');
        console.log('Audio data details:', {
            lengthInBytes: audioBuffer.length,
            base64Length: speech.length,
            approximateDurationMs: (audioBuffer.length / 32000) * 1000 // for 16kHz 16-bit mono
        });

        const options = {
            method: 'POST',
            url: 'https://vop.baidu.com/server_api',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            data: {
                format: "pcm",
                rate: 16000,
                channel: 1,
                cuid: "r2so8p40dI87aL6nHjl4nFzxTALTHvRV",
                token: token,
                speech: speech,
                len: audioBuffer.length
            }
        };

        console.log('Sending request to Baidu API...');
        const response = await axios(options);
        
        // Process and validate response
        if (response.data.err_no === 0) {
            if (!response.data.result || response.data.result.length === 0) {
                console.log('No speech detected in the audio');
                return res.json({ 
                    status: 'success',
                    message: 'No speech detected',
                    result: []
                });
            }
            console.log('Speech recognition successful:', response.data.result);
            return res.json(response.data);
        } else {
            console.error('Baidu API error:', response.data);
            return res.status(400).json({
                error: 'Speech recognition failed',
                details: response.data
            });
        }
    } catch (error: any) {
        console.error('Speech recognition error:', error.response?.data || error);
        const errorMessage = error.response?.data?.error_msg || error.message;
        res.status(500).json({ 
            error: 'Speech recognition failed',
            details: errorMessage
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
