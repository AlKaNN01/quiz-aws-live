/*
 * Admin sayfası — Sol: Quiz Yönetimi | Sağ: Oyun Kontrolü
 * FIX 1: Inp, Btn, StatusBadge, LeaderboardTable, LogPanel component'leri AdminPage DIŞINA taşındı.
 * FIX 2: addQuestion — orderIndex artık qForm'dan değil, anlık questions.length'ten hesaplanıyor.
 * FIX 3: sorular her zaman orderIndex'e göre sıralı gösteriliyor.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import { WS_URL, API_URL as API } from '../config';

const S = {
  SETUP: 'SETUP', WAITING: 'WAITING', QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  LEADERBOARD_PENDING: 'LEADERBOARD_PENDING', SCORE_REVEAL: 'SCORE_REVEAL', FINISHED: 'FINISHED',
};

const MEDALS = ['🥇', '🥈', '🥉'];
const MEDAL_BG = ['#FFD700', '#C0C0C0', '#CD7F32'];
const OPT = { A: '#e74c3c', B: '#3498db', C: '#f39c12', D: '#2ecc71' };

function Inp({ value, onChange, placeholder, style = {} }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, width: '100%', boxSizing: 'border-box', ...style }}
    />
  );
}

function Btn({ onClick, children, color = '#555', disabled = false, small = false }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ padding: small ? '5px 10px' : '8px 16px', margin: '0 3px', background: disabled ? '#ccc' : color, color: '#fff', border: 'none', borderRadius: 8, cursor: disabled ? 'default' : 'pointer', fontSize: small ? 12 : 13, fontWeight: 600 }}>
      {children}
    </button>
  );
}

function StatusBadge({ status }) {
  const colors = { DRAFT: '#aaa', PUBLISHED: '#3498db', ACTIVE: '#2ecc71', FINISHED: '#e74c3c' };
  return (
    <span style={{ background: colors[status] || '#aaa', color: '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>
      {status}
    </span>
  );
}

function LeaderboardTable({ top10, showBan, onBan }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
      <thead>
        <tr style={{ background: '#f5f5f5' }}>
          <th style={{ padding: '8px 12px', textAlign: 'left', width: 40 }}>#</th>
          <th style={{ padding: '8px 12px', textAlign: 'left' }}>Oyuncu</th>
          <th style={{ padding: '8px 12px', textAlign: 'right', width: 80 }}>Puan</th>
          {showBan && <th style={{ padding: '8px 12px', width: 60 }}></th>}
        </tr>
      </thead>
      <tbody>
        {top10.map((p, i) => (
          <tr key={p.userId} style={{ background: i < 3 ? MEDAL_BG[i] + '33' : i % 2 === 0 ? '#fafafa' : '#fff', borderBottom: '1px solid #eee' }}>
            <td style={{ padding: '10px 12px', fontWeight: 700, fontSize: 16 }}>{MEDALS[i] || p.rank}</td>
            <td style={{ padding: '10px 12px', fontWeight: i < 3 ? 700 : 400 }}>{p.nickname || p.userId}</td>
            <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontSize: 16 }}>{p.score}</td>
            {showBan && (
              <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                <button onClick={() => onBan(p)}
                  style={{ background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                  Ban
                </button>
              </td>
            )}
          </tr>
        ))}
        {top10.length === 0 && (
          <tr><td colSpan={showBan ? 4 : 3} style={{ padding: 20, textAlign: 'center', color: '#aaa' }}>Henüz puan yok</td></tr>
        )}
      </tbody>
    </table>
  );
}

function LogPanel({ logs }) {
  return (
    <div style={{ background: '#111', color: '#0f0', padding: 10, borderRadius: 8, height: 110, overflowY: 'auto', fontSize: 11, fontFamily: 'monospace' }}>
      {logs.length === 0
        ? <span style={{ color: '#444' }}>mesaj bekleniyor...</span>
        : logs.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

export default function AdminPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';

  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);
  const [newGameTitle, setNewGameTitle] = useState('');
  const EMPTY_FORM = { text: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A', timerSeconds: 20 };
  const [qForm, setQForm] = useState(EMPTY_FORM);
  const [editingQId, setEditingQId] = useState(null);
  const [quizTab, setQuizTab] = useState('games');
  const [apiError, setApiError] = useState('');

  const [screen, setScreen] = useState(S.SETUP);
  const [joinCode, setJoinCode] = useState('');
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [question, setQuestion] = useState(null);
  const [answerCount, setAnswerCount] = useState(0);
  const [totalPlayers, setTotalPlayers] = useState(0);
  const [questionEnd, setQuestionEnd] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [autoCountdown, setAutoCountdown] = useState(30);
  const [scoreReveal, setScoreReveal] = useState(null);
  const [nextQCountdown, setNextQCountdown] = useState(0);
  const [gameFinished, setGameFinished] = useState(null);
  const [logs, setLogs] = useState([]);
  const [banConfirm, setBanConfirm] = useState(null);

  const stompRef = useRef(null);
  const autoRef  = useRef(null);
  const nextQRef = useRef(null);

  useEffect(() => { if (!token) navigate('/'); }, [token, navigate]);
  useEffect(() => { fetchGames(); }, []);

  const addLog = (msg) => setLogs(p => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p.slice(0, 49)]);

  const apiFetch = async (path, method = 'GET', body = null) => {
    const r = await fetch(`${API}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: body ? JSON.stringify(body) : null,
    });
    if (!r.ok) throw new Error(r.status);
    return r.json().catch(() => ({}));
  };

  const fetchGames = () => apiFetch('/api/games').then(setGames).catch(() => setApiError('Oyunlar yüklenemedi'));
  const fetchGame  = (id) => apiFetch(`/api/games/${id}`).then(d => { setSelectedGame(d); setQuizTab('questions'); }).catch(() => setApiError('Oyun yüklenemedi'));

  const createGame = async () => {
    if (!newGameTitle.trim()) return;
    await apiFetch('/api/games', 'POST', { title: newGameTitle.trim() }).catch(() => setApiError('Oluşturulamadı'));
    setNewGameTitle('');
    fetchGames();
  };

  const deleteGame = async (id) => {
    await apiFetch(`/api/games/${id}`, 'DELETE').catch(() => setApiError('Silinemedi'));
    if (selectedGame?.id === id) { setSelectedGame(null); setQuizTab('games'); }
    fetchGames();
  };

  const publishGame = async (id) => {
    const d = await apiFetch(`/api/games/${id}/publish`, 'POST').catch(() => setApiError('Yayınlanamadı'));
    if (d) { setSelectedGame(d); fetchGames(); }
  };

  // FIX 2: orderIndex qForm'dan gelmiyor — mevcut soru sayısı + 1 olarak hesaplanıyor.
  // Böylece edit işlemi form'u doldursa bile yeni soru eklerken sıra hiç bozulmuyor.
  const addQuestion = async () => {
    if (!selectedGame || !qForm.text.trim()) return;
    const orderIndex = (selectedGame.questions?.length || 0) + 1;
    await apiFetch(`/api/games/${selectedGame.id}/questions`, 'POST', { ...qForm, orderIndex })
      .catch(() => setApiError('Soru eklenemedi'));
    fetchGame(selectedGame.id);
    setQForm(EMPTY_FORM);
  };

  const updateQuestion = async (qId) => {
    // edit sırasında orderIndex değişmiyor — mevcut orderIndex korunuyor
    const original = selectedGame.questions.find(q => q.id === qId);
    await apiFetch(`/api/games/${selectedGame.id}/questions/${qId}`, 'PUT', {
      ...qForm,
      orderIndex: original?.orderIndex ?? qForm.orderIndex,
    }).catch(() => setApiError('Güncellenemedi'));
    fetchGame(selectedGame.id);
    setEditingQId(null);
    setQForm(EMPTY_FORM);
  };

  const deleteQuestion = (qId) => apiFetch(`/api/games/${selectedGame.id}/questions/${qId}`, 'DELETE')
    .then(() => fetchGame(selectedGame.id)).catch(() => setApiError('Silinemedi'));

  const startEdit = (q) => {
    setEditingQId(q.id);
    setQForm({ text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctAnswer: q.correctAnswer, timerSeconds: q.timerSeconds });
  };

  const handleMsg = useCallback((msg) => {
    addLog(`← ${msg.type}`);
    switch (msg.type) {
      case 'HOST_WAITING_UPDATE': setPlayerCount(msg.playerCount); break;
      case 'GAME_STARTED':
        setScreen(S.QUESTION_ACTIVE); setQuestion(null); setAnswerCount(0);
        break;
      case 'QUESTION_START':
        setQuestion({ id: msg.questionId, index: msg.questionIndex, total: msg.totalQuestions, text: msg.questionText, options: msg.options, timer: msg.timerSeconds });
        setTotalPlayers(msg.totalPlayers || 0); setAnswerCount(0); setQuestionEnd(null);
        setScreen(S.QUESTION_ACTIVE);
        break;
      case 'HOST_ANSWER_COUNT':
        setAnswerCount(msg.answeredCount); setTotalPlayers(msg.totalPlayers);
        break;
      case 'QUESTION_END':
        setQuestionEnd({ correct: msg.correctAnswer, dist: msg.answerDistribution, total: msg.totalAnswered, players: msg.totalPlayers });
        break;
      case 'LEADERBOARD_PENDING':
        setLeaderboard({ questionId: msg.questionId, top10: msg.top10, autoPublishAt: msg.autoPublishAt });
        setScreen(S.LEADERBOARD_PENDING);
        clearInterval(autoRef.current);
        autoRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((msg.autoPublishAt - Date.now()) / 1000));
          setAutoCountdown(left);
          if (left === 0) clearInterval(autoRef.current);
        }, 200);
        break;
      case 'SCORE_REVEAL':
        setScoreReveal({ top10: msg.top10, nextQuestionAt: msg.nextQuestionAt });
        setScreen(S.SCORE_REVEAL);
        if (msg.nextQuestionAt > 0) {
          clearInterval(nextQRef.current);
          nextQRef.current = setInterval(() => {
            const left = Math.max(0, Math.ceil((msg.nextQuestionAt - Date.now()) / 1000));
            setNextQCountdown(left);
            if (left === 0) clearInterval(nextQRef.current);
          }, 200);
        }
        break;
      case 'GAME_FINISHED':
        clearInterval(autoRef.current); clearInterval(nextQRef.current);
        setGameFinished(msg.top5); setScreen(S.FINISHED);
        break;
      default: break;
    }
  }, []);

  const connectWS = () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true); addLog('Bağlandı');
        client.subscribe('/user/queue/admin', m => handleMsg(JSON.parse(m.body)));
        client.subscribe(`/topic/game/${code}/host`, m => handleMsg(JSON.parse(m.body)));
        client.subscribe(`/topic/game/${code}`, m => handleMsg(JSON.parse(m.body)));
        setScreen(S.WAITING);
      },
      onDisconnect: () => { setConnected(false); addLog('Bağlantı kesildi'); },
      onStompError: (f) => addLog(`HATA: ${f.headers?.message || 'stomp error'}`),
    });
    client.activate();
    stompRef.current = client;
  };

  const wsSend = (dest, body) => stompRef.current?.publish({
    destination: `/app/${dest}`,
    body: JSON.stringify({ ...body, adminToken: token }),
  });

  const startGame          = () => { wsSend('admin.start', { joinCode: joinCode.toUpperCase() }); addLog('Oyun başlatıldı'); };
  const endQuestion        = () => { wsSend('admin.end.question', { joinCode: joinCode.toUpperCase() }); addLog('Soru bitirildi'); };
  const approveLeaderboard = () => {
    if (!leaderboard) return;
    wsSend('admin.leaderboard.approve', { gameId: joinCode.toUpperCase(), questionId: leaderboard.questionId });
    clearInterval(autoRef.current); addLog('Leaderboard onaylandı');
  };
  const finishGame = () => { wsSend('admin.finish', { joinCode: joinCode.toUpperCase() }); addLog('Oyun bitirildi'); };

  const requestBan = (player) => setBanConfirm(player);
  const confirmBan = () => {
    if (!banConfirm) return;
    wsSend('admin.ban', {
      gameId: joinCode.toUpperCase(),
      sessionId: banConfirm.sessionId || '',
      userId: banConfirm.userId || '',
      reason: 'Admin ban',
    });
    addLog(`Ban: ${banConfirm.nickname || banConfirm.userId}`);
    if (leaderboard) setLeaderboard(lb => ({ ...lb, top10: lb.top10.filter(p => p.userId !== banConfirm.userId) }));
    if (scoreReveal) setScoreReveal(sr => ({ ...sr, top10: sr.top10.filter(p => p.userId !== banConfirm.userId) }));
    setBanConfirm(null);
  };

  useEffect(() => () => {
    clearInterval(autoRef.current); clearInterval(nextQRef.current);
    stompRef.current?.deactivate();
  }, []);

  // FIX 3: Sorular her zaman orderIndex'e göre sıralı gösteriliyor
  const sortedQuestions = selectedGame?.questions
    ? [...selectedGame.questions].sort((a, b) => a.orderIndex - b.orderIndex)
    : [];

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', display: 'flex', height: '100vh', overflow: 'hidden', background: '#f0f2f5' }}>

      {banConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: 28, width: 340, boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 12px', color: '#e74c3c' }}>🚫 Oyuncu Banla</h3>
            <p style={{ margin: '0 0 20px', fontSize: 15, lineHeight: 1.5 }}>
              <strong>{banConfirm.nickname || banConfirm.userId}</strong> adlı oyuncuyu banlamak istediğine emin misin?<br />
              <span style={{ color: '#888', fontSize: 13 }}>Bu işlem geri alınamaz. Oyuncu bağlantısı kesilecek.</span>
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Btn onClick={() => setBanConfirm(null)} color="#888">İptal</Btn>
              <Btn onClick={confirmBan} color="#e74c3c">Evet, Banla</Btn>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SOL PANEL ═══ */}
      <div style={{ width: 420, background: '#fff', borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', background: '#1a1a2e', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>📚 Quiz Yönetimi</span>
          <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }}
            style={{ background: 'transparent', border: '1px solid #555', color: '#aaa', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>Çıkış</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          {['games', 'questions'].map(tab => (
            <button key={tab} onClick={() => setQuizTab(tab)}
              style={{ flex: 1, padding: '10px 0', background: quizTab === tab ? '#f5f0ff' : '#fff', border: 'none', borderBottom: quizTab === tab ? '2px solid #7c3aed' : '2px solid transparent', cursor: 'pointer', fontSize: 13, fontWeight: quizTab === tab ? 700 : 400, color: quizTab === tab ? '#7c3aed' : '#666' }}>
              {tab === 'games' ? '🎮 Oyunlar' : `❓ Sorular${selectedGame ? ` (${selectedGame.title})` : ''}`}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {apiError && (
            <div style={{ background: '#fff0f0', border: '1px solid #fcc', padding: '8px 12px', borderRadius: 8, marginBottom: 10, fontSize: 13, color: '#c00', display: 'flex', justifyContent: 'space-between' }}>
              ⚠ {apiError}
              <button onClick={() => setApiError('')} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
          )}

          {quizTab === 'games' && (
            <>
              <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                <Inp value={newGameTitle} onChange={setNewGameTitle} placeholder="Yeni oyun adı..." />
                <Btn onClick={createGame} color="#7c3aed">+ Oluştur</Btn>
              </div>
              {games.length === 0 && <p style={{ color: '#aaa', textAlign: 'center', marginTop: 30 }}>Henüz oyun yok</p>}
              {games.map(g => (
                <div key={g.id} style={{ background: '#f9f9f9', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <strong style={{ fontSize: 15 }}>{g.title}</strong>
                    <StatusBadge status={g.status} />
                  </div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
                    {g.joinCode ? <span>Kod: <strong style={{ letterSpacing: '0.1em' }}>{g.joinCode}</strong></span> : <span>Yayınlanmamış</span>}
                    {' · '}{g.questions?.length || 0} soru
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Btn onClick={() => fetchGame(g.id)} color="#3498db" small>Soruları Düzenle</Btn>
                    {g.status === 'DRAFT' && <Btn onClick={() => publishGame(g.id)} color="#2ecc71" small>▶ Yayınla</Btn>}
                    {g.joinCode && <Btn onClick={() => { setJoinCode(g.joinCode); setQuizTab('games'); }} color="#FF9900" small>🎮 Oyunu Başlat</Btn>}
                    <Btn onClick={() => deleteGame(g.id)} color="#e74c3c" small>Sil</Btn>
                  </div>
                </div>
              ))}
            </>
          )}

          {quizTab === 'questions' && selectedGame && (
            <>
              <button onClick={() => setQuizTab('games')} style={{ background: 'none', border: 'none', color: '#7c3aed', cursor: 'pointer', fontSize: 13, marginBottom: 10, padding: 0 }}>← Oyunlara Dön</button>
              <div style={{ background: '#f5f0ff', border: '1px solid #d0b0ff', borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <strong style={{ fontSize: 14 }}>{editingQId ? '✏️ Düzenle' : '+ Yeni Soru'}</strong>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  <textarea value={qForm.text} onChange={e => setQForm(f => ({ ...f, text: e.target.value }))}
                    placeholder="Soru metni..." rows={2}
                    style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                  {['A', 'B', 'C', 'D'].map(k => (
                    <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, fontWeight: 700, color: OPT[k] }}>{k}</span>
                      <Inp value={qForm[`option${k}`]} onChange={v => setQForm(f => ({ ...f, [`option${k}`]: v }))}
                        placeholder={`Şık ${k}`} style={{ borderLeft: `3px solid ${OPT[k]}` }} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                    <label style={{ fontSize: 13 }}>✅ Doğru:
                      <select value={qForm.correctAnswer} onChange={e => setQForm(f => ({ ...f, correctAnswer: e.target.value }))}
                        style={{ marginLeft: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #ddd', background: OPT[qForm.correctAnswer], color: '#fff', fontWeight: 700 }}>
                        {['A', 'B', 'C', 'D'].map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </label>
                    <label style={{ fontSize: 13 }}>⏱ Süre:
                      <select value={qForm.timerSeconds} onChange={e => setQForm(f => ({ ...f, timerSeconds: Number(e.target.value) }))}
                        style={{ marginLeft: 6, padding: '5px 8px', borderRadius: 6, border: '1px solid #ddd' }}>
                        {[10, 15, 20, 30, 45, 60].map(t => <option key={t} value={t}>{t}s</option>)}
                      </select>
                    </label>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {editingQId
                      ? <>
                          <Btn onClick={() => updateQuestion(editingQId)} color="#2ecc71">💾 Kaydet</Btn>
                          <Btn onClick={() => { setEditingQId(null); setQForm(EMPTY_FORM); }} color="#888">İptal</Btn>
                        </>
                      : <Btn onClick={addQuestion} color="#7c3aed">+ Ekle</Btn>}
                  </div>
                </div>
              </div>

              {sortedQuestions.length === 0
                ? <p style={{ color: '#aaa', textAlign: 'center' }}>Henüz soru yok</p>
                : sortedQuestions.map((q, i) => (
                  <div key={q.id} style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '12px 14px', marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ margin: 0, fontSize: 14, flex: 1, marginRight: 8 }}><strong>{i + 1}.</strong> {q.text}</p>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Btn onClick={() => startEdit(q)} color="#3498db" small>✏️</Btn>
                        <Btn onClick={() => deleteQuestion(q.id)} color="#e74c3c" small>🗑</Btn>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
                      {['A', 'B', 'C', 'D'].map(k => (
                        <span key={k} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 6, background: k === q.correctAnswer ? OPT[k] : '#f0f0f0', color: k === q.correctAnswer ? '#fff' : '#555' }}>
                          {k}) {q[`option${k}`]}
                        </span>
                      ))}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 11, color: '#aaa' }}>⏱ {q.timerSeconds}s</div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>

      {/* ═══ SAĞ PANEL ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#2d2063', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>
            🎮 Oyun Kontrolü
            {joinCode && <span style={{ color: '#f39c12', marginLeft: 8, letterSpacing: '0.1em' }}>{joinCode.toUpperCase()}</span>}
          </span>
          <span style={{ fontSize: 13, color: connected ? '#2ecc71' : '#e74c3c' }}>{connected ? '● Bağlı' : '○ Bağlı Değil'}</span>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>

          {screen === S.SETUP && (
            <div style={{ maxWidth: 420 }}>
              <p style={{ color: '#666', fontSize: 14 }}>Oyun kodunu gir. Sol panelden "🎮 Oyunu Başlat"a basarak da otomatik doldurabilirsin.</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <Inp value={joinCode} onChange={v => setJoinCode(v.toUpperCase())} placeholder="Oyun Kodu (örn: 216B87)"
                  style={{ fontSize: 20, letterSpacing: '0.1em', textTransform: 'uppercase' }} />
                <Btn onClick={connectWS} color="#2d2063">▶ Bağlan</Btn>
              </div>
            </div>
          )}

          {screen === S.WAITING && (
            <div>
              <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, textAlign: 'center', flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
                  <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Bağlı Oyuncu</p>
                  <p style={{ margin: 0, fontSize: 52, fontWeight: 700 }}>{playerCount}</p>
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, flex: 1, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                  <Btn onClick={startGame} color="#2ecc71" disabled={playerCount === 0}>▶ Oyunu Başlat</Btn>
                  <Btn onClick={() => setScreen(S.SETUP)} color="#888">← Farklı Oyun</Btn>
                </div>
              </div>
              <LogPanel logs={logs} />
            </div>
          )}

          {screen === S.QUESTION_ACTIVE && (
            <div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Btn onClick={endQuestion} color="#f39c12">⏭ Soruyu Bitir</Btn>
                <Btn onClick={finishGame} color="#e74c3c">⏹ Oyunu Bitir</Btn>
              </div>
              {question ? (
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                  <p style={{ color: '#888', margin: '0 0 8px', fontSize: 13 }}>Soru {question.index + 1}/{question.total} · ⏱ {question.timer}s</p>
                  <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>{question.text}</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {Object.entries(question.options).map(([k, v]) => (
                      <div key={k} style={{ background: OPT[k] + '22', border: `2px solid ${OPT[k]}`, padding: '10px 14px', borderRadius: 8, fontSize: 14 }}>
                        <strong style={{ color: OPT[k] }}>{k})</strong> {v}
                      </div>
                    ))}
                  </div>
                  <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 14 }}>
                      <span>Cevaplayan</span><strong>{answerCount} / {totalPlayers}</strong>
                    </div>
                    <div style={{ background: '#ddd', borderRadius: 4, height: 12 }}>
                      <div style={{ background: '#2ecc71', height: '100%', borderRadius: 4, transition: 'width 0.3s', width: totalPlayers > 0 ? `${(answerCount / totalPlayers) * 100}%` : '0%' }} />
                    </div>
                  </div>
                  {questionEnd && (
                    <div style={{ marginTop: 12, background: '#f0fff0', padding: 12, borderRadius: 8, fontSize: 14 }}>
                      ✅ Doğru: <strong style={{ color: OPT[questionEnd.correct], fontSize: 20 }}>{questionEnd.correct}</strong>
                      {' · '}{questionEnd.total}/{questionEnd.players} cevapladı
                    </div>
                  )}
                </div>
              ) : <p style={{ color: '#aaa' }}>Soru yükleniyor...</p>}
              <LogPanel logs={logs} />
            </div>
          )}

          {screen === S.LEADERBOARD_PENDING && leaderboard && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>🏆 Leaderboard — Onay Bekliyor</h2>
                <div style={{ background: autoCountdown <= 5 ? '#e74c3c' : '#f39c12', color: '#fff', padding: '8px 18px', borderRadius: 12, textAlign: 'center', minWidth: 80 }}>
                  <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{autoCountdown}s</div>
                  <div style={{ fontSize: 11, marginTop: 2 }}>otomatik</div>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <LeaderboardTable top10={leaderboard.top10} showBan={true} onBan={requestBan} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                <Btn onClick={approveLeaderboard} color="#2ecc71">✓ Onayla ve Devam Et</Btn>
                <Btn onClick={finishGame} color="#e74c3c">⏹ Oyunu Bitir</Btn>
              </div>
              <LogPanel logs={logs} />
            </div>
          )}

          {screen === S.SCORE_REVEAL && scoreReveal && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h2 style={{ margin: 0 }}>📊 Puanlar Yayınlandı</h2>
                {scoreReveal.nextQuestionAt > 0 && (
                  <span style={{ background: '#3498db', color: '#fff', padding: '8px 18px', borderRadius: 20, fontSize: 15, fontWeight: 700 }}>
                    Sonraki soru: {nextQCountdown}s
                  </span>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 16 }}>
                <LeaderboardTable top10={scoreReveal.top10} showBan={true} onBan={requestBan} />
              </div>
              <LogPanel logs={logs} />
            </div>
          )}

          {screen === S.FINISHED && (
            <div>
              <h1 style={{ marginBottom: 20 }}>🎉 Oyun Bitti!</h1>
              <div style={{ background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', marginBottom: 20 }}>
                <LeaderboardTable top10={gameFinished || []} showBan={false} onBan={() => {}} />
              </div>
              <Btn onClick={() => { setScreen(S.SETUP); setGameFinished(null); setConnected(false); stompRef.current?.deactivate(); }} color="#3498db">
                🔄 Yeni Oyun
              </Btn>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}