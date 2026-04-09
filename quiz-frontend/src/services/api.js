// Environment'a göre API base URL belirle
// Production'da: REACT_APP_API_URL env variable'dan oku (build zamanında)
// Development'da: Same origin veya localhost:8081
const API_BASE =
  process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === "production"
    ? window.location.origin
    : "http://localhost:8081");

/**
 * Enhanced error handler for API responses
 * Parses error details from server response and returns user-friendly message
 */
async function handleApiError(res, defaultMessage) {
  let errorMessage = defaultMessage;
  let errorDetails = null;

  try {
    const errorBody = await res.json();
    errorDetails = errorBody;

    // Try to get detailed error message from server response
    if (errorBody.message) {
      errorMessage = errorBody.message;
    } else if (errorBody.error) {
      errorMessage = errorBody.error;
    }
  } catch (e) {
    // Response is not JSON, use status text
    errorMessage = res.statusText || defaultMessage;
  }

  // Log detailed error info for debugging
  console.error(`API Error [${res.status}]:`, {
    url: res.url,
    status: res.status,
    message: errorMessage,
    details: errorDetails,
  });

  const error = new Error(errorMessage);
  error.status = res.status;
  error.details = errorDetails;
  throw error;
}

export async function login(username, password) {
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) await handleApiError(res, "Giriş başarısız");
    return res.json();
  } catch (error) {
    console.error("Login error:", error);
    throw error;
  }
}

export async function getActiveGame(token) {
  try {
    const res = await fetch(`${API_BASE}/api/games/active`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) await handleApiError(res, "Aktif oyun bulunamadı");
    return res.json();
  } catch (error) {
    console.error("Get active game error:", error);
    throw error;
  }
}

export async function getAllGames(token) {
  try {
    const res = await fetch(`${API_BASE}/api/games`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) await handleApiError(res, "Oyunlar alınamadı");
    return res.json();
  } catch (error) {
    console.error("Get all games error:", error);
    throw error;
  }
}

export async function createGame(token, title) {
  try {
    const res = await fetch(`${API_BASE}/api/games`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) await handleApiError(res, "Oyun oluşturulamadı");
    return res.json();
  } catch (error) {
    console.error("Create game error:", error);
    throw error;
  }
}

export async function publishGame(token, gameId) {
  try {
    const res = await fetch(`${API_BASE}/api/games/${gameId}/publish`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) await handleApiError(res, "Oyun yayına alınamadı");
    return res.json();
  } catch (error) {
    console.error("Publish game error:", error);
    throw error;
  }
}

export async function deleteGame(token, gameId) {
  try {
    const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) await handleApiError(res, "Oyun silinemedi");
  } catch (error) {
    console.error("Delete game error:", error);
    throw error;
  }
}

export async function addQuestion(token, gameId, question) {
  try {
    const res = await fetch(`${API_BASE}/api/games/${gameId}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(question),
    });
    if (!res.ok) await handleApiError(res, "Soru eklenemedi");
    return res.json();
  } catch (error) {
    console.error("Add question error:", error);
    throw error;
  }
}

export async function deleteQuestion(token, gameId, questionId) {
  try {
    const res = await fetch(
      `${API_BASE}/api/games/${gameId}/questions/${questionId}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) await handleApiError(res, "Soru silinemedi");
  } catch (error) {
    console.error("Delete question error:", error);
    throw error;
  }
}
