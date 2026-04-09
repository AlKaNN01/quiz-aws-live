/**
 * API client with network resilience, error handling, and retry logic
 * Works across browser, WiFi, 4G, 3G networks
 */

// Eski Hali:
// export const WS_URL = process.env.REACT_APP_WS_URL || '/ws';
// export const API_URL = process.env.REACT_APP_API_URL || '';

// Yeni Hali:
export const WS_URL = process.env.REACT_APP_WS_URL || "/ws";
export const API_URL = process.env.REACT_APP_API_URL || "";

// Error types
export const ErrorTypes = {
  NETWORK: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT_ERROR",
  AUTH: "AUTH_ERROR",
  NOT_FOUND: "NOT_FOUND",
  SERVER: "SERVER_ERROR",
  VALIDATION: "VALIDATION_ERROR",
  UNKNOWN: "UNKNOWN_ERROR",
};

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffMultiplier: 2,
};

/**
 * Export error types for error handling in components
 */
export class APIError extends Error {
  constructor(
    message,
    type = ErrorTypes.UNKNOWN,
    status = null,
    originalError = null,
  ) {
    super(message);
    this.name = "APIError";
    this.type = type;
    this.status = status;
    this.originalError = originalError;
    this.retryable = [408, 429, 500, 502, 503, 504].includes(status);
  }
}

/**
 * Get user-friendly error message based on error type
 */
export function getErrorMessage(error) {
  if (error instanceof APIError) {
    switch (error.type) {
      case ErrorTypes.NETWORK:
        return "İnternet bağlantınızı kontrol edin ve yeniden deneyin";
      case ErrorTypes.TIMEOUT:
        return "İstek zaman aşımına uğradı. Lütfen tekrar deneyin";
      case ErrorTypes.AUTH:
        return "Kimlik doğrulama başarısız. Lütfen yeniden giriş yapın";
      case ErrorTypes.NOT_FOUND:
        return "Aradığınız kaynak bulunamadı";
      case ErrorTypes.SERVER:
        return "Sunucu hatası. Lütfen daha sonra tekrar deneyin";
      case ErrorTypes.VALIDATION:
        return error.message || "Giriş değerleri geçersiz";
      default:
        return error.message || "Bilinmeyen bir hata oluştu";
    }
  }
  return "Bilinmeyen bir hata oluştu";
}

/**
 * Exponential backoff with jitter for retries
 */
function calculateBackoffDelay(attempt) {
  const exponentialDelay = Math.min(
    RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt),
    RETRY_CONFIG.maxDelay,
  );
  const jitter = Math.random() * 1000; // Add 0-1s randomness
  return exponentialDelay + jitter;
}

/**
 * Check if error is retryable
 */
function isRetryable(error, attempt) {
  // Network errors and timeouts are always retryable
  if (error.type === ErrorTypes.NETWORK || error.type === ErrorTypes.TIMEOUT) {
    return attempt < RETRY_CONFIG.maxRetries;
  }

  // HTTP errors: 429 (rate limit), 5xx (server errors)
  if (error.status && [408, 429, 500, 502, 503, 504].includes(error.status)) {
    return attempt < RETRY_CONFIG.maxRetries;
  }

  // Auth errors and 4xx errors are NOT retryable
  return false;
}

/**
 * Core fetch wrapper with error handling
 */
async function fetchWithRetry(url, options = {}, attempt = 0) {
  const timeout = options.timeout || 10000; // 10s default
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Success
    if (response.ok) {
      return response;
    }

    // Handle HTTP errors
    let errorType = ErrorTypes.UNKNOWN;
    let retryable = false;

    switch (response.status) {
      case 400:
        errorType = ErrorTypes.VALIDATION;
        break;
      case 401:
      case 403:
        errorType = ErrorTypes.AUTH;
        break;
      case 404:
        errorType = ErrorTypes.NOT_FOUND;
        break;
      case 408:
      case 429:
      case 500:
      case 502:
      case 503:
      case 504:
        errorType =
          response.status >= 500 ? ErrorTypes.SERVER : ErrorTypes.TIMEOUT;
        retryable = true;
        break;
      default:
        errorType = ErrorTypes.SERVER;
    }

    const error = new APIError(
      `HTTP ${response.status}: ${response.statusText}`,
      errorType,
      response.status,
    );

    // Auto-retry logic
    if (retryable && attempt < RETRY_CONFIG.maxRetries) {
      const delay = calculateBackoffDelay(attempt);
      console.warn(
        `[API] Retry attempt ${attempt + 1}/${RETRY_CONFIG.maxRetries} after ${Math.round(delay)}ms`,
        url,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return fetchWithRetry(url, options, attempt + 1);
    }

    throw error;
  } catch (err) {
    clearTimeout(timeoutId);

    // Handle AbortError (timeout)
    if (err.name === "AbortError") {
      const error = new APIError(
        "İstek zaman aşımına uğradı",
        ErrorTypes.TIMEOUT,
        408,
        err,
      );

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[API] Timeout retry ${attempt + 1}/${RETRY_CONFIG.maxRetries}`,
          url,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, attempt + 1);
      }

      throw error;
    }

    // Network errors
    if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
      const error = new APIError(
        "Ağ bağlantısı hatası",
        ErrorTypes.NETWORK,
        null,
        err,
      );

      if (attempt < RETRY_CONFIG.maxRetries) {
        const delay = calculateBackoffDelay(attempt);
        console.warn(
          `[API] Network retry ${attempt + 1}/${RETRY_CONFIG.maxRetries}`,
          url,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        return fetchWithRetry(url, options, attempt + 1);
      }

      throw error;
    }

    // Unknown error
    throw new APIError("Bilinmeyen hata", ErrorTypes.UNKNOWN, null, err);
  }
}

/**
 * Parse JSON response safely
 */
async function parseJSON(response) {
  try {
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    console.error("[API] JSON parse error:", err);
    throw new APIError("Sunucu yanıtı ayrıştırılamadı", ErrorTypes.SERVER);
  }
}

/**
 * API client wrapper
 */
async function apiCall(endpoint, options = {}) {
  const url = `${API_URL || window.location.origin}${endpoint}`;
  const mergedOptions = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };

  try {
    const response = await fetchWithRetry(url, mergedOptions);
    const data = await parseJSON(response);
    return data;
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    throw new APIError(
      "API çağrısı başarısız",
      ErrorTypes.UNKNOWN,
      null,
      error,
    );
  }
}

// ========================
// API ENDPOINTS
// ========================

export async function login(username, password) {
  try {
    return await apiCall("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  } catch (error) {
    if (error.status === 401) {
      throw new APIError(
        "Kullanıcı adı veya parola yanlış",
        ErrorTypes.AUTH,
        401,
      );
    }
    throw error;
  }
}

export async function getActiveGame(token) {
  return apiCall("/api/games/active", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getAllGames(token) {
  return apiCall("/api/games", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createGame(token, title) {
  return apiCall("/api/games", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title }),
  });
}

export async function publishGame(token, gameId) {
  return apiCall(`/api/games/${gameId}/publish`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function deleteGame(token, gameId) {
  return apiCall(`/api/games/${gameId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function addQuestion(token, gameId, question) {
  return apiCall(`/api/games/${gameId}/questions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(question),
  });
}

export async function deleteQuestion(token, gameId, questionId) {
  return apiCall(`/api/games/${gameId}/questions/${questionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
