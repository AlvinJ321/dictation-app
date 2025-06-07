export const setTokens = (tokens: { accessToken: string; refreshToken: string }) => {
  window.electron.store.setTokens(tokens);
};

export const getTokens = async () => {
  const tokens = await window.electron.store.getTokens();
  if (tokens && typeof tokens.accessToken === 'string' && typeof tokens.refreshToken === 'string') {
    return tokens;
  }
  return null;
};

export const clearTokens = () => {
  window.electron.store.clearTokens();
}; 