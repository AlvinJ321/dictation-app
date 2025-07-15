import { getTokens, setTokens, clearTokens } from './store';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

if (!API_BASE_URL) {
  throw new Error(
    'VITE_API_BASE_URL is not defined. Please check your .env file.'
  );
}

function handleForcedLogout() {
  clearTokens();
  // Reload the page to reset the application state
  window.location.reload();
}

async function refreshToken() {
  try {
    // With httpOnly cookies, we just need to call the endpoint.
    // The browser will handle sending the refresh token cookie.
    const response = await fetch(`${API_BASE_URL}/api/refresh-token`, {
      method: 'POST',
      credentials: 'include', // IMPORTANT: Send cookies
    });

    if (!response.ok) {
      console.error('Failed to refresh token, server responded with:', response.status);
      throw new Error('Failed to refresh token');
    }
    
    // The new accessToken is set as a cookie by the server.
    // We just need to confirm success.
    console.log('Token refreshed successfully via cookie.');
    return true; // Indicate success
  } catch (error) {
    console.error('Could not refresh token due to a network or parsing error:', error);
    handleForcedLogout();
    return false; // Indicate failure
  }
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  // With httpOnly cookies, the Authorization header is no longer needed from the client.
  // The browser handles sending the auth cookie automatically.
  const fetchOptions: RequestInit = {
    ...options,
    headers,
    credentials: 'include', // IMPORTANT: This tells the browser to send cookies
  };

  let response = await fetch(`${API_BASE_URL}/api${url}`, fetchOptions);

  if (response.status === 401) {
    console.log(`Initial request to ${url} failed with 401. Attempting to refresh token.`);
    const refreshed = await refreshToken();

    if (refreshed) {
      console.log(`Token refreshed. Retrying request to ${url}.`);
      // Retry the request. The browser will automatically use the new accessToken cookie.
      response = await fetch(`${API_BASE_URL}/api${url}`, fetchOptions);
    } else {
      console.log('Refresh failed. Not retrying request.');
      // The refreshToken function already handled the logout.
    }
  }

  return response;
}

export default apiFetch; 