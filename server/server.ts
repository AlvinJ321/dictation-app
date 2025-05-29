import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios'; // Re-added for Aliyun HTTP POST
// import SpeechTranscriber from 'alibabacloud-nls'; // Not used for direct HTTP POST
import RPCClient from '@alicloud/pop-core'; // Import for token generation

dotenv.config();

const app = express();
const port = 3001;

const ALIYUN_AK_ID = process.env.ALIYUN_AK_ID;
const ALIYUN_AK_SECRET = process.env.ALIYUN_AK_SECRET;
const ALIYUN_APP_KEY = process.env.ALIYUN_APP_KEY; // AppKey will be used by the NLS SDK directly

// Use a larger limit for audio data if necessary, e.g., '50mb'
app.use(express.raw({ type: 'audio/wav', limit: '10mb' })); // For WAV files
app.use(express.raw({ type: 'audio/pcm', limit: '10mb' })); // For PCM files
app.use(express.raw({ type: 'audio/mpeg', limit: '10mb' })); // For MP3 files
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use(cors());

// Store token in memory (in production, use a proper cache/database)
let accessToken: string | null = null;
let tokenExpiry: Date | null = null;

interface AliyunTokenResponse {
    Token?: {
        Id?: string;
        ExpireTime?: number;
    };
    RequestId?: string;
    // Add other fields from actual response if necessary
}

// Get access token from Aliyun API
async function getAccessToken() {
    if (accessToken && tokenExpiry && tokenExpiry > new Date()) {
        console.log('Using cached Aliyun token');
        return accessToken;
    }

    if (!ALIYUN_AK_ID || !ALIYUN_AK_SECRET) {
        const errMsg = 'Aliyun AccessKey ID or Secret is not configured.';
        console.error(errMsg);
        throw new Error(errMsg);
    }

    try {
        console.log('Fetching new Aliyun access token...');

        const client = new RPCClient({
            accessKeyId: ALIYUN_AK_ID,
            accessKeySecret: ALIYUN_AK_SECRET,
            endpoint: 'https://nls-meta.cn-shanghai.aliyuncs.com', // Shanghai endpoint for token service
            apiVersion: '2019-02-28', // API version for CreateToken
        });

        const result = await client.request<AliyunTokenResponse>('CreateToken', {}, { method: 'POST' });

        // According to Aliyun documentation, the response structure is:
        // {
        //   "Token": {
        //     "Id": "actual_token_string",
        //     "ExpireTime": 1600000000 // Unix timestamp in seconds
        //   },
        //   "RequestId": "some-request-id"
        // }

        if (result && result.Token && result.Token.Id && result.Token.ExpireTime) {
            accessToken = result.Token.Id;
            // ExpireTime is a Unix timestamp in seconds. Convert to milliseconds for Date constructor.
            tokenExpiry = new Date(result.Token.ExpireTime * 1000);
            console.log('New Aliyun token obtained, expires at:', tokenExpiry);
            console.log('ALIYUN_ACCESS_TOKEN_ID:', accessToken);
            return accessToken;
        } else {
            console.error('Failed to retrieve token from Aliyun response:', result);
            throw new Error('Invalid token response structure from Aliyun.');
        }

    } catch (error: any) {
        console.error('Error getting Aliyun access token:', error.message || error);
        accessToken = null; // Clear token on error
        tokenExpiry = null;
        throw error;
    }
}

// Endpoint to get access token
app.get('/api/token', async (req: express.Request, res: express.Response) => {
    try {
        const token = await getAccessToken();
        res.json({ token });
    } catch (error) {
        console.error('Error in /api/token endpoint:', error);
        res.status(500).send('Error getting access token');
    }
});

// Aliyun ASR (一句话识别) endpoint
const ALIYUN_ASR_URL = 'https://nls-gateway.cn-shanghai.aliyuncs.com/stream/v1/asr';

interface AliyunASRResponse {
    status: number;
    result?: string; // Or a more detailed object based on actual Aliyun response
    message?: string;
    task_id?: string;
    // Add other fields from actual response if necessary
    // Example from docs: {"status":20000000,"message":"SUCCESS","result":"北京 明天 天气 怎么样","task_id":"925AFAD74467459AA999C755B717****"}
}

app.post('/api/speech', async (req: express.Request, res: express.Response) => {
    console.log('Received audio data, size:', req.body.length);
    console.log('Content-Type:', req.headers['content-type']);

    if (!ALIYUN_APP_KEY) {
        console.error('Aliyun AppKey is not configured.');
        return res.status(500).json({ error: 'Server configuration error: AppKey missing' });
    }

    try {
        const token = await getAccessToken();
        if (!token) {
            return res.status(500).json({ error: 'Failed to obtain access token' });
        }

        const audioData = req.body; // This should be the raw audio buffer
        const audioFormat = req.headers['x-audio-format'] || 'pcm'; // Client should send this header
        const sampleRate = req.headers['x-audio-samplerate'] || '16000'; // Client should send this header

        // Construct query parameters for format, sample_rate, etc.
        // Refer to Aliyun docs for all available parameters: https://help.aliyun.com/zh/isi/developer-reference/api-real-time-speech-recognition#api glist_453_190
        const queryParams = new URLSearchParams({
            appkey: ALIYUN_APP_KEY,
            format: audioFormat as string,
            sample_rate: sampleRate as string,
            enable_punctuation_prediction: 'true',
            enable_inverse_text_normalization: 'true',
            // Add other parameters as needed, e.g., enable_voice_detection, max_start_silence, etc.
        });

        const fullUrl = `${ALIYUN_ASR_URL}?${queryParams.toString()}`;
        console.log(`Sending audio to Aliyun ASR: ${fullUrl}`);
        if (ALIYUN_APP_KEY) {
            console.log(`Using ALIYUN_APP_KEY for header: [${ALIYUN_APP_KEY}], length: ${ALIYUN_APP_KEY.length}`);
            // Optional: Log char codes if suspecting hidden characters
            // console.log('AppKey char codes:', ALIYUN_APP_KEY.split('').map(c => c.charCodeAt(0))); 
        } else {
            console.log('ALIYUN_APP_KEY is undefined or null before sending header');
        }

        const aliyunResponse = await axios.post<AliyunASRResponse>(fullUrl, audioData, {
            headers: {
                'X-NLS-Token': token,
                'X-NLS-AppKey': ALIYUN_APP_KEY,
                'Content-Type': req.headers['content-type'] || 'application/octet-stream', // Use client's content-type or default
            },
            // It's important that axios sends the body as raw binary, not JSON-stringified
            // axios handles Buffer type correctly by default for raw uploads.
        });

        console.log('Aliyun ASR raw response:', aliyunResponse.data);

        if (aliyunResponse.data && aliyunResponse.data.status === 20000000 && aliyunResponse.data.result) {
            res.json({ transcript: aliyunResponse.data.result, fullResponse: aliyunResponse.data });
        } else {
            console.error('Aliyun ASR error:', aliyunResponse.data);
            res.status(500).json({ 
                error: 'Speech recognition failed', 
                details: aliyunResponse.data.message || 'Unknown error from Aliyun',
                aliyunStatus: aliyunResponse.data.status,
                aliyunResponse: aliyunResponse.data
            });
        }

    } catch (error: any) {
        console.error('Error in /api/speech endpoint:', error.response ? error.response.data : error.message);
        if (axios.isAxiosError(error) && error.response) {
            res.status(error.response.status || 500).json({ error: 'Aliyun API error', details: error.response.data });
        } else {
            res.status(500).json({ error: 'Internal server error during speech recognition', details: error.message });
        }
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
