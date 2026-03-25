/*
 * Host (projeksiyon) ekranı — LandingPage'den login sonrası gelir.
 * Token localStorage'dan okunur, joinCode girişi bu sayfada yapılır.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import { WS_URL } from '../config';
const optionColors = { A: '#e74c3c', B: '#3498db', C: '#f39c12', D: '#2ecc71' };
const optionBg = { A: '#c0392b', B: '#2980b9', C: '#d68910', D: '#27ae60' };

const STATES = { SETUP: 'SETUP', WAITING: 'WAITING', COUNTDOWN: 'COUNTDOWN', QUESTION: 'QUESTION', QUESTION_END: 'QUESTION_END', SCORE_REVEAL: 'SCORE_REVEAL', FINISHED: 'FINISHED' };

export default function HostPage() {
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || '';

  const [screen, setScreen] = useState(STATES.SETUP);
  const [gameId, setGameId] = useState('');
  const [connected, setConnected] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [answerCount, setAnswerCount] = useState(0);
  const [questionEnd, setQuestionEnd] = useState(null);
  const [scoreReveal, setScoreReveal] = useState(null);
  const [nextQuestionCountdown, setNextQuestionCountdown] = useState(0);
  const [gameFinished, setGameFinished] = useState(null);

  const stompClient = useRef(null);
  const timerRef = useRef(null);
  const nextQRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => { if (!token) navigate('/'); }, [token, navigate]);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case 'HOST_WAITING_UPDATE':
        setPlayerCount(msg.playerCount);
        break;
      case 'GAME_STARTED':
        setScreen(STATES.COUNTDOWN);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const left = Math.max(0, Math.ceil((msg.firstQuestionAt - Date.now()) / 1000));
          setCountdown(left);
          if (left === 0) clearInterval(countdownRef.current);
        }, 200);
        break;
      case 'QUESTION_START':
        clearInterval(countdownRef.current);
        clearInterval(timerRef.current);
        setQuestion({ questionId: msg.questionId, index: msg.questionIndex, total: msg.totalQuestions, text: msg.questionText, options: msg.options, timerSeconds: msg.timerSeconds, startedAt: msg.startedAt });
        setAnswerCount(0);
        setQuestionEnd(null);
        setTimeLeft(msg.timerSeconds);
        timerRef.current = setInterval(() => {
          const left = Math.max(0, msg.timerSeconds - Math.floor((Date.now() - msg.startedAt) / 1000));
          setTimeLeft(left);
          if (left === 0) clearInterval(timerRef.current);
        }, 200);
        setScreen(STATES.QUESTION);
        break;
      case 'HOST_ANSWER_COUNT':
        setAnswerCount(msg.answeredCount);
        break;
      case 'QUESTION_END':
        clearInterval(timerRef.current);
        setQuestionEnd({ correctAnswer: msg.correctAnswer, answerDistribution: msg.answerDistribution, totalAnswered: msg.totalAnswered, totalPlayers: msg.totalPlayers });
        setScreen(STATES.QUESTION_END);
        break;
      case 'SCORE_REVEAL':
        setScoreReveal({ top10: msg.top10, nextQuestionAt: msg.nextQuestionAt });
        if (msg.nextQuestionAt > 0) {
          clearInterval(nextQRef.current);
          nextQRef.current = setInterval(() => {
            const left = Math.max(0, Math.ceil((msg.nextQuestionAt - Date.now()) / 1000));
            setNextQuestionCountdown(left);
            if (left === 0) clearInterval(nextQRef.current);
          }, 200);
        }
        setScreen(STATES.SCORE_REVEAL);
        break;
      case 'GAME_FINISHED':
        clearInterval(timerRef.current); clearInterval(nextQRef.current); clearInterval(countdownRef.current);
        setGameFinished(msg.top5);
        setScreen(STATES.FINISHED);
        break;
      default: break;
    }
  }, []);

  const connect = () => {
    const code = gameId.trim().toUpperCase();
    if (!code) return;
    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/game/${code}/host`, (msg) => handleMessage(JSON.parse(msg.body)));
        client.subscribe(`/topic/game/${code}`, (msg) => handleMessage(JSON.parse(msg.body)));
        setScreen(STATES.WAITING);
      },
      onDisconnect: () => setConnected(false),
    });
    client.activate();
    stompClient.current = client;
  };

  useEffect(() => () => {
    clearInterval(timerRef.current); clearInterval(nextQRef.current); clearInterval(countdownRef.current);
    stompClient.current?.deactivate();
  }, []);

  const full = { fontFamily: 'monospace', minHeight: '100vh', background: '#1a1a2e', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 };

  if (screen === STATES.SETUP) return (
    <div style={{ ...full, background: '#f5f5f5', color: '#333' }}>
      <h2>🖥️ Host Ekranı</h2>
      <input value={gameId} onChange={e => setGameId(e.target.value.toUpperCase())} placeholder="Oyun Kodu"
        style={{ padding: 14, fontSize: 24, textAlign: 'center', marginBottom: 14, borderRadius: 10, border: '2px solid #ccc', width: 220, letterSpacing: '0.1em' }} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={connect} style={{ padding: '12px 24px', fontSize: 17, background: '#FF9900', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Bağlan</button>
        <button onClick={() => navigate('/')} style={{ padding: '12px 24px', fontSize: 17, background: '#888', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>← Geri</button>
      </div>
    </div>
  );

  if (screen === STATES.WAITING) return (
    <div style={full}>
      <h1 style={{ fontSize: 44, margin: 0 }}>☁️ AWS Cloud Club Quiz</h1>
      <p style={{ fontSize: 22, color: '#aaa', marginTop: 8 }}>Katılmak için kodu gir:</p>
      <div style={{ fontSize: 88, fontWeight: 'bold', letterSpacing: 14, color: '#FF9900', margin: '16px 0' }}>{gameId}</div>
      <div style={{ width: 140, height: 140, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', borderRadius: 10, marginBottom: 24, fontSize: 14 }}>QR Kod</div>
      <p style={{ fontSize: 30 }}>👥 <strong>{playerCount}</strong> oyuncu</p>
      <p style={{ color: connected ? '#2ecc71' : '#e74c3c', fontSize: 14 }}>{connected ? '● Bağlı' : '○ Bağlanıyor...'}</p>
    </div>
  );

  if (screen === STATES.COUNTDOWN) return (
    <div style={full}>
      <h2 style={{ fontSize: 34, color: '#aaa' }}>Oyun Başlıyor!</h2>
      <div style={{ fontSize: 160, fontWeight: 'bold', color: '#e74c3c', lineHeight: 1 }}>{countdown}</div>
    </div>
  );

  if (screen === STATES.QUESTION && question) return (
    <div style={{ ...full, justifyContent: 'flex-start', paddingTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 900, marginBottom: 12 }}>
        <span style={{ fontSize: 17, color: '#aaa' }}>Soru {question.index + 1}/{question.total}</span>
        <span style={{ fontSize: 38, fontWeight: 'bold', color: timeLeft <= 5 ? '#e74c3c' : timeLeft <= 10 ? '#f39c12' : '#fff' }}>⏱ {timeLeft}s</span>
        <span style={{ fontSize: 17, color: '#aaa' }}>👥 {answerCount} cevapladı</span>
      </div>
      <div style={{ background: '#333', borderRadius: 4, height: 10, width: '100%', maxWidth: 900, marginBottom: 28 }}>
        <div style={{ background: timeLeft <= 5 ? '#e74c3c' : '#3498db', width: `${(timeLeft / question.timerSeconds) * 100}%`, height: '100%', borderRadius: 4, transition: 'width 0.2s' }} />
      </div>
      <h2 style={{ fontSize: 34, textAlign: 'center', maxWidth: 900, marginBottom: 36 }}>{question.text}</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, width: '100%', maxWidth: 900 }}>
        {Object.entries(question.options).map(([k, v]) => (
          <div key={k} style={{ background: optionBg[k], borderRadius: 14, padding: '22px 20px', fontSize: 22 }}>
            <strong style={{ marginRight: 10 }}>{k}</strong>{v}
          </div>
        ))}
      </div>
    </div>
  );

  if (screen === STATES.QUESTION_END && questionEnd) return (
    <div style={{ ...full, justifyContent: 'flex-start', paddingTop: 50 }}>
      <h2 style={{ fontSize: 34, marginBottom: 8 }}>⏰ Süre Doldu!</h2>
      <p style={{ fontSize: 22, color: '#aaa', marginBottom: 28 }}>
        Doğru cevap: <span style={{ color: optionColors[questionEnd.correctAnswer], fontSize: 44, fontWeight: 'bold' }}>{questionEnd.correctAnswer}</span>
      </p>
      <div style={{ width: '100%', maxWidth: 700 }}>
        {['A','B','C','D'].map(k => {
          const count = questionEnd.answerDistribution[k] || 0;
          const max = Math.max(1, ...Object.values(questionEnd.answerDistribution));
          return (
            <div key={k} style={{ display: 'flex', alignItems: 'center', marginBottom: 14, gap: 12 }}>
              <span style={{ width: 28, fontSize: 20, fontWeight: 'bold', color: optionColors[k] }}>{k}</span>
              <div style={{ flex: 1, background: '#333', borderRadius: 8, height: 44, overflow: 'hidden' }}>
                <div style={{ background: k === questionEnd.correctAnswer ? '#2ecc71' : optionBg[k], width: `${(count / max) * 100}%`, height: '100%', borderRadius: 8, display: 'flex', alignItems: 'center', paddingLeft: 12, transition: 'width 0.5s', minWidth: count > 0 ? 40 : 0 }}>
                  {count > 0 && <span style={{ fontSize: 18, fontWeight: 'bold' }}>{count}</span>}
                </div>
              </div>
              <span style={{ fontSize: 17, width: 60, textAlign: 'right' }}>{count} kişi</span>
            </div>
          );
        })}
      </div>
    </div>
  );

  if (screen === STATES.SCORE_REVEAL && scoreReveal) return (
    <div style={{ ...full, justifyContent: 'flex-start', paddingTop: 36 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: 700, alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 38, margin: 0 }}>🏆 Sıralama</h2>
        {scoreReveal.nextQuestionAt > 0 && (
          <div style={{ background: '#3498db', padding: '8px 20px', borderRadius: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 'bold' }}>{nextQuestionCountdown}s</div>
            <div style={{ fontSize: 11, color: '#cce' }}>sonraki soru</div>
          </div>
        )}
      </div>
      <div style={{ width: '100%', maxWidth: 700 }}>
        {scoreReveal.top10.length === 0
          ? <p style={{ color: '#aaa', textAlign: 'center', fontSize: 20 }}>Henüz sıralama yok</p>
          : scoreReveal.top10.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', marginBottom: 8, borderRadius: 12, fontSize: 22, background: ['#ffd700','#c0c0c0','#cd7f32'][i] || '#2a2a4a', color: i < 3 ? '#333' : '#fff' }}>
              <span>{['🥇','🥈','🥉'][i] || `${p.rank}.`} <strong>{p.nickname || p.userId}</strong></span>
              <span style={{ fontSize: 26, fontWeight: 'bold' }}>{p.score}</span>
            </div>
          ))}
      </div>
    </div>
  );

  if (screen === STATES.FINISHED) return (
    <div style={full}>
      <h1 style={{ fontSize: 58, marginBottom: 28 }}>🎉 Oyun Bitti!</h1>
      <div style={{ width: '100%', maxWidth: 600 }}>
        {(gameFinished || []).map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', marginBottom: 10, borderRadius: 14, fontSize: 26, background: ['#ffd700','#c0c0c0','#cd7f32'][i] || '#2a2a4a', color: i < 3 ? '#333' : '#fff' }}>
            <span style={{ fontSize: 34 }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
            <strong>{p.nickname || p.userId}</strong>
            <span style={{ fontSize: 30, fontWeight: 'bold' }}>{p.score}</span>
          </div>
        ))}
      </div>
      <button onClick={() => { localStorage.removeItem('token'); navigate('/'); }} style={{ marginTop: 28, padding: '14px 28px', fontSize: 20, background: '#FF9900', color: '#fff', border: 'none', borderRadius: 12, cursor: 'pointer' }}>Ana Sayfaya Dön</button>
    </div>
  );

  return null;
}