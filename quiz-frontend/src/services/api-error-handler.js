/**
 * API Error Handler - Centralized error handling for all API requests
 * Includes retry logic with exponential backoff
 */

export class ApiErrorHandler {
  constructor(maxRetries = 3, baseDelay = 1000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.retryCount = {};
  }

  /**
   * Handle API errors with retry logic
   */
  async handleError(error, endpoint, method = "GET") {
    const requestKey = `${method}:${endpoint}`;

    // Don't retry POST/PUT/DELETE or if max retries exceeded
    if (
      method !== "GET" ||
      (this.retryCount[requestKey] || 0) >= this.maxRetries
    ) {
      return this.formatErrorResponse(error);
    }

    // Check if error is retryable (network error, 5xx, timeout)
    if (this.isRetryable(error)) {
      this.retryCount[requestKey] = (this.retryCount[requestKey] || 0) + 1;
      const delay = this.calculateBackoffDelay(this.retryCount[requestKey]);

      console.warn(
        `[API Error] Retrying ${method} ${endpoint} (attempt ${this.retryCount[requestKey]}/${this.maxRetries}) in ${delay}ms`,
      );

      await this.sleep(delay);
      return { shouldRetry: true, delay };
    }

    return this.formatErrorResponse(error);
  }

  /**
   * Determine if error is retryable
   */
  isRetryable(error) {
    // Network error
    if (!error.response) {
      return true;
    }

    const status = error.response.status;

    // Retryable status codes: 408 (Timeout), 429 (Too Many Requests), 5xx (Server Errors)
    return status === 408 || status === 429 || (status >= 500 && status < 600);
  }

  /**
   * Calculate exponential backoff delay
   */
  calculateBackoffDelay(attempt) {
    const jitter = Math.random() * 1000; // Add random jitter up to 1s
    return this.baseDelay * Math.pow(2, attempt - 1) + jitter;
  }

  /**
   * Format error for client consumption
   */
  formatErrorResponse(error) {
    if (error.response) {
      // Server responded with error
      const status = error.response.status;
      const data = error.response.data;

      return {
        success: false,
        status,
        code: data?.errorCode || `HTTP_${status}`,
        message: data?.errorDetails || this.getDefaultMessage(status),
        requestId: data?.requestId || "unknown",
        isServerError: status >= 500,
        isClientError: status >= 400 && status < 500,
        isNetworkError: false,
      };
    } else if (error.request) {
      // Request made but no response received
      return {
        success: false,
        status: 0,
        code: "NETWORK_ERROR",
        message: "Sunucuya bağlanılamıyor. İnternet bağlantınızı kontrol edin.",
        isServerError: false,
        isClientError: false,
        isNetworkError: true,
      };
    } else {
      // Request setup error
      return {
        success: false,
        status: 0,
        code: "REQUEST_ERROR",
        message: error.message || "Bilinmeyen hata oluştu",
        isServerError: false,
        isClientError: false,
        isNetworkError: false,
      };
    }
  }

  /**
   * Get user-friendly error message
   */
  getDefaultMessage(status) {
    const messages = {
      400: "Geçersiz istek",
      401: "Kimlik doğrulama gerekli",
      403: "Bu işlemi yapma izniniz yok",
      404: "İsteklenen kaynak bulunamadı",
      408: "İstek zaman aşımına uğradı",
      429: "Çok fazla istek gönderdiniz. Lütfen biraz bekleyin.",
      500: "Sunucu hatası oluştu",
      502: "Geçit hatası",
      503: "Hizmet geçici olarak kullanılamıyor",
      504: "Sunucu zaman aşımına uğradı",
    };
    return messages[status] || "Sunucu hatası";
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset retry count for endpoint
   */
  resetRetryCount(endpoint, method = "GET") {
    const requestKey = `${method}:${endpoint}`;
    delete this.retryCount[requestKey];
  }
}

export const apiErrorHandler = new ApiErrorHandler(3, 1000);
