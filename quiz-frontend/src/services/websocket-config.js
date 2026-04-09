/**
 * WebSocket configuration with secure protocol handling
 * Automatically switches between WS (HTTP) and WSS (HTTPS)
 */

/**
 * Get WebSocket URL based on current protocol
 * - If page is HTTPS → use WSS (WebSocket Secure)
 * - If page is HTTP → use WS (WebSocket)
 * - Supports custom REACT_APP_WS_URL environment variable
 */
function getWebSocketURL() {
  const customURL = process.env.REACT_APP_WS_URL;

  // If custom URL provided, use it as-is
  if (customURL) {
    return customURL;
  }

  // Auto-detect protocol
  const isSecure = window.location.protocol === "https:";
  const protocol = isSecure ? "wss" : "ws";
  const host = window.location.host; // Includes hostname:port

  // For path-based WebSocket (nginx proxy)
  // URL will be wss://domain.com/ws or ws://localhost:3000/ws
  return `${protocol}://${host}/ws`;
}

/**
 * Export configured WebSocket URL
 */
export const WS_URL = getWebSocketURL();

/**
 * WebSocket reconnection configuration
 */
export const WS_CONFIG = {
  // Connection timeout and reconnection backoff
  connectTimeout: 10000, // 10 seconds
  reconnectDelay: 3000, // Initial: 3 seconds
  maxReconnectDelay: 30000, // Maximum: 30 seconds
  reconnectAttempts: 5, // Stop after 5 failed attempts, user refresh required

  // Frame size limits (security)
  maxFrameSize: 1024 * 1024, // 1MB

  // Heartbeat configuration
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 5000, // 5 seconds to respond
};

/**
 * Log WebSocket connection info for debugging
 */
export function logWebSocketConfig() {
  const isSecure = window.location.protocol === "https:";
  console.log("[WebSocket Config]", {
    url: WS_URL,
    secure: isSecure,
    protocol: isSecure ? "WSS (Secure)" : "WS (Insecure)",
    message: isSecure
      ? "✅ Using WSS - secure WebSocket connection"
      : "⚠️ Using WS - only for development. Production MUST use HTTPS/WSS",
  });
}

// Log on module load
if (typeof window !== "undefined") {
  logWebSocketConfig();
}
