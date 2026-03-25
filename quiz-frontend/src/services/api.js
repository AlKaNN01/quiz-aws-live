// GameAdmin REST API ile iletişim
//const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8081';
const API_BASE = process.env.REACT_APP_API_URL || '';

export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) throw new Error('Giriş başarısız');
  return res.json();
}

export async function getActiveGame(token) {
  const res = await fetch(`${API_BASE}/api/games/active`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Aktif oyun bulunamadı');
  return res.json();
}

export async function getAllGames(token) {
  const res = await fetch(`${API_BASE}/api/games`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Oyunlar alınamadı');
  return res.json();
}

export async function createGame(token, title) {
  const res = await fetch(`${API_BASE}/api/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Oyun oluşturulamadı');
  return res.json();
}

export async function publishGame(token, gameId) {
  const res = await fetch(`${API_BASE}/api/games/${gameId}/publish`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Oyun yayına alınamadı');
  return res.json();
}

export async function deleteGame(token, gameId) {
  const res = await fetch(`${API_BASE}/api/games/${gameId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Oyun silinemedi');
}

export async function addQuestion(token, gameId, question) {
  const res = await fetch(`${API_BASE}/api/games/${gameId}/questions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(question),
  });
  if (!res.ok) throw new Error('Soru eklenemedi');
  return res.json();
}

export async function deleteQuestion(token, gameId, questionId) {
  const res = await fetch(`${API_BASE}/api/games/${gameId}/questions/${questionId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Soru silinemedi');
}
