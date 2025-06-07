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
    console.log('No refresh token available, forcing logout.');
    // No need to call handleForcedLogout here, as the caller will handle the error
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
      throw new Error('Failed to refresh token');
    }

    const data = await response.json();
    // Assuming the refresh token might be rotated as well
    if (data.refreshToken) {
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    } else {
        const currentTokens = await getTokens();
        if(currentTokens){
            setTokens({ accessToken: data.accessToken, refreshToken: currentTokens.refreshToken });
        }
    }
    return data.accessToken;
  } catch (error) {
    console.error('Could not refresh token:', error);
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
    const newAccessToken = await refreshToken();
    if (newAccessToken) {
      headers.set('Authorization', `Bearer ${newAccessToken}`);
      // Retry the request with the new token
      response = await fetch(`${API_BASE_URL}/api${url}`, {
        ...options,
        headers,
      });
    } else {
        // If refresh failed, the refreshToken function already handled the logout.
        // We return the original failed response to prevent the calling code from processing further.
        return response;
    }
  }

  return response;
}

export default apiFetch; 