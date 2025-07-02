## current 

The desktop app sends transcription request to the server, and the server will return transcribed text. The transcription includes integrating with DeepSeek to refine the transcript text.

## expected

The desktop app needs to have a toggle - AI润色. When the toggle is turned on, it signals that we need to refine the transcribed text by integrating with deepseek.

## context

The desktop app now sends the transcription API request to the server and the server returns the response to the desktop app.

server is located at /Users/alvinj/Desktop/Development/Voco-web-portal-alpha/project/server/server.js


### `POST /api/speech`

This endpoint transcribes audio data into text.

**Authentication**

*   Requires a valid JSON Web Token (JWT) to be sent in the `Authorization` header.
*   Format: `Authorization: Bearer <YOUR_ACCESS_TOKEN>`

**Query Parameters**

*   `refine` (optional): A boolean flag to control server-side text refinement.
    *   If `refine=true`, the transcribed text will be processed by an additional AI refinement service.
    *   If omitted or set to any other value, the original transcript from the speech-to-text engine is returned.
    *   **Example:** `/api/speech?refine=true`

**Request Headers**

*   `Content-Type`: Must be `audio/wav`.

**Request Body**

*   The raw binary data of the `.wav` audio file.

**Responses**

*   **200 OK (Success)**: Returned when the transcription is successful. The body will be a JSON object containing the transcript.
    ```json
    {
      "transcript": "This is the transcribed text..."
    }
    ```

*   **401 Unauthorized**: Returned if the `Authorization` header is missing or the token is invalid.

*   **403 Forbidden**: Returned if the token is malformed or expired.

*   **500 Internal Server Error**: Returned if there's a server-side configuration issue (e.g., missing API keys) or an unexpected error during the transcription process.
    ```json
    {
      "error": "A description of the error."
    }
    ```

## Task
1. add toggle on UI
2. when sending request to server transcription api, toggle variable needs to be included
