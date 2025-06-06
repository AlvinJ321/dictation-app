# Web Project Authentication Flow Documentation

This document outlines the authentication mechanism implemented in the Voco-web-portal project. It serves as a reference for implementing a compatible authentication flow in the desktop application.

## 1. Overview

The authentication system is based on **Phone Number + OTP (One-Time Password)** and uses **JSON Web Tokens (JWT)** for session management.

-   **Backend:** Node.js with Express.
-   **Database:** Sequelize with a User model.
-   **JWTs:** A short-lived `accessToken` and a long-lived `refreshToken`.
-   **OTP Provider:** Aliyun SMS service.

## 2. Authentication Endpoints

The core logic is exposed via the following REST API endpoints:

### `POST /api/send-verification-code`

-   **Purpose:** To initiate the login or sign-up process by sending an OTP to the user's phone.
-   **Request Body:**
    ```json
    {
      "phoneNumber": "12345678900"
    }
    ```
-   **Process:**
    1.  Receives a phone number.
    2.  Generates a 6-digit verification code.
    3.  Finds a user with that phone number or creates a new user entry if one doesn't exist.
    4.  Saves the hashed verification code and a 10-minute expiry timestamp to the user's record in the database.
    5.  Uses the Aliyun SMS API to send the code to the user.
-   **Response:** A success message indicating the code has been sent.

### `POST /api/login` (or `POST /api/signup`)

-   **Purpose:** To verify the OTP and log the user in. The `signup` route additionally allows setting a `userName`.
-   **Request Body:**
    ```json
    {
      "phoneNumber": "12345678900",
      "verificationCode": "123456"
    }
    ```
-   **Process:**
    1.  Finds the user by `phoneNumber`.
    2.  Compares the provided `verificationCode` with the one stored in the database.
    3.  Checks if the code has expired.
    4.  If verification is successful, it nullifies the code in the database.
    5.  Generates two tokens:
        -   `accessToken`: A standard JWT containing `userId` and `phoneNumber`, with a short expiry (e.g., 15 minutes).
        -   `refreshToken`: A secure, random string with a long expiry (e.g., 7 days), stored in the database.
-   **Response:**
    ```json
    {
      "message": "User logged in successfully.",
      "accessToken": "...",
      "refreshToken": "...",
      "userId": 1,
      "userName": "John Doe"
    }
    ```

### `POST /api/refresh-token`

-   **Purpose:** To get a new `accessToken` without requiring the user to log in again.
-   **Request Body:**
    ```json
    {
      "refreshToken": "..."
    }
    ```
-   **Process:**
    1.  Finds the user associated with the provided `refreshToken`.
    2.  Checks if the token is expired.
    3.  If valid, it issues a new `accessToken`.
-   **Response:**
    ```json
    {
      "accessToken": "..."
    }
    ```

### `POST /api/logout`

-   **Purpose:** To invalidate the user's session.
-   **Request Body:**
    ```json
    {
      "refreshToken": "..."
    }
    ```
-   **Process:**
    1.  Finds the user by `refreshToken`.
    2.  Nullifies the `refreshToken` and its expiry date in the database, effectively logging the user out.
-   **Response:** A success message.

## 3. Frontend Implementation (Desktop App)

The desktop application should follow this flow:

1.  **Sign-In Screen:**
    -   Display input fields for `Phone Number` and `OTP`.
    -   A "Send Code" button calls `/api/send-verification-code`.
    -   A "Sign In" button calls `/api/login`.

2.  **Token Storage:**
    -   Upon successful login, securely store the `accessToken` and `refreshToken`. For Electron, the `electron-store` or `node-keytar` for more secure storage (like macOS Keychain) is recommended.

3.  **Authenticated Requests:**
    -   For all subsequent API calls to protected resources, include the `accessToken` in the `Authorization` header: `Authorization: Bearer <accessToken>`.

4.  **Token Refresh Logic:**
    -   Before making an API call, check if the `accessToken` is expired.
    -   If it is expired, call `/api/refresh-token` with the stored `refreshToken`.
    -   Replace the old `accessToken` with the new one.
    -   If the `refreshToken` is also expired, the user must be prompted to log in again. This can be handled globally using an Axios interceptor or similar middleware.

5.  **Logout:**
    -   When the user logs out, call `/api/logout` with the `refreshToken`.
    -   Clear the stored tokens from the local storage.
    -   Redirect the user to the sign-in screen. 