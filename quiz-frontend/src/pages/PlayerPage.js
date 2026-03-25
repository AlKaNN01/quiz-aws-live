/*
 * Oyuncu sayfası — LandingPage'den /player?joinCode=X&nickname=Y ile gelir.
 * FIX: BANNED mesajı handle ediliyor — bağlantı kesilir, ana sayfaya yönlendirilir.
 * FIX: STOMP Race Condition engellendi (Retry Mekanizması Eklendi)
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import SockJS from 'sockjs-client';
import { Client } from '@stomp/stompjs';

import { WS_URL } from '../config';

const STATES = {
  CONNECTING: 'CONNECTING', WAITING: 'WAITING', COUNTDOWN: 'COUNTDOWN',
  QUESTION: 'QUESTION', ANSWER_RECEIVED: 'ANSWER_RECEIVED', QUESTION_END: 'QUESTION_END',
  ANSWER_REVEAL: 'ANSWER_REVEAL', SCORE_REVEAL: 'SCORE_REVEAL', FINISHED: 'FINISHED',
  BANNED: 'BANNED',
};

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId   = searchParams.get('joinCode') || '';
  const nickname = searchParams.get('nickname') || '';

  const [screen, setScreen]               = useState(STATES.CONNECTING);
  const [session, setSession]             = useState(null);
  const [playerCount, setPlayerCount]     = useState(0);
  const [countdown, setCountdown]         = useState(5);
  const [question, setQuestion]           = useState(null);
  const [timeLeft, setTimeLeft]           = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionEnd, setQuestionEnd]     = useState(null);
  const [answerReveal, setAnswerReveal]   = useState(null);
  const [scoreReveal, setScoreReveal]     = useState(null);
  const [nextQCountdown, setNextQCountdown] = useState(0);
  const [gameFinished, setGameFinished]   = useState(null);
  const [banReason, setBanReason]         = useState('');
  const [error, setError]                 = useState(null);

  const stompRef      = useRef(null);
  const sessionRef    = useRef(null);
  const timerRef      = useRef(null);
  const nextQRef      = useRef(null);
  const countdownRef  = useRef(null);
  const retryJoinRef  = useRef(null); // Retry döngüsünü tutmak için eklendi

  useEffect(() => { sessionRef.current = session; }, [session]);

  const handleMessage = useCallback((msg) => {
    setError(null);
    switch (msg.type) {

      case 'JOIN_ACK':
        if (msg.success) {
          setSession({ sessionId: msg.sessionId, userId: msg.userId, gameId: msg.gameId });
          setPlayerCount(msg.playerCount);
          setScreen(STATES.WAITING);
        } else {
          setError(msg.message || 'Katılım başarısız');
        }
        break;

      case 'WAITING_ROOM_UPDATE':
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
        clearInterval(timerRef.current);
        clearInterval(countdownRef.current);
        setQuestion({
          questionId: msg.questionId,
          questionIndex: msg.questionIndex,
          totalQuestions: msg.totalQuestions,
          text: msg.questionText,
          options: msg.options,
          timerSeconds: msg.timerSeconds,
          startedAt: msg.startedAt,
        });
        setSelectedAnswer(null);
        setTimeLeft(msg.timerSeconds);
        timerRef.current = setInterval(() => {
          const elapsed = Math.floor((Date.now() - msg.startedAt) / 1000);
          const left = Math.max(0, msg.timerSeconds - elapsed);
          setTimeLeft(left);
          if (left === 0) clearInterval(timerRef.current);
        }, 200);
        setScreen(STATES.QUESTION);
        break;

      case 'ANSWER_RECEIVED':
        setScreen(STATES.ANSWER_RECEIVED);
        break;

      case 'QUESTION_END':
        clearInterval(timerRef.current);
        setQuestionEnd({ correctAnswer: msg.correctAnswer, answerDistribution: msg.answerDistribution });
        setScreen(STATES.QUESTION_END);
        break;

      case 'ANSWER_REVEAL':
        setAnswerReveal({
          correctAnswer: msg.correctAnswer,
          yourAnswer: msg.yourAnswer,
          isCorrect: msg.correct,
          pointsEarned: msg.pointsEarned,
        });
        setScreen(STATES.ANSWER_REVEAL);
        break;

      case 'SCORE_REVEAL':
        setScoreReveal({
          pointsEarned: msg.pointsEarned,
          totalScore: msg.totalScore,
          myRank: msg.myRank,
          totalPlayers: msg.totalPlayers,
          top10: msg.top10,
          nextQuestionAt: msg.nextQuestionAt,
        });
        if (msg.nextQuestionAt > 0) {
          clearInterval(nextQRef.current);
          nextQRef.current = setInterval(() => {
            const left = Math.max(0, Math.ceil((msg.nextQuestionAt - Date.now()) / 1000));
            setNextQCountdown(left);
            if (left === 0) clearInterval(nextQRef.current);
          }, 200);
        }
        setScreen(STATES.SCORE_REVEAL);
        break;

      case 'GAME_FINISHED':
        clearInterval(timerRef.current);
        clearInterval(nextQRef.current);
        clearInterval(countdownRef.current);
        setGameFinished({ top5: msg.top5 });
        setScreen(STATES.FINISHED);
        break;

      // ── BAN: sunucu oyuncuyu oyundan çıkardı ───────────────
      case 'BANNED':
        if (msg.userId && sessionRef.current?.userId && msg.userId !== sessionRef.current.userId) break;
        clearInterval(timerRef.current);
        clearInterval(nextQRef.current);
        clearInterval(countdownRef.current);
        setBanReason(msg.reason || 'Kural ihlali');
        setScreen(STATES.BANNED);
        if (stompRef.current?.connected) {
          stompRef.current.deactivate();
        }
        break;

      case 'ERROR':
        setError(msg.message);
        break;

      default:
        break;
    }
  }, []);

  useEffect(() => {
    if (!gameId || !nickname) { navigate('/'); return; }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_URL),
      reconnectDelay: 0,
      onConnect: () => {
        // 1. Abonelikleri Başlat
        client.subscribe('/user/queue/personal', (m) => handleMessage(JSON.parse(m.body)));
        client.subscribe(`/topic/game/${gameId}/lobby`, (m) => handleMessage(JSON.parse(m.body)));
        client.subscribe(`/topic/game/${gameId}`, (m) => handleMessage(JSON.parse(m.body)));

        // 2. İstek Gönderme Fonksiyonu
        const sendJoinRequest = () => {
          client.publish({
            destination: '/app/game.join',
            body: JSON.stringify({ gameId, joinCode: gameId, nickname }),
          });
        };

        // İlk denemeyi beklemeden yap
        sendJoinRequest();

        // 3. Garantör (Retry) Mekanizması: Eğer 1 sn içinde cevap (session) gelmezse tekrar yolla
        retryJoinRef.current = setInterval(() => {
          if (!sessionRef.current) {
            console.log("Onay mesajı bekleniyor, katılım isteği tekrarlanıyor...");
            sendJoinRequest();
          } else {
            // Başarıyla girildiyse döngüyü temizle
            clearInterval(retryJoinRef.current);
          }
        }, 1000);
      },
      onStompError: (frame) => {
        if (screen !== STATES.BANNED) {
          setError(`Bağlantı hatası: ${frame.headers?.message || 'bilinmiyor'}`);
        }
      },
      onDisconnect: () => {
        if (screen !== STATES.BANNED) {
          setError('Sunucu bağlantısı kesildi. Yeniden bağlanılıyor...');
        }
      },
    });

    client.activate();
    stompRef.current = client;

    return () => {
      clearInterval(timerRef.current);
      clearInterval(nextQRef.current);
      clearInterval(countdownRef.current);
      clearInterval(retryJoinRef.current); // Sayfadan çıkıldığında döngüyü temizle
      client.deactivate();
    };
  }, [gameId, nickname, navigate, handleMessage]);

  const submitAnswer = (answer) => {
    const sess = sessionRef.current;
    if (!question || selectedAnswer || !sess) return;
    const reactionTimeMs = Date.now() - question.startedAt;
    setSelectedAnswer(answer);
    stompRef.current?.publish({
      destination: '/app/game.answer',
      body: JSON.stringify({
        gameId: sess.gameId,
        questionId: question.questionId,
        sessionId: sess.sessionId,
        answer,
        reactionTimeMs,
      }),
    });
  };

  // ── STYLES ────────────────────────────────────────────
  const page  = { fontFamily: 'system-ui, sans-serif', padding: 20, maxWidth: 500, margin: '0 auto' };
  const OPT   = { A: '#e74c3c', B: '#3498db', C: '#f39c12', D: '#2ecc71' };
  const OPT_D = { A: '#c0392b', B: '#2980b9', C: '#d68910', D: '#27ae60' };

  // ── SCREENS ───────────────────────────────────────────
  if (screen === STATES.BANNED) return (
    <div style={{ ...page, textAlign: 'center', paddingTop: 80 }}>
      <p style={{ fontSize: 72, margin: 0 }}>🚫</p>
      <h2 style={{ color: '#e74c3c' }}>Oyundan Çıkarıldınız</h2>
      <p style={{ color: '#888', marginBottom: 32 }}>{banReason}</p>
      <button
        onClick={() => navigate('/')}
        style={{ padding: '12px 28px', fontSize: 16, background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}
      >
        Ana Sayfaya Dön
      </button>
    </div>
  );

  if (screen === STATES.CONNECTING) return (
    <div style={{ ...page, textAlign: 'center', paddingTop: 80 }}>
      <p style={{ fontSize: 48 }}>⏳</p>
      <p style={{ fontSize: 18 }}>Bağlanıyor...</p>
      {error && (
        <div style={{ color: '#e74c3c', marginTop: 20 }}>
          <p>⚠ {error}</p>
          <button onClick={() => navigate('/')} style={{ padding: '10px 20px', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer' }}>Geri Dön</button>
        </div>
      )}
    </div>
  );

  if (screen === STATES.WAITING) return (
    <div style={{ ...page, textAlign: 'center' }}>
      <h2>⏳ Bekleme Odası</h2>
      <p style={{ fontSize: 64, margin: 0 }}>👥</p>
      <p style={{ fontSize: 52, fontWeight: 'bold', margin: 4 }}>{playerCount}</p>
      <p style={{ color: '#888' }}>oyuncu bağlandı</p>
      <p style={{ color: '#aaa', fontSize: 13 }}>Kod: <strong>{gameId}</strong> · Sen: <strong>{nickname}</strong></p>
      {error && <p style={{ color: '#e74c3c' }}>⚠ {error}</p>}
    </div>
  );

  if (screen === STATES.COUNTDOWN) return (
    <div style={{ ...page, textAlign: 'center', paddingTop: 60 }}>
      <h2 style={{ color: '#888' }}>Oyun Başlıyor!</h2>
      <div style={{ fontSize: 120, fontWeight: 'bold', color: '#e74c3c', lineHeight: 1 }}>{countdown}</div>
      <p style={{ color: '#888' }}>Hazır ol!</p>
    </div>
  );

  if (screen === STATES.QUESTION && question) return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ color: '#888' }}>Soru {question.questionIndex + 1}/{question.totalQuestions}</span>
        <span style={{ fontSize: 28, fontWeight: 'bold', color: timeLeft <= 5 ? '#e74c3c' : timeLeft <= 10 ? '#f39c12' : '#333' }}>⏱ {timeLeft}s</span>
      </div>
      <div style={{ background: '#eee', borderRadius: 4, height: 8, marginBottom: 20 }}>
        <div style={{ background: timeLeft <= 5 ? '#e74c3c' : '#3498db', width: `${(timeLeft / question.timerSeconds) * 100}%`, height: '100%', borderRadius: 4, transition: 'width 0.2s' }} />
      </div>
      <h3 style={{ fontSize: 20, marginBottom: 20 }}>{question.text}</h3>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {Object.entries(question.options).map(([key, val]) => (
          <button key={key} onClick={() => submitAnswer(key)} disabled={!!selectedAnswer}
            style={{
              padding: '18px 12px',
              background: selectedAnswer === key ? OPT_D[key] : OPT[key],
              color: '#fff', border: selectedAnswer === key ? '3px solid #fff' : '3px solid transparent',
              borderRadius: 10, fontSize: 16, cursor: selectedAnswer ? 'default' : 'pointer',
              opacity: selectedAnswer && selectedAnswer !== key ? 0.45 : 1, transition: 'opacity 0.2s',
            }}>
            <strong>{key})</strong> {val}
          </button>
        ))}
      </div>
      {error && <p style={{ color: 'red', marginTop: 12 }}>⚠ {error}</p>}
    </div>
  );

  if (screen === STATES.ANSWER_RECEIVED) return (
    <div style={{ ...page, textAlign: 'center', paddingTop: 60 }}>
      <p style={{ fontSize: 72 }}>✅</p>
      <h2>Cevabın alındı!</h2>
      <p style={{ color: '#888' }}>Diğer oyuncular bekleniyor...</p>
    </div>
  );

  if (screen === STATES.QUESTION_END && questionEnd) return (
    <div style={page}>
      <h2>⏰ Süre Doldu!</h2>
      <p>Doğru cevap: <strong style={{ color: OPT[questionEnd.correctAnswer], fontSize: 28 }}>{questionEnd.correctAnswer}</strong></p>
      <h3>Şık Dağılımı</h3>
      {['A','B','C','D'].map(k => {
        const count = questionEnd.answerDistribution[k] || 0;
        const max   = Math.max(1, ...Object.values(questionEnd.answerDistribution));
        return (
          <div key={k} style={{ display: 'flex', alignItems: 'center', marginBottom: 8, gap: 10 }}>
            <span style={{ width: 28, fontWeight: 'bold', color: OPT[k] }}>{k}</span>
            <div style={{ flex: 1, background: '#eee', borderRadius: 6, height: 28, overflow: 'hidden' }}>
              <div style={{ background: k === questionEnd.correctAnswer ? '#2ecc71' : OPT[k], width: `${(count / max) * 100}%`, height: '100%', borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 8, color: '#fff', fontSize: 13, transition: 'width 0.5s', minWidth: count > 0 ? 32 : 0 }}>
                {count > 0 && count}
              </div>
            </div>
            <span style={{ fontSize: 13, color: '#888', width: 48 }}>{count} kişi</span>
          </div>
        );
      })}
    </div>
  );

  if (screen === STATES.ANSWER_REVEAL && answerReveal) return (
    <div style={{ ...page, textAlign: 'center', paddingTop: 40 }}>
      <p style={{ fontSize: 80, margin: 0 }}>{answerReveal.isCorrect ? '🎉' : '😢'}</p>
      <h2 style={{ color: answerReveal.isCorrect ? '#2ecc71' : '#e74c3c', fontSize: 32 }}>{answerReveal.isCorrect ? 'Doğru!' : 'Yanlış!'}</h2>
      <p>Senin cevabın: <strong style={{ color: OPT[answerReveal.yourAnswer] || '#888' }}>{answerReveal.yourAnswer || '(cevap vermedi)'}</strong></p>
      <p>Doğru cevap: <strong style={{ color: OPT[answerReveal.correctAnswer] }}>{answerReveal.correctAnswer}</strong></p>
      {answerReveal.isCorrect && <p style={{ fontSize: 32, color: '#f39c12', fontWeight: 'bold' }}>+{answerReveal.pointsEarned} puan</p>}
    </div>
  );

  if (screen === STATES.SCORE_REVEAL && scoreReveal) return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>📊 Sıralama</h2>
        {scoreReveal.nextQuestionAt > 0 && (
          <span style={{ background: '#3498db', color: '#fff', padding: '4px 12px', borderRadius: 20, fontSize: 14 }}>Sonraki: {nextQCountdown}s</span>
        )}
      </div>
      <div style={{ background: '#f5f5f5', borderRadius: 10, padding: 16, margin: '16px 0', textAlign: 'center' }}>
        <p style={{ margin: 0, color: '#888', fontSize: 13 }}>Toplam Puanın</p>
        <p style={{ margin: 0, fontSize: 44, fontWeight: 'bold' }}>{scoreReveal.totalScore}</p>
        <p style={{ margin: 0, color: '#888' }}>Sıran: {scoreReveal.myRank > 0 ? `#${scoreReveal.myRank}` : '-'} / {scoreReveal.totalPlayers}</p>
      </div>
      <h3>Top 10</h3>
      {scoreReveal.top10.length === 0
        ? <p style={{ color: '#aaa' }}>Henüz sıralama yok</p>
        : scoreReveal.top10.map((p, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', background: ['#ffd700','#c0c0c0','#cd7f32'][i] || '#f9f9f9', borderRadius: 8, marginBottom: 4 }}>
            <span>{p.rank}. {p.nickname || p.userId}</span><strong>{p.score}</strong>
          </div>
        ))}
    </div>
  );

  if (screen === STATES.FINISHED && gameFinished) return (
    <div style={{ ...page, textAlign: 'center' }}>
      <h1>🏆 Oyun Bitti!</h1>
      {gameFinished.top5.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 18px', background: ['#ffd700','#c0c0c0','#cd7f32'][i] || '#f0f0f0', borderRadius: 10, marginBottom: 8, fontSize: 18 }}>
          <span>{['🥇','🥈','🥉','4.','5.'][i]} {p.nickname || p.userId}</span>
          <strong>{p.score}</strong>
        </div>
      ))}
      <button onClick={() => navigate('/')} style={{ marginTop: 16, padding: '12px 24px', fontSize: 16, background: '#3498db', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer' }}>Ana Sayfa</button>
    </div>
  );

  return null;
}