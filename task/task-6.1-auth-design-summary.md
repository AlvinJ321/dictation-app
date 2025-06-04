# Summary of Task 6.1: Authentication Design & Flow Definition

This document summarizes the design and flow definitions for user authentication, as discussed prior to the task list reordering. This corresponds to **Task 6.1** in the revised `task-list.md`.

## 6.1.1. Define user journey for sign-up (web) -> Download -> App Sign-in.

The user journey is envisioned in three main phases:

*   **Phase 1: Web Sign-Up & Download:**
    1.  **Website Visit & Download Intent:** User lands on the product website and clicks a "Download" call-to-action.
    2.  **Sign-Up Gate:** The user is presented with a sign-up form/modal.
        *   Primary method: Phone number with OTP verification.
        *   Optional method: WeChat login.
    3.  **Account Creation:** User completes sign-up via OTP or WeChat. The backend creates a user account.
    4.  **Download:** The application download (e.g., `.dmg` or `.exe`) starts automatically, or direct links are provided.
*   **Phase 2: Desktop App First Launch & Sign-In:**
    1.  **Installation & Launch:** User installs the downloaded application and launches it for the first time.
    2.  **Sign-In Screen:** The app displays a sign-in screen (as no local session exists).
        *   Options: Sign in with Phone + OTP, or Sign in with WeChat (if implemented).
    3.  **Authentication:** User authenticates using the same method/credentials established during the web sign-up.
    4.  **Session Establishment:** The backend issues a session token (e.g., JWT), which the desktop app stores securely (e.g., OS keychain).
    5.  **Access Granted:** User gains access to the main application functionality.
*   **Phase 3: Subsequent App Launches (Auto Sign-In):**
    1.  **App Launch:** User opens the application.
    2.  **Token Check:** The app checks for a valid, stored session token.
    3.  **Token Validation (Recommended):** The app may quickly validate the token with the backend.
    4.  **Auto Sign-In:** If the token is valid, the user is automatically signed in and sees the main app interface.
    5.  **Re-Authentication:** If no token is found, or if it's invalid/expired and cannot be refreshed, the app displays the Sign-In screen.

## 6.1.2. Detail pre-download sign-up flow on website (Phone OTP, WeChat - Optional) when user clicks download.

This flow is triggered when a user clicks the "Download" button on the website, acting as a gate.

*   **UI:** A modal or dedicated page appears for sign-up.
*   **Phone OTP Flow (Primary):**
    1.  User enters their phone number (with country code selection).
    2.  User clicks "Send OTP."
    3.  Backend requests an SMS gateway to send an OTP to the user's phone.
    4.  User enters the received OTP into the web form.
    5.  Website sends the phone number and OTP to the backend for verification.
    6.  If valid, the backend creates/links the user account.
*   **WeChat Sign-Up Flow (Optional):**
    1.  User clicks "Sign up with WeChat."
    2.  User is redirected to WeChat's OAuth authorization page.
    3.  After authorization, WeChat redirects back to a pre-configured callback URL on the application's backend, providing an authorization code.
    4.  Backend exchanges the code for user information (OpenID, UnionID, nickname, avatar) and creates/links the user account.
*   **Outcome:**
    *   Upon successful sign-up, the user is informed.
    *   The website initiates the download of the desktop application or provides clear download links.

## 6.1.3. Detail desktop app sign-in/sign-up flow (Phone OTP, WeChat - Optional) on first app launch or when logged out.

This flow occurs when the desktop application requires authentication.

*   **No Direct In-App Sign-Up:** The desktop app primarily handles sign-in. If a user needs to sign up, they are directed to the website.
*   **UI:** A dedicated sign-in screen within the Electron app.
*   **Phone OTP Sign-In Flow:**
    1.  User enters the phone number used during web sign-up.
    2.  User clicks "Send OTP."
    3.  The app requests the backend to send an OTP.
    4.  User enters the received OTP into the app.
    5.  The app sends the phone number and OTP to the backend for verification.
*   **WeChat Sign-In Flow (Optional):**
    1.  User clicks "Sign in with WeChat."
    2.  The app initiates the WeChat OAuth flow. This might involve opening the system browser to a WeChat URL or using an embedded webview. WeChat redirects to a custom URI scheme that the Electron app handles, or the backend informs the app after its callback is hit.
    3.  Backend validates the WeChat user and, if successful, communicates this to the app.
*   **Outcome:**
    *   Upon successful sign-in, the backend issues session tokens (access and refresh tokens).
    *   The desktop app securely stores these tokens (e.g., using `keytar` for OS keychain access).
    *   The user gains access to the application's main features.

## 6.1.4. Design auto sign-in mechanism for the desktop app for subsequent launches.

This mechanism relies on securely stored session tokens.

*   **Token Storage:** Access and Refresh Tokens are stored securely in the OS keychain.
*   **App Launch Sequence:**
    1.  The app attempts to retrieve the Access Token and Refresh Token from secure storage.
    2.  **Access Token Check:**
        *   If an Access Token exists, its expiry is checked locally.
        *   If not expired, the user is provisionally signed in. A background validation with the backend can be performed.
    3.  **Refresh Token Usage:**
        *   If the Access Token is missing, expired, or fails background validation, and a Refresh Token exists:
            *   The app makes a request to the backend's refresh endpoint (`/api/auth/refresh-token`) with the Refresh Token.
            *   If successful, the backend issues a new Access Token (and potentially a new Refresh Token - token rotation). These are stored, and the user is signed in.
            *   If the Refresh Token is invalid/expired, the refresh fails.
    4.  **Re-Authentication:** If no tokens are found or refresh fails, the Sign-In screen is displayed.

## 6.1.5. Outline account recovery process

Given the primary OTP-based authentication:

*   **Phone-Based Accounts:**
    *   **"Forgot Password" is not directly applicable.** Login is always via a fresh OTP.
    *   **"Resend OTP":** This is an integral part of the sign-in/sign-up flow. If an OTP is not received or expires, the user can request a new one (subject to rate limits).
    *   **Loss of Access to Phone Number:** This is a more complex scenario.
        *   Initial approach: Direct users to customer support.
        *   Future considerations (if necessary): Verified alternative email for recovery, security questions (though these have usability/security trade-offs).
*   **WeChat-Linked Accounts (If implemented):**
    *   Account recovery is largely managed by WeChat itself (i.e., the user recovers their WeChat account).
    *   If the link between the app and WeChat is severed, the user would typically re-authenticate via the WeChat login flow.
*   **General Security:**
    *   Implement rate limiting on OTP requests and verification attempts to prevent abuse.
    *   Secure handling of session tokens. 