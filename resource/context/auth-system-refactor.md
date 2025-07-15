# Auth System Refactor: From Bearer Tokens to Cookies

This document details the significant architectural change made to the application's authentication system, moving from a `localStorage`-based Bearer Token implementation to a more secure and robust `httpOnly` cookie-based system.

---

## The "Before" System: Bearer Tokens

The original system was a classic token-based approach common in many single-page applications.

*   **Core Concept:** After a successful login, the server would send back an `accessToken` and a `refreshToken`. The frontend was responsible for storing these tokens (in `localStorage`) and manually adding the `accessToken` to every API request.

### How It Worked

**1. Login (`/api/verify`):**
*   **Server:** Would return a JSON response containing the tokens.
    ```json
    { "accessToken": "...", "refreshToken": "..." }
    ```
*   **Client (`App.tsx`):** The `handleAuthSuccess` function would manually store these tokens.
    ```javascript
    // BEFORE
    const handleAuthSuccess = (data) => {
      localStorage.setItem('accessToken', data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      // ...
    };
    ```

**2. Authenticated API Calls (`api.ts`):**
*   **Client:** For every API call, the `apiFetch` function would manually retrieve the token from `localStorage` and add it to the `Authorization` header.
    ```javascript
    // BEFORE
    async function apiFetch(url, options = {}) {
      let accessToken = localStorage.getItem('accessToken');
      const headers = new Headers(options.headers || {});
      if (accessToken) {
        headers.set('Authorization', `Bearer ${accessToken}`);
      }
      // ...
    }
    ```

**3. Token Refresh (`api.ts`):**
*   **Client:** If an API call failed with a `401 Unauthorized` error, the `apiFetch` function would call a separate `refreshToken` function. This function would send the `refreshToken` to the `/api/refresh-token` endpoint to get a new `accessToken`, store it, and then retry the original request.

**4. Download Button (`App.tsx`):**
*   **Problem:** A simple `window.open('/api/download/mac')` would not work because the browser doesn't automatically add the `Authorization` header from `localStorage`.
*   **Workaround:** The code used a complex and fragile workaround:
    1.  Use `fetch` to make the authenticated request.
    2.  Receive the entire 210MB DMG file as a binary "blob" in JavaScript memory.
    3.  Create a temporary URL for this in-memory blob.
    4.  Programmatically create a link (`<a>`) element, assign the temporary URL to it, and simulate a click to trigger the download.

### Drawbacks of the Bearer Token System

*   **Security Risk:** Storing tokens in `localStorage` makes them vulnerable to Cross-Site Scripting (XSS) attacks. Malicious scripts on the page could steal the tokens.
*   **Complexity:** The frontend code was complex. It had to manually handle token storage, header creation, and a complicated token refresh-and-retry logic.
*   **Fragility:** The download logic was inefficient (loading a huge file into browser memory) and prone to silent failures.

---

## The "After" System: `httpOnly` Cookies

The new system delegates almost all authentication management to the browser, which is what cookies were designed for. It is simpler, more secure, and more reliable.

*   **Core Concept:** After a successful login, the server sets two `httpOnly` cookies: an `accessToken` and a `refreshToken`. The browser then automatically and securely sends the `accessToken` with every subsequent API request.

### How It Works

**1. Login (`/api/verify`):**
*   **Server (`server.js`):** The server now sets cookies directly on the response. The frontend no longer receives tokens in the JSON body.
    ```javascript
    // AFTER
    res.cookie('accessToken', accessToken, {
      httpOnly: true, // Not accessible by JavaScript
      secure: false,  // Set to true with HTTPS
      path: '/',
    });
    res.cookie('refreshToken', refreshToken, { ... });
    ```
*   **Client (`App.tsx`):** The success handler is now much simpler. It no longer needs to touch tokens.
    ```javascript
    // AFTER
    const handleAuthSuccess = (data) => {
      // No token management needed
      setIsAuthenticated(true);
      // ...
    };
    ```

**2. Authenticated API Calls (`api.ts`):**
*   **Client:** The `apiFetch` function is now much cleaner. It simply needs to tell the browser to include cookies with the request. The browser handles the rest.
    ```javascript
    // AFTER
    async function apiFetch(url, options = {}) {
      const fetchOptions = {
        ...options,
        credentials: 'include', // Tell browser to send cookies
      };
      let response = await fetch(API_BASE_URL + url, fetchOptions);
      // ...
    }
    ```

**3. Token Refresh (`api.ts`):**
*   **Client:** If an API call fails with `401 Unauthorized`, the `apiFetch` function still attempts to refresh the token. However, the logic is simpler. It makes one call to `/api/refresh-token`, and if that succeeds, the new `accessToken` cookie is automatically set by the server. The original request is then retried.

**4. Download Button (`App.tsx`):**
*   **Solution:** This is now incredibly simple and robust.
    ```javascript
    // AFTER
    const handleDownloadClick = (os) => {
      if (os === 'mac') {
        window.open('/api/download/mac', '_blank');
      }
    };
    ```
    Because the browser automatically sends the authentication cookie with this navigation request, the server recognizes the user as authenticated and serves the file directly.

### Benefits of the Cookie-Based System

*   **Enhanced Security:** `httpOnly` cookies cannot be accessed by client-side JavaScript, which effectively mitigates XSS attacks against the tokens.
*   **Simplicity & Reliability:** The frontend code is dramatically simpler. It no longer contains complex logic for token storage, refresh, or manual header creation. This makes the code easier to maintain and far less prone to bugs.
*   **Robust Downloads:** The file download now uses a standard browser mechanism, which is efficient and reliable. 