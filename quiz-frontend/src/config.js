
// Eski Hali:
// export const WS_URL = process.env.REACT_APP_WS_URL;
// export const API_URL = process.env.REACT_APP_API_URL;

// Yeni Hali:
export const WS_URL = process.env.REACT_APP_WS_URL || '/ws';
export const API_URL = process.env.REACT_APP_API_URL || '';