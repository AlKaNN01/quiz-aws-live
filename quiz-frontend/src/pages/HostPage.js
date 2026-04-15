/*
 * Host (projeksiyon) ekranı — LandingPage'den login sonrası gelir.
 * Token localStorage'dan okunur, joinCode girişi bu sayfada yapılır.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import { WS_URL } from "../config";
import leaderboardImage from "../assets/leaderboard.png";
const optionColors = { A: "#e74c3c", B: "#3498db", C: "#f39c12", D: "#2ecc71" };
const optionBg = { A: "#c0392b", B: "#2980b9", C: "#d68910", D: "#27ae60" };

const STATES = {
  SETUP: "SETUP",
  WAITING: "WAITING",
  COUNTDOWN: "COUNTDOWN",
  QUESTION: "QUESTION",
  QUESTION_END: "QUESTION_END",
  SCORE_REVEAL: "SCORE_REVEAL",
  FINISHED: "FINISHED",
};

export default function HostPage() {
  const navigate = useNavigate();
  const token = sessionStorage.getItem("token") || "";

  const [screen, setScreen] = useState(STATES.SETUP);
  const [gameId, setGameId] = useState("");
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
  const clockOffsetRef = useRef(0);

  useEffect(() => {
    if (!token) navigate("/");
  }, [token, navigate]);

  const handleMessage = useCallback((msg) => {
    switch (msg.type) {
      case "HOST_WAITING_UPDATE":
        setPlayerCount(msg.playerCount);
        break;
      case "GAME_STARTED":
        setScreen(STATES.COUNTDOWN);
        clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const left = Math.max(
            0,
            Math.ceil((msg.firstQuestionAt - (Date.now() + clockOffsetRef.current)) / 1000),
          );
          setCountdown(left);
          if (left === 0) clearInterval(countdownRef.current);
        }, 200);
        break;
      case "GAME_TICK":
        if (msg.timestamp) clockOffsetRef.current = msg.timestamp - Date.now();
        if (screen === STATES.QUESTION) {
          setTimeLeft(msg.secondsRemaining);
        }
        break;
      case "QUESTION_START":
        clearInterval(countdownRef.current);
        clearInterval(timerRef.current);
        setQuestion({
          questionId: msg.questionId,
          index: msg.questionIndex,
          total: msg.totalQuestions,
          text: msg.questionText,
          options: msg.options,
          timerSeconds: msg.timerSeconds,
          startedAt: msg.startedAt,
        });
        setAnswerCount(0);
        setQuestionEnd(null);
        setTimeLeft(msg.timerSeconds);
        // Client-side fallback timer (network latency için) — ama GAME_TICK varsa o kullanılır
        timerRef.current = setInterval(() => {
          const now = Date.now() + clockOffsetRef.current;
          const left = Math.max(
            0,
            msg.timerSeconds - Math.floor((now - msg.startedAt) / 1000),
          );
          setTimeLeft(left);
          if (left === 0) clearInterval(timerRef.current);
        }, 200);
        setScreen(STATES.QUESTION);
        break;
      case "HOST_ANSWER_COUNT":
        setAnswerCount(msg.answeredCount);
        break;
      case "QUESTION_END":
        clearInterval(timerRef.current);
        setQuestionEnd({
          correctAnswer: msg.correctAnswer,
          answerDistribution: msg.answerDistribution,
          totalAnswered: msg.totalAnswered,
          totalPlayers: msg.totalPlayers,
        });
        setScreen(STATES.QUESTION_END);
        break;
      case "SCORE_REVEAL":
        setScoreReveal({
          top10: msg.top10,
          nextQuestionAt: msg.nextQuestionAt,
        });
        if (msg.nextQuestionAt > 0) {
          clearInterval(nextQRef.current);
          nextQRef.current = setInterval(() => {
            const left = Math.max(
              0,
              Math.ceil((msg.nextQuestionAt - (Date.now() + clockOffsetRef.current)) / 1000),
            );
            setNextQuestionCountdown(left);
            if (left === 0) clearInterval(nextQRef.current);
          }, 200);
        }
        setScreen(STATES.SCORE_REVEAL);
        break;
      case "GAME_FINISHED":
        clearInterval(timerRef.current);
        clearInterval(nextQRef.current);
        clearInterval(countdownRef.current);
        setGameFinished(msg.top5);
        setScreen(STATES.FINISHED);
        break;
      default:
        break;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connect = () => {
    const code = gameId.trim().toUpperCase();
    if (!code) return;
    const sockJsUrl = WS_URL.replace(/^wss?:/, (m) => m === 'ws:' ? 'http:' : 'https:');
    const client = new Client({
      webSocketFactory: () => new SockJS(sockJsUrl),
      reconnectDelay: 5000,
      onConnect: () => {
        setConnected(true);
        client.subscribe(`/topic/game/${code}/host`, (msg) =>
          handleMessage(JSON.parse(msg.body)),
        );
        client.subscribe(`/topic/game/${code}`, (msg) =>
          handleMessage(JSON.parse(msg.body)),
        );
        client.subscribe(`/user/queue/personal`, (msg) => {
          try { handleMessage(JSON.parse(msg.body)); } catch { /* ignore */ }
        });
        client.publish({
          destination: "/app/host.connect",
          body: JSON.stringify({ joinCode: code, adminToken: token }),
        });
        setScreen(STATES.WAITING);
      },
      onDisconnect: () => { setConnected(false); },
      onStompError: () => {},
    });
    client.activate();
    stompClient.current = client;
  };

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      clearInterval(nextQRef.current);
      clearInterval(countdownRef.current);
      stompClient.current?.deactivate();
    },
    [],
  );

  const full = {
    fontFamily: "monospace",
    minHeight: "100vh",
    background: "#1a1a2e",
    color: "#fff",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  };

  if (screen === STATES.SETUP)
    return (
      <div style={{ ...full, background: "#f5f5f5", color: "#333" }}>
        <h2>🖥️ Host Ekranı</h2>
        <input
          value={gameId}
          onChange={(e) => setGameId(e.target.value.toUpperCase())}
          placeholder="Oyun Kodu"
          style={{
            padding: 14,
            fontSize: 24,
            textAlign: "center",
            marginBottom: 14,
            borderRadius: 10,
            border: "2px solid #ccc",
            width: 220,
            letterSpacing: "0.1em",
          }}
        />
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={connect}
            style={{
              padding: "12px 24px",
              fontSize: 17,
              background: "#FF9900",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            Bağlan
          </button>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "12px 24px",
              fontSize: 17,
              background: "#888",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              cursor: "pointer",
            }}
          >
            ← Geri
          </button>
        </div>
      </div>
    );

  if (screen === STATES.WAITING)
    return (
      <HostShell>
        <HostGlow
          top="10%"
          left="12%"
          size={340}
          color="rgba(95, 151, 255, 0.16)"
        />
        <HostGlow
          top="72%"
          left="72%"
          size={360}
          color="rgba(255, 153, 0, 0.12)"
        />
        <HostStars />

        <HostStage style={{ maxWidth: 940, padding: "44px 40px 40px" }}>
          <HostPill>AWS Cloud Club Quiz</HostPill>
          <HostTitle style={{ marginTop: 22 }}>
            Katılmak için kodu gir
          </HostTitle>
          <HostSubtle>
            Bu kodla da doğrudan yarışmaya katılabilirsiniz.
          </HostSubtle>

          <HostCode>{gameId}</HostCode>

          <div
            style={{ marginTop: 26, display: "flex", justifyContent: "center" }}
          >
            <div
              style={{
                width: 168,
                height: 168,
                borderRadius: 28,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(232, 238, 255, 0.9))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#43385b",
                fontSize: 18,
                fontWeight: 800,
                boxShadow: "0 20px 50px rgba(7, 3, 30, 0.24)",
              }}
            >
              QR Kod
            </div>
          </div>

          <div
            style={{
              marginTop: 30,
              display: "flex",
              justifyContent: "center",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <HostMetricCard value={playerCount} label="Oyuncu bağlandı" />
            <HostMetricCard
              value={connected ? "Bağlı" : "Bekleniyor"}
              label="Bağlantı durumu"
              accent={connected ? "#44D18D" : "#FFB443"}
            />
          </div>
        </HostStage>
      </HostShell>
    );

  if (screen === STATES.COUNTDOWN)
    return (
      <HostShell>
        <HostGlow
          top="16%"
          left="18%"
          size={320}
          color="rgba(95, 151, 255, 0.16)"
        />
        <HostGlow
          top="58%"
          left="62%"
          size={340}
          color="rgba(255, 153, 0, 0.14)"
        />
        <HostStage style={{ maxWidth: 720, padding: "50px 30px 56px" }}>
          <HostPill>Başlangıç Ekranı</HostPill>
          <HostTitle style={{ marginTop: 24, fontSize: 64 }}>
            Oyun başlıyor
          </HostTitle>
          <HostSubtle
            style={{ maxWidth: 440, marginLeft: "auto", marginRight: "auto" }}
          >
            İlk soru birazdan başlıyacak. Oyuncular hazır.
          </HostSubtle>
          <div
            style={{
              marginTop: 28,
              marginLeft: "auto",
              marginRight: "auto",
              width: 260,
              height: 260,
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background:
                "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.24), rgba(255,255,255,0.05))",
              boxShadow: "0 28px 70px rgba(8, 4, 34, 0.38)",
            }}
          >
            <div
              style={{
                width: 190,
                height: 190,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                background:
                  "linear-gradient(180deg, rgba(255,153,0,0.36), rgba(255,255,255,0.06))",
                color: "#fff",
                fontSize: 138,
                fontWeight: 900,
                lineHeight: 1,
              }}
            >
              {countdown}
            </div>
          </div>
        </HostStage>
      </HostShell>
    );

  if (screen === STATES.QUESTION && question)
    return (
      <HostShell>
        <HostGlow
          top="10%"
          left="12%"
          size={320}
          color="rgba(95, 151, 255, 0.14)"
        />
        <HostGlow
          top="70%"
          left="76%"
          size={340}
          color="rgba(255, 153, 0, 0.12)"
        />
        <HostStars />

        <HostStage style={{ maxWidth: 980, padding: "26px 24px 28px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <HostMetaPill>
              Soru {question.index + 1}/{question.total}
            </HostMetaPill>
            <HostTimerPill
              tone={
                timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "normal"
              }
            >
              ⏱ {timeLeft}s
            </HostTimerPill>
            <HostMetaPill>{answerCount} cevap alındı</HostMetaPill>
          </div>

          <div
            style={{
              width: "100%",
              height: 12,
              borderRadius: 999,
              background: "rgba(255,255,255,0.1)",
              overflow: "hidden",
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: `${(timeLeft / question.timerSeconds) * 100}%`,
                height: "100%",
                borderRadius: 999,
                background:
                  timeLeft <= 5
                    ? "#FF6B6B"
                    : timeLeft <= 10
                      ? "#FFB443"
                      : "#48A7FF",
                transition: "width 0.2s ease",
              }}
            />
          </div>

          <div
            style={{
              position: "relative",
              padding: "24px 20px 18px",
              borderRadius: 28,
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
              border: "1px solid rgba(255,255,255,0.08)",
              overflow: "hidden",
              marginBottom: 22,
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: "-20% auto auto 50%",
                width: 260,
                height: 260,
                transform: "translateX(-50%)",
                background:
                  "radial-gradient(circle, rgba(117, 194, 255, 0.16) 0%, rgba(0,0,0,0) 70%)",
                pointerEvents: "none",
              }}
            />
            <h2
              style={{
                position: "relative",
                zIndex: 1,
                margin: 0,
                textAlign: "center",
                fontSize: 54,
                lineHeight: 1.06,
                letterSpacing: "-0.04em",
                fontWeight: 900,
              }}
            >
              {question.text}
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              width: "100%",
            }}
          >
            {Object.entries(question.options).map(([k, v]) => (
              <div
                key={k}
                style={{
                  minHeight: 126,
                  padding: "22px 18px",
                  borderRadius: 18,
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#fff",
                  textAlign: "left",
                  boxShadow: "0 18px 34px rgba(8, 4, 34, 0.24)",
                  background: `linear-gradient(135deg, ${optionColors[k]} 0%, ${optionBg[k]} 100%)`,
                }}
              >
                <div
                  style={{
                    fontSize: 30,
                    fontWeight: 900,
                    letterSpacing: "-0.03em",
                    marginBottom: 8,
                  }}
                >
                  {k}
                </div>
                <div style={{ fontSize: 24, lineHeight: 1.2, fontWeight: 700 }}>
                  {v}
                </div>
              </div>
            ))}
          </div>
        </HostStage>
      </HostShell>
    );

  if (screen === STATES.QUESTION_END && questionEnd)
    return (
      <HostShell justify="center" padTop={24}>
        <HostStage style={{ maxWidth: 920, padding: "34px 34px 36px" }}>
          <div style={{ textAlign: "center", marginBottom: 26 }}>
            <HostPill style={{ background: "rgba(255,255,255,0.08)" }}>
              Tur Sonucu
            </HostPill>
            <HostTitle style={{ marginTop: 18, fontSize: 54 }}>
              Süre doldu
            </HostTitle>
            <HostSubtle>
              Doğru cevap:
              <span
                style={{
                  color: optionColors[questionEnd.correctAnswer],
                  fontSize: 54,
                  fontWeight: 900,
                  marginLeft: 16,
                  verticalAlign: "middle",
                }}
              >
                {questionEnd.correctAnswer}
              </span>
            </HostSubtle>
          </div>

          <div style={{ width: "100%", maxWidth: 760, margin: "0 auto" }}>
            {["A", "B", "C", "D"].map((k) => {
              const count = questionEnd.answerDistribution[k] || 0;
              const max = Math.max(
                1,
                ...Object.values(questionEnd.answerDistribution),
              );
              return (
                <div
                  key={k}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "44px 1fr 76px",
                    alignItems: "center",
                    marginBottom: 16,
                    gap: 16,
                  }}
                >
                  <span
                    style={{
                      width: 44,
                      fontSize: 30,
                      fontWeight: "bold",
                      color: optionColors[k],
                      textAlign: "center",
                    }}
                  >
                    {k}
                  </span>
                  <div
                    style={{
                      flex: 1,
                      background: "rgba(255,255,255,0.08)",
                      borderRadius: 14,
                      height: 52,
                      overflow: "hidden",
                      boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
                    }}
                  >
                    <div
                      style={{
                        background:
                          k === questionEnd.correctAnswer
                            ? "#69d37a"
                            : optionBg[k],
                        width: `${(count / max) * 100}%`,
                        height: "100%",
                        borderRadius: 14,
                        display: "flex",
                        alignItems: "center",
                        paddingLeft: 16,
                        transition: "width 0.5s",
                        minWidth: count > 0 ? 52 : 0,
                      }}
                    >
                      {count > 0 && (
                        <span style={{ fontSize: 22, fontWeight: "bold" }}>
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 22,
                      width: 76,
                      textAlign: "right",
                      color: "rgba(234,240,255,0.86)",
                      fontWeight: 700,
                    }}
                  >
                    {count} kişi
                  </span>
                </div>
              );
            })}
          </div>
        </HostStage>
      </HostShell>
    );

  if (screen === STATES.SCORE_REVEAL && scoreReveal)
    return (
      <HostShell>
        <HostGlow
          top="10%"
          left="12%"
          size={320}
          color="rgba(95, 151, 255, 0.14)"
        />
        <HostGlow
          top="72%"
          left="76%"
          size={340}
          color="rgba(255, 153, 0, 0.12)"
        />
        <HostStars />

        <HostStage style={{ maxWidth: 560, padding: "24px 22px 26px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              width: "100%",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <h2 style={{ fontSize: 38, margin: 0, fontWeight: 900 }}>
              🏆 Sıralama
            </h2>
            {scoreReveal.nextQuestionAt > 0 && (
              <HostTimerPill tone="normal">
                Sonraki soru: {nextQuestionCountdown}s
              </HostTimerPill>
            )}
          </div>
          <div style={{ width: "100%" }}>
            {scoreReveal.top10.length === 0 ? (
              <p style={{ color: "#aaa", textAlign: "center", fontSize: 20 }}>
                Henüz sıralama yok
              </p>
            ) : (
              scoreReveal.top10.map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "14px 18px",
                    marginBottom: 8,
                    borderRadius: 16,
                    fontSize: 22,
                    background:
                      i < 3
                        ? "rgba(255,255,255,0.16)"
                        : "rgba(255,255,255,0.08)",
                    color: "#fff",
                  }}
                >
                  <span>
                    {["🥇", "🥈", "🥉"][i] || `${p.rank}.`}{" "}
                    <strong>{p.nickname || p.userId}</strong>
                  </span>
                  <span style={{ fontSize: 26, fontWeight: "bold" }}>
                    {p.score}
                  </span>
                </div>
              ))
            )}
          </div>
        </HostStage>
      </HostShell>
    );

  if (screen === STATES.FINISHED)
    return (
      <HostShell>
        <HostGlow
          top="12%"
          left="14%"
          size={320}
          color="rgba(95, 151, 255, 0.14)"
        />
        <HostGlow
          top="72%"
          left="76%"
          size={340}
          color="rgba(255, 153, 0, 0.12)"
        />
        <HostStars />

        <div
          style={{
            width: "100%",
            maxWidth: 700,
            position: "relative",
            paddingTop: 106,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 2,
            }}
          >
            <img
              src={leaderboardImage}
              alt="Leaderboard"
              style={{ width: 164, height: 164, objectFit: "contain" }}
            />
          </div>
          <HostStage
            style={{
              maxWidth: 700,
              padding: "78px 34px 34px",
              textAlign: "center",
            }}
          >
            <HostPill style={{ background: "rgba(255,255,255,0.08)" }}>
              Final
            </HostPill>
            <HostTitle style={{ marginTop: 18, fontSize: 68 }}>
              Oyun bitti
            </HostTitle>
            <HostSubtle
              style={{ maxWidth: 420, marginLeft: "auto", marginRight: "auto" }}
            >
              Final liderlik tablosu aşağıda.
            </HostSubtle>

            <div
              style={{
                width: "100%",
                maxWidth: 560,
                margin: "28px auto 0",
                display: "grid",
                gap: 10,
              }}
            >
              {(gameFinished || []).map((p, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                    borderRadius: 18,
                    padding: "16px 18px",
                    background:
                      i < 3
                        ? "rgba(255,255,255,0.16)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <span style={{ width: 28, textAlign: "center" }}>
                      {["🥇", "🥈", "🥉", "4.", "5."][i] || `${i + 1}.`}
                    </span>
                    <span style={{ fontSize: 20, fontWeight: 800 }}>
                      {p.nickname || p.userId}
                    </span>
                  </div>
                  <strong style={{ fontSize: 20 }}>{p.score}</strong>
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                sessionStorage.removeItem("token");
                navigate("/");
              }}
              style={{
                marginTop: 22,
                padding: "14px 28px",
                fontSize: 16,
                fontWeight: 900,
                background: "linear-gradient(135deg, #5cc6ff 0%, #416eff 100%)",
                color: "#fff",
                border: "none",
                borderRadius: 16,
                cursor: "pointer",
                boxShadow: "0 18px 34px rgba(15, 9, 52, 0.28)",
              }}
            >
              Ana sayfa
            </button>
          </HostStage>
        </div>
      </HostShell>
    );

  return null;
}

function HostShell({ children, justify = "center", padTop = 24 }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(140deg, #14042d 0%, #2a0a50 45%, #491487 100%)",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: justify,
        padding: `${padTop}px 24px 32px`,
        fontFamily: "monospace",
      }}
    >
      {children}
    </div>
  );
}

function HostStage({ children, style }) {
  return (
    <div
      style={{
        position: "relative",
        zIndex: 1,
        width: "100%",
        borderRadius: 34,
        background:
          "linear-gradient(180deg, rgba(18, 10, 49, 0.9), rgba(43, 18, 78, 0.86))",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 28px 70px rgba(7, 3, 30, 0.42)",
        backdropFilter: "blur(18px)",
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

function HostPill({ children, style }) {
  return (
    <div
      style={{
        display: "inline-flex",
        padding: "10px 16px",
        borderRadius: 999,
        background: "rgba(255, 153, 0, 0.16)",
        color: "#ffbf66",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function HostTitle({ children, style }) {
  return (
    <h1
      style={{
        margin: 0,
        fontSize: 72,
        lineHeight: 0.95,
        letterSpacing: "-0.05em",
        fontWeight: 900,
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </h1>
  );
}

function HostSubtle({ children, style }) {
  return (
    <p
      style={{
        margin: "14px 0 0",
        textAlign: "center",
        color: "rgba(232,239,255,0.76)",
        fontSize: 24,
        lineHeight: 1.45,
        fontWeight: 600,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

function HostCode({ children }) {
  return (
    <div
      style={{
        marginTop: 28,
        textAlign: "center",
        fontSize: "clamp(74px, 10vw, 128px)",
        fontWeight: 900,
        letterSpacing: "0.16em",
        color: "#FF9900",
        textShadow: "0 18px 40px rgba(255, 153, 0, 0.18)",
      }}
    >
      {children}
    </div>
  );
}

function HostMetricCard({ value, label, accent = "#eef4ff" }) {
  return (
    <div
      style={{
        minWidth: 220,
        padding: "18px 22px",
        borderRadius: 22,
        background: "rgba(255,255,255,0.08)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
        textAlign: "center",
      }}
    >
      <div
        style={{ fontSize: 42, lineHeight: 1, fontWeight: 900, color: accent }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 10,
          color: "rgba(222,230,255,0.58)",
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function HostMetaPill({ children, style }) {
  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        background: "rgba(255,255,255,0.08)",
        color: "#eef4ff",
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function HostTimerPill({ children, tone = "normal", style }) {
  const background =
    tone === "danger"
      ? "rgba(255, 107, 107, 0.18)"
      : tone === "warn"
        ? "rgba(255, 180, 67, 0.18)"
        : "rgba(72, 167, 255, 0.18)";

  return (
    <div
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        background,
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function HostGlow({ top, left, size, color }) {
  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 70%)`,
        filter: "blur(22px)",
        pointerEvents: "none",
      }}
    />
  );
}

function HostStars() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <span style={{ ...hostStar("8%", "10%", 20) }}>✦</span>
      <span style={{ ...hostStar("18%", "86%", 16) }}>✦</span>
      <span style={{ ...hostStar("72%", "14%", 18) }}>✦</span>
      <span style={{ ...hostStar("82%", "78%", 15) }}>✦</span>
    </div>
  );
}

function hostStar(top, left, size) {
  return {
    position: "absolute",
    top,
    left,
    color: "#dff2ff",
    fontSize: size,
    opacity: 0.88,
    textShadow: "0 0 18px rgba(170, 221, 255, 0.24)",
  };
}
