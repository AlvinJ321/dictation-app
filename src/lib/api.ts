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
  const tokens = await getTokens();
  if (!tokens || !tokens.refreshToken) {
    console.log('No refresh token available.');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})); // Gracefully handle non-JSON error bodies
      console.error('Failed to refresh token, server responded with:', response.status, errorData);
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    const newTokens = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || tokens.refreshToken, // Use new refresh token if provided (rotation)
    };
    await setTokens(newTokens);
    console.log('Token refreshed successfully.');
    return data.accessToken;
  } catch (error) {
    console.error('Could not refresh token due to a network or parsing error:', error);
    // If refreshing fails, the user needs to be logged out.
    handleForcedLogout();
    return null;
  }
}

async function apiFetch(url: string, options: RequestInit = {}) {
  const tokens = await getTokens();
  let accessToken = tokens ? tokens.accessToken : null;

  const headers = new Headers(options.headers || {});
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (!headers.has('Content-Type') && options.body) {
      headers.set('Content-Type', 'application/json');
  }

  let response = await fetch(`${API_BASE_URL}/api${url}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    console.log(`Initial request to ${url} failed with ${response.status}. Attempting to refresh token.`);
    const newAccessToken = await refreshToken();

    if (newAccessToken) {
      console.log(`Token refreshed. Retrying request to ${url}.`);
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      // Retry the request with the new token
      try {
        response = await fetch(`${API_BASE_URL}/api${url}`, {
          ...options,
          headers,
        });

        if (!response.ok) {
            console.error(`Retried request to ${url} failed with status: ${response.status}`);
        }
      } catch (error) {
          console.error(`Retried request to ${url} failed with a network error:`, error);
          // To ensure we don't return a malformed response object, we can return the original error response
          // or construct a new error response. Returning the original is simpler.
          return response; // Return the original 401/403 response
      }
    } else {
        console.log('Refresh token was not available or refresh failed. Not retrying request.');
        // If refresh failed, the refreshToken function already handled the logout.
        // We return the original failed response to prevent the calling code from processing further.
        return response;
    }
  }

  return response;
}

export default apiFetch; 