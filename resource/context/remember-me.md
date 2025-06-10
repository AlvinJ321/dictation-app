

### Summary

When a user logs in, the server provides a short-lived `accessToken` and a long-lived `refreshToken`. The client stores both. The `accessToken` is used for authenticating API requests. When it expires, the client-side API logic automatically uses the `refreshToken` to obtain a new `accessToken` from the server without requiring the user to log in again. This process is seamless and continues until the `refreshToken` itself expires (after 7 days).

### Server-Side Implementation (`server/server.js`)

1.  **Token Generation**:
    *   Upon successful login via the `/api/verify` endpoint, the server generates two tokens:
        *   An `accessToken` with a short expiry (15 minutes), signed with `jsonwebtoken`.
        *   A cryptographically secure `refreshToken` (a random 64-byte hex string).
    *   The `refreshToken` and its expiry date (7 days from login) are saved in the `users` table in the database, linked to the user. The `server/models/User.js` file defines the schema for this.

2.  **Token Refresh Endpoint**:
    *   There is a dedicated endpoint, `/api/refresh-token`, that accepts a `refreshToken`.
    *   It looks up the user associated with that token in the database.
    *   If the token is valid and not expired, it issues a new `accessToken` (valid for another 15 minutes).
    *   If the `refreshToken` is invalid or expired, it returns an error, forcing the user to log in again.

### Client-Side Implementation (`src/api.ts` and `src/App.tsx`)

1.  **Token Storage**:
    *   After a successful login, the `handleAuthSuccess` function in `src/App.tsx` receives both the `accessToken` and `refreshToken` and stores them in the browser's `localStorage`.

2.  **Authenticated API Calls**:
    *   The `apiFetch` function in `src/api.ts` is a wrapper used for all authenticated API calls. It automatically reads the `accessToken` from `localStorage` and adds it to the `Authorization: Bearer <token>` header of every outgoing request.

3.  **Automatic Token Refresh Logic**:
    *   The core of the client-side "remember me" logic is also within `apiFetch`.
    *   If an API request fails with a `401 Unauthorized` or `403 Forbidden` status, `apiFetch` assumes the `accessToken` has expired.
    *   It then automatically calls its internal `refreshToken()` helper function.
    *   This function sends the `refreshToken` from `localStorage` to the server's `/api/refresh-token` endpoint.
    *   If successful, it replaces the old `accessToken` in `localStorage` with the new one and transparently retries the original failed API request.

4.  **Logout/Session Expiry**:
    *   If the `refreshToken()` call fails (e.g., the refresh token has expired), the `handleForcedLogout` function is triggered.
    *   This function removes both tokens from `localStorage` and reloads the page, effectively logging the user out and resetting the application state. The user will then need to log in manually.