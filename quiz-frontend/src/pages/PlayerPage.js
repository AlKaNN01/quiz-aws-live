import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";

import { WS_URL } from "../config";
import fluffyImage from "../assets/waiting-fluffy.png";
import sadFluffyImage from "../assets/sad-fluffy.png";
import happyFluffyImage from "../assets/happy-fluffy.png";

const STATES = {
  CONNECTING: "CONNECTING",
  WAITING: "WAITING",
  COUNTDOWN: "COUNTDOWN",
  QUESTION: "QUESTION",
  ANSWER_RECEIVED: "ANSWER_RECEIVED",
  QUESTION_END: "QUESTION_END",
  ANSWER_REVEAL: "ANSWER_REVEAL",
  SCORE_REVEAL: "SCORE_REVEAL",
  FINISHED: "FINISHED",
  BANNED: "BANNED",
};

const OPT = { A: "#FF6B6B", B: "#48A7FF", C: "#FFB443", D: "#44D18D" };
const OPT_DARK = { A: "#D94E62", B: "#246BFF", C: "#F28C1B", D: "#24AF68" };
const MEDALS = ["🥇", "🥈", "🥉"];

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const gameId = searchParams.get("joinCode") || "";
  const nickname = searchParams.get("nickname") || "";

  const [screen, setScreen] = useState(STATES.CONNECTING);
  const [session, setSession] = useState(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [countdown, setCountdown] = useState(5);
  const [question, setQuestion] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [questionEnd, setQuestionEnd] = useState(null);
  const [answerReveal, setAnswerReveal] = useState(null);
  const [scoreReveal, setScoreReveal] = useState(null);
  const [nextQCountdown, setNextQCountdown] = useState(0);
  const [gameFinished, setGameFinished] = useState(null);
  const [banReason, setBanReason] = useState("");
  const [error, setError] = useState(null);
  const [fatalError, setFatalError] = useState(null);
  const [lobbyWaiting, setLobbyWaiting] = useState(false);
  const [streak, setStreak] = useState(0);

  const stompRef = useRef(null);
  const sessionRef = useRef(null);
  const screenRef = useRef(STATES.CONNECTING);
  // Server saatiyle client saati arasındaki fark (ms).
  // now() = Date.now() + clockOffsetRef.current → sunucu saatine göre düzeltilmiş zaman.
  const clockOffsetRef = useRef(0);
  const timerRef = useRef(null);
  const nextQRef = useRef(null);
  const countdownRef = useRef(null);
  const retryJoinRef = useRef(null);
  const answerSubmittedRef = useRef(false);
  const lobbyWaitingRef = useRef(false);

  useEffect(() => {
    sessionRef.current = session;
    if (session) {
      localStorage.setItem("quiz_session_" + gameId, JSON.stringify(session));
    }
  }, [session, gameId]);
  useEffect(() => {
    screenRef.current = screen;
  }, [screen]);

  const handleMessage = useCallback(
    (msg) => {
      setError(null);

      switch (msg.type) {
        case "JOIN_ACK":
          if (msg.success) {
            if (msg.serverTime) clockOffsetRef.current = msg.serverTime - Date.now();
            setSession({
              sessionId: msg.sessionId,
              userId: msg.userId,
              gameId: msg.gameId,
            });
            setPlayerCount(msg.playerCount);
            setLobbyWaiting(false);
            setScreen(STATES.WAITING);
          } else {
            setError(msg.message || "Katilim basarisiz");
          }
          break;

        case "WAITING_ROOM_UPDATE":
          setPlayerCount(msg.playerCount);
          break;

        case "GAME_STARTED":
          setScreen(STATES.COUNTDOWN);
          clearInterval(countdownRef.current);
          countdownRef.current = setInterval(() => {
            const left = Math.max(
              0,
              Math.ceil((msg.firstQuestionAt - Date.now()) / 1000),
            );
            setCountdown(left);
            if (left === 0) clearInterval(countdownRef.current);
          }, 200);
          break;

        case "QUESTION_START":
          clearInterval(timerRef.current);
          clearInterval(countdownRef.current);
          setStreak(0);
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
          answerSubmittedRef.current = false;
          setTimeLeft(msg.timerSeconds);
          timerRef.current = setInterval(() => {
            const now = Date.now() + clockOffsetRef.current;
            const elapsed = Math.floor((now - msg.startedAt) / 1000);
            const left = Math.max(0, msg.timerSeconds - elapsed);
            setTimeLeft(left);
            if (left === 0) clearInterval(timerRef.current);
          }, 200);
          setScreen(STATES.QUESTION);
          break;

        case "GAME_TICK":
          // Her tick'te clock offset güncelle — sunucu saatiyle senkron kalır
          if (msg.timestamp) clockOffsetRef.current = msg.timestamp - Date.now();
          if (screenRef.current === STATES.QUESTION) {
            setTimeLeft(msg.secondsRemaining);
          }
          break;

        case "ANSWER_RECEIVED":
          if (msg.streak >= 2) setStreak(msg.streak);
          setScreen(STATES.ANSWER_RECEIVED);
          break;

        case "QUESTION_END":
          clearInterval(timerRef.current);
          setQuestionEnd({
            correctAnswer: msg.correctAnswer,
            answerDistribution: msg.answerDistribution,
          });
          setScreen(STATES.QUESTION_END);
          break;

        case "ANSWER_REVEAL":
          setAnswerReveal({
            correctAnswer: msg.correctAnswer,
            yourAnswer: msg.yourAnswer,
            isCorrect: msg.correct,
            pointsEarned: msg.pointsEarned,
          });
          setScreen(STATES.ANSWER_REVEAL);
          break;

        case "SCORE_REVEAL":
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
              const left = Math.max(
                0,
                Math.ceil((msg.nextQuestionAt - Date.now()) / 1000),
              );
              setNextQCountdown(left);
              if (left === 0) clearInterval(nextQRef.current);
            }, 200);
          }
          setScreen(STATES.SCORE_REVEAL);
          break;

        case "GAME_FINISHED":
          clearInterval(timerRef.current);
          clearInterval(nextQRef.current);
          clearInterval(countdownRef.current);
          localStorage.removeItem("quiz_session_" + gameId);
          setGameFinished({ top5: msg.top5 });
          setScreen(STATES.FINISHED);
          break;

        case "BANNED":
          // BANNED artık yalnızca o oyuncuya sendToUser ile gönderiliyor — userId filtresi gerekmiyor
          clearInterval(timerRef.current);
          clearInterval(nextQRef.current);
          clearInterval(countdownRef.current);
          localStorage.removeItem("quiz_session_" + gameId);
          setBanReason(msg.reason || "Kural ihlali");
          setScreen(STATES.BANNED);
          if (stompRef.current?.connected) {
            stompRef.current.deactivate();
          }
          break;

        case "RECONNECT_ACK":
          if (msg.success) {
            if (msg.serverTime) clockOffsetRef.current = msg.serverTime - Date.now();
            setError(null);
          } else {
            // Session geçersiz — yeni oyun başlamış olabilir. localStorage temizle, anasayfaya yönlendir.
            localStorage.removeItem("quiz_session_" + gameId);
            sessionRef.current = null;
            setSession(null);
            navigate("/");
          }
          break;

        case "ERROR":
          if (msg.errorCode === "LOBBY_NOT_OPEN" || msg.errorCode === "HOST_NOT_CONNECTED") {
            // Lobi açılmamış — bekle, navigate etme, mesajı güncelle
            lobbyWaitingRef.current = true;
            setLobbyWaiting(true);
            setError(msg.message);
          } else {
            // Fatal error: retry'ı durdur, hata ekranı göster (navigate etme — kullanıcı mesajı göremez)
            lobbyWaitingRef.current = false;
            clearInterval(retryJoinRef.current);
            setFatalError(msg.message || "Bilinmeyen bir hata oluştu.");
          }
          break;

        default:
          break;
      }
    },
    [navigate, gameId],
  );

  useEffect(() => {
    if (!gameId || !nickname) {
      navigate("/");
      return;
    }

    const sockJsUrl = WS_URL.replace(/^wss?:/, (m) => m === 'ws:' ? 'http:' : 'https:');
    const client = new Client({
      webSocketFactory: () => new SockJS(sockJsUrl),
      // reconnectDelay 0 olursa player kopunca hic yeniden baglanmaz.
      // 3000ms ile max 5 deneme yapilir, sonra kullanici anasayfaya yonlendirilir.
      reconnectDelay: 3000,
      onConnect: () => {
        client.subscribe("/user/queue/personal", (m) =>
          handleMessage(JSON.parse(m.body)),
        );
        client.subscribe(`/topic/game/${gameId}/lobby`, (m) =>
          handleMessage(JSON.parse(m.body)),
        );
        client.subscribe(`/topic/game/${gameId}`, (m) =>
          handleMessage(JSON.parse(m.body)),
        );

        // Önce in-memory ref'e bak (kısa WS kopması), sonra localStorage'a bak (sayfa reload).
        // İkisi de varsa game.reconnect gönder — GAME_ALREADY_STARTED hatası almayız.
        const savedSession =
          sessionRef.current ||
          (() => {
            try {
              return JSON.parse(localStorage.getItem("quiz_session_" + gameId));
            } catch {
              return null;
            }
          })();

        if (savedSession?.sessionId) {
          if (!sessionRef.current) {
            // localStorage'dan geri yükle — sayfa reload durumu
            sessionRef.current = savedSession;
            setSession(savedSession);
          }
          client.publish({
            destination: "/app/game.reconnect",
            body: JSON.stringify({ gameId, sessionId: savedSession.sessionId }),
          });
          return;
        }

        const sendJoinRequest = () => {
          // browserId: localStorage'daki sabit UUID — IP yerine dedup için kullanılır
          const browserId = localStorage.getItem("quiz_browser_id") || "";
          client.publish({
            destination: "/app/game.join",
            body: JSON.stringify({
              gameId,
              joinCode: gameId,
              nickname,
              browserId,
            }),
          });
        };

        sendJoinRequest();

        let retryCount = 0;
        const MAX_RETRIES = 5;
        retryJoinRef.current = setInterval(() => {
          if (!sessionRef.current) {
            // Lobi bekleme modundaysa sayaç sıfırla — navigate etme
            if (lobbyWaitingRef.current) {
              retryCount = 0;
              sendJoinRequest();
              return;
            }
            retryCount++;
            if (retryCount >= MAX_RETRIES) {
              clearInterval(retryJoinRef.current);
              navigate("/");
              return;
            }
            sendJoinRequest();
          } else {
            clearInterval(retryJoinRef.current);
          }
        }, 2000);
      },
      onStompError: (frame) => {
        if (screenRef.current !== STATES.BANNED) {
          setError(
            `Baglanti hatasi: ${frame.headers?.message || "bilinmiyor"}`,
          );
        }
      },
      onDisconnect: () => {
        if (screenRef.current !== STATES.BANNED) {
          setError("Sunucu baglantisi kesildi. Yeniden baglaniliyor...");
        }
      },
    });

    client.activate();
    stompRef.current = client;

    // Mobil: ekran kilidi/arka plan sonrası sayfa tekrar görünür olunca yeniden bağlan
    const handleVisibilityChange = () => {
      if (!document.hidden && stompRef.current && !stompRef.current.connected) {
        if (screenRef.current !== STATES.BANNED) {
          stompRef.current.activate();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(timerRef.current);
      clearInterval(nextQRef.current);
      clearInterval(countdownRef.current);
      clearInterval(retryJoinRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      client.deactivate();
    };
  }, [gameId, nickname, navigate, handleMessage]);

  const submitAnswer = (answer) => {
    const sess = sessionRef.current;
    // answerSubmittedRef: senkron guard (state async olduğu için iki hızlı tık geçebilir)
    if (!question || answerSubmittedRef.current || !sess) return;
    answerSubmittedRef.current = true;

    const reactionTimeMs = (Date.now() + clockOffsetRef.current) - question.startedAt;
    setSelectedAnswer(answer);

    stompRef.current?.publish({
      destination: "/app/game.answer",
      body: JSON.stringify({
        gameId: sess.gameId,
        questionId: question.questionId,
        sessionId: sess.sessionId,
        answer,
        reactionTimeMs,
      }),
    });
  };

  if (screen === STATES.BANNED) {
    return (
      <PlayerShell>
        <FocusCard accent="rgba(255, 107, 107, 0.45)">
          <CenterStack>
            <StatusCloud tone="danger" />
            <Eyebrow>Katilim sonlandirildi</Eyebrow>
            <HeroTitle>Oyundan cikarildin</HeroTitle>
            <BodyText narrow>{banReason}</BodyText>
            <PrimaryButton
              onClick={() => navigate("/")}
              color="linear-gradient(135deg, #ff8d8d 0%, #ff5d73 100%)"
            >
              Ana sayfaya don
            </PrimaryButton>
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (fatalError) {
    return (
      <PlayerShell>
        <FocusCard accent="rgba(255, 107, 107, 0.45)">
          <CenterStack>
            <StatusCloud tone="danger" image={sadFluffyImage} />
            <Eyebrow>Giriş başarısız</Eyebrow>
            <HeroTitle>Oyuna girilemiyor</HeroTitle>
            <BodyText narrow>{fatalError}</BodyText>
            <div style={{ marginTop: 24 }}>
              <PrimaryButton
                onClick={() => navigate("/")}
                color="linear-gradient(135deg, #ff8d8d 0%, #ff5d73 100%)"
              >
                Geri dön
              </PrimaryButton>
            </div>
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.CONNECTING) {
    if (lobbyWaiting) {
      return (
        <PlayerShell>
          <FocusCard accent="rgba(255, 180, 67, 0.35)">
            <CenterStack>
              <StatusCloud tone="normal" />
              <Eyebrow>Bekliyor</Eyebrow>
              <HeroTitle>Lobi açılıyor</HeroTitle>
              <BodyText narrow>
                Host lobiye izin verdiğinde otomatik olarak gireceksin.
              </BodyText>
              {error && <InlineError style={{ marginTop: 14 }}>{error}</InlineError>}
              <TinyMeta>Her birkaç saniyede bir yeniden deneniyor...</TinyMeta>
            </CenterStack>
          </FocusCard>
        </PlayerShell>
      );
    }

    return (
      <PlayerShell>
        <FocusCard>
          <CenterStack>
            <StatusCloud />
            <Eyebrow>Join in progress</Eyebrow>
            <HeroTitle>Sunucuya baglaniliyor</HeroTitle>
            <BodyText narrow>
              {nickname} olarak <strong>{gameId}</strong> odasina giris
              yapiliyor.
            </BodyText>
            {error && <InlineError>{error}</InlineError>}
            <TinyMeta>
              Kisa bir gecikme olursa istek otomatik tekrar gonderilir.
            </TinyMeta>
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.WAITING) {
    return (
      <PlayerShell>
        <FocusCard>
          <CenterStack>
            <TopBadge>Lobby</TopBadge>
            <HeroTitle>Bekleme odasi</HeroTitle>
            <BodyText narrow>
              Host oyunu baslatana kadar tum oyuncular burada toplanir.
            </BodyText>
            <MetricOrb value={playerCount} label="oyuncu baglandi" />
            <InfoRow>
              <InfoPill label="Kod" value={gameId} />
              <InfoPill label="Sen" value={nickname} />
            </InfoRow>
            {error && <InlineError>{error}</InlineError>}
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.COUNTDOWN) {
    return (
      <PlayerShell>
        <FocusCard accent="rgba(255, 153, 0, 0.32)">
          <CenterStack>
            <TopBadge>Starting</TopBadge>
            <HeroTitle>Hazir ol</HeroTitle>
            <CountdownRing value={countdown} />
            <BodyText narrow>Ilk soru birazdan ekranda olacak.</BodyText>
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.QUESTION && question) {
    return (
      <PlayerShell>
        <QuestionCard style={{ maxWidth: 760, padding: "22px 22px 24px" }}>
          <HeaderRow style={{ marginBottom: 18 }}>
            <MetaPill>
              Soru {question.questionIndex + 1}/{question.totalQuestions}
            </MetaPill>
            <TimerPill
              tone={
                timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "normal"
              }
            >
              <span style={{ opacity: 0.85 }}>⏱</span> {timeLeft}s
            </TimerPill>
            <MetaPill tone="ghost">0 cevap alindi</MetaPill>
          </HeaderRow>

          <TimerTrack
            style={{
              height: 12,
              marginBottom: 24,
              background: "rgba(255,255,255,0.1)",
            }}
          >
            <TimerFill
              tone={
                timeLeft <= 5 ? "danger" : timeLeft <= 10 ? "warn" : "normal"
              }
              style={{ width: `${(timeLeft / question.timerSeconds) * 100}%` }}
            />
          </TimerTrack>

          <QuestionStage>
            <QuestionGlow />
            <QuestionText
              style={{
                fontSize: "clamp(18px, 5.5vw, 46px)",
                textAlign: "center",
                margin: 0,
              }}
            >
              {question.text}
            </QuestionText>
          </QuestionStage>

          <AnswerGrid style={{ marginTop: 22, gap: 14 }}>
            {Object.entries(question.options).map(([key, val]) => (
              <AnswerButton
                key={key}
                onClick={() => submitAnswer(key)}
                disabled={!!selectedAnswer}
                style={{
                  background:
                    selectedAnswer === key
                      ? `linear-gradient(135deg, ${OPT_DARK[key]} 0%, ${OPT[key]} 100%)`
                      : `linear-gradient(135deg, ${OPT[key]} 0%, ${OPT_DARK[key]} 100%)`,
                  opacity: selectedAnswer && selectedAnswer !== key ? 0.38 : 1,
                  borderColor:
                    selectedAnswer === key
                      ? "rgba(255,255,255,0.92)"
                      : "rgba(255,255,255,0.08)",
                }}
              >
                <AnswerKey>{key}</AnswerKey>
                <AnswerLabel>{val}</AnswerLabel>
              </AnswerButton>
            ))}
          </AnswerGrid>

          {error && <InlineError>{error}</InlineError>}
        </QuestionCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.ANSWER_RECEIVED) {
    return (
      <PlayerShell>
        <FocusCard accent="rgba(68, 209, 141, 0.28)">
          <CenterStack>
            <StatusCloud tone="success" />
            <Eyebrow>Submission locked</Eyebrow>
            <HeroTitle>Cevabın alındı</HeroTitle>
            {streak >= 2 && (
              <div
                style={{
                  marginTop: 12,
                  background:
                    "linear-gradient(135deg, #f7971e 0%, #ffd200 100%)",
                  borderRadius: 20,
                  padding: "8px 20px",
                  fontWeight: 800,
                  fontSize: 15,
                  color: "#fff",
                  letterSpacing: 1,
                  textShadow: "0 1px 3px rgba(0,0,0,0.25)",
                }}
              >
                {streak >= 3
                  ? "🔥 " + streak + " STREAK! +200 bonus"
                  : "⚡ 2 STREAK! +100 bonus"}
              </div>
            )}
            <BodyText narrow>Diger oyuncularin cevaplari bekleniyor.</BodyText>
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.QUESTION_END && questionEnd) {
    const max = Math.max(1, ...Object.values(questionEnd.answerDistribution));

    return (
      <PlayerShell>
        <QuestionCard>
          <HeaderRow>
            <MetaPill>Sure doldu</MetaPill>
            <MetaPill tone="accent">
              Doğru cevap: {questionEnd.correctAnswer}
            </MetaPill>
          </HeaderRow>

          <QuestionText small>Cevap dagilimi</QuestionText>

          <DistributionList>
            {["A", "B", "C", "D"].map((key) => {
              const count = questionEnd.answerDistribution[key] || 0;
              return (
                <DistributionRow key={key}>
                  <DistributionKey style={{ color: OPT[key] }}>
                    {key}
                  </DistributionKey>
                  <DistributionTrack>
                    <DistributionBar
                      style={{
                        width: `${(count / max) * 100}%`,
                        background:
                          key === questionEnd.correctAnswer
                            ? "#44D18D"
                            : OPT[key],
                        minWidth: count > 0 ? 34 : 0,
                      }}
                    >
                      {count > 0 ? count : ""}
                    </DistributionBar>
                  </DistributionTrack>
                  <DistributionCount>{count}</DistributionCount>
                </DistributionRow>
              );
            })}
          </DistributionList>
        </QuestionCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.ANSWER_REVEAL && answerReveal) {
    return (
      <PlayerShell>
        <FocusCard
          accent={
            answerReveal.isCorrect
              ? "rgba(68, 209, 141, 0.26)"
              : "rgba(255, 107, 107, 0.24)"
          }
        >
          <CenterStack>
            <StatusCloud
              tone={answerReveal.isCorrect ? "success" : "danger"}
              image={answerReveal.isCorrect ? happyFluffyImage : sadFluffyImage}
            />
            <Eyebrow>
              {answerReveal.isCorrect ? "Great hit" : "Next round"}
            </Eyebrow>
            <HeroTitle>
              {answerReveal.isCorrect ? "Doğru cevap" : "Bu tur olmadı"}
            </HeroTitle>
            <InfoRow centered>
              <InfoPill
                label="Senin cevabın"
                value={answerReveal.yourAnswer || "-"}
                accent={OPT[answerReveal.yourAnswer] || "#dbe8ff"}
              />
              <InfoPill
                label="Doğru cevap"
                value={answerReveal.correctAnswer}
                accent={OPT[answerReveal.correctAnswer]}
              />
            </InfoRow>
            {answerReveal.isCorrect && (
              <ScoreBurst>+{answerReveal.pointsEarned} puan</ScoreBurst>
            )}
          </CenterStack>
        </FocusCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.SCORE_REVEAL && scoreReveal) {
    return (
      <PlayerShell>
        <QuestionCard>
          <HeaderRow>
            <MetaPill>Skor tablosu</MetaPill>
            {scoreReveal.nextQuestionAt > 0 && (
              <TimerPill tone="normal">
                Sonraki soru: {nextQCountdown}s
              </TimerPill>
            )}
          </HeaderRow>

          <ScorePanel>
            <ScoreMain>{scoreReveal.totalScore}</ScoreMain>
            <ScoreSub>
              Siran: {scoreReveal.myRank > 0 ? `#${scoreReveal.myRank}` : "-"} /{" "}
              {scoreReveal.totalPlayers}
            </ScoreSub>
            <ScoreChange>Bu tur +{scoreReveal.pointsEarned}</ScoreChange>
          </ScorePanel>

          <ListTitle>Top 10</ListTitle>
          <LeaderboardList>
            {scoreReveal.top10.length === 0 ? (
              <MutedText>Henuz siralama yok.</MutedText>
            ) : (
              scoreReveal.top10.map((p, i) => (
                <LeaderboardRow
                  key={`${p.userId}-${i}`}
                  style={{
                    background:
                      i < 3
                        ? "rgba(255,255,255,0.16)"
                        : "rgba(255,255,255,0.08)",
                  }}
                >
                  <LeaderboardLeft>
                    <LeaderboardRank>
                      {MEDALS[i] || `${p.rank}.`}
                    </LeaderboardRank>
                    <span>{p.nickname || p.userId}</span>
                  </LeaderboardLeft>
                  <strong>{p.score}</strong>
                </LeaderboardRow>
              ))
            )}
          </LeaderboardList>
        </QuestionCard>
      </PlayerShell>
    );
  }

  if (screen === STATES.FINISHED && gameFinished) {
    return (
      <PlayerShell>
        <QuestionCard>
          <CenterStack>
            <TopBadge>Final</TopBadge>
            <HeroTitle>Oyun bitti</HeroTitle>
            <BodyText narrow>Final liderlik tablosu asagida.</BodyText>
          </CenterStack>

          <LeaderboardList style={{ marginTop: 24 }}>
            {gameFinished.top5.map((p, i) => (
              <LeaderboardRow
                key={`${p.userId}-${i}`}
                style={{
                  background:
                    i < 3 ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.08)",
                }}
              >
                <LeaderboardLeft>
                  <LeaderboardRank>{MEDALS[i] || `${i + 1}.`}</LeaderboardRank>
                  <span>{p.nickname || p.userId}</span>
                </LeaderboardLeft>
                <strong>{p.score}</strong>
              </LeaderboardRow>
            ))}
          </LeaderboardList>

          <CenterStack style={{ marginTop: 24 }}>
            <PrimaryButton
              onClick={() => navigate("/")}
              color="linear-gradient(135deg, #5cc6ff 0%, #416eff 100%)"
            >
              Ana sayfa
            </PrimaryButton>
          </CenterStack>
        </QuestionCard>
      </PlayerShell>
    );
  }

  return null;
}

function PlayerShell({ children }) {
  return (
    <div style={shellStyle}>
      <div style={glowStyle("8%", "12%", 320, "rgba(131, 80, 255, 0.24)")} />
      <div style={glowStyle("58%", "84%", 260, "rgba(54, 173, 255, 0.18)")} />
      <div style={glowStyle("78%", "16%", 240, "rgba(255, 153, 0, 0.12)")} />

      <div style={starsLayerStyle}>
        <span style={starStyle("8%", "12%", 18)}>✦</span>
        <span style={starStyle("12%", "78%", 14)}>✦</span>
        <span style={starStyle("36%", "90%", 16)}>✦</span>
        <span style={starStyle("72%", "10%", 15)}>✦</span>
        <span style={starStyle("84%", "80%", 18)}>✦</span>
      </div>

      <div style={shellContentStyle}>{children}</div>
    </div>
  );
}

function FocusCard({ children, accent = "rgba(255,255,255,0.14)" }) {
  return (
    <div
      style={{
        ...cardStyle,
        border: `1px solid ${accent}`,
        boxShadow: `0 28px 70px rgba(7, 3, 30, 0.42), 0 0 0 1px ${accent} inset`,
      }}
    >
      {children}
    </div>
  );
}

function QuestionCard({ children, style }) {
  return (
    <div
      style={{
        ...cardStyle,
        padding: "24px 22px 26px",
        ...(style || {}),
      }}
    >
      {children}
    </div>
  );
}

function StatusCloud({ tone = "normal", image = fluffyImage }) {
  const toneGlow = {
    normal: "rgba(92,198,255,0.26)",
    success: "rgba(68,209,141,0.26)",
    danger: "rgba(255,107,107,0.24)",
  };

  return (
    <div
      style={{
        width: 96,
        height: 96,
        borderRadius: 28,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.08)",
        boxShadow: `0 18px 38px ${toneGlow[tone]}`,
        marginBottom: 8,
      }}
    >
      <img
        src={image}
        alt="Fluffy"
        style={{ width: 76, height: 76, objectFit: "contain" }}
      />
    </div>
  );
}

function CountdownRing({ value }) {
  return (
    <div
      style={{
        width: "clamp(130px, 42vw, 180px)",
        height: "clamp(130px, 42vw, 180px)",
        borderRadius: "50%",
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.20), rgba(255,255,255,0.06))",
        boxShadow: "0 24px 60px rgba(10, 4, 38, 0.38)",
        margin: "10px 0 6px",
      }}
    >
      <div
        style={{
          width: "clamp(100px, 32vw, 138px)",
          height: "clamp(100px, 32vw, 138px)",
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          background:
            "linear-gradient(180deg, rgba(255,153,0,0.30), rgba(255,255,255,0.08))",
          color: "#fff",
          fontSize: "clamp(48px, 13vw, 72px)",
          fontWeight: 900,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function MetricOrb({ value, label }) {
  return (
    <div
      style={{
        width: "clamp(150px, 48vw, 210px)",
        height: "clamp(150px, 48vw, 210px)",
        borderRadius: "50%",
        background:
          "radial-gradient(circle at 30% 30%, rgba(109, 196, 255, 0.34), rgba(255,255,255,0.06))",
        boxShadow: "0 26px 60px rgba(8, 4, 34, 0.38)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        margin: "10px 0 6px",
      }}
    >
      <div
        style={{
          fontSize: "clamp(48px, 12vw, 70px)",
          fontWeight: 900,
          lineHeight: 1,
          color: "#fff",
        }}
      >
        {value}
      </div>
      <div
        style={{
          marginTop: 8,
          color: "rgba(232,239,255,0.72)",
          fontSize: 14,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function PrimaryButton({ children, onClick, color }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "14px 26px",
        borderRadius: 16,
        border: "none",
        background: color,
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: "0 18px 34px rgba(15, 9, 52, 0.28)",
      }}
    >
      {children}
    </button>
  );
}

const shellStyle = {
  minHeight: "100vh",
  position: "relative",
  overflow: "hidden",
  background: "linear-gradient(140deg, #14042d 0%, #2a0a50 45%, #491487 100%)",
  color: "#fff",
};

const shellContentStyle = {
  position: "relative",
  zIndex: 1,
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "24px 16px 32px",
};

const cardStyle = {
  width: "100%",
  maxWidth: 540,
  borderRadius: 32,
  padding: "28px 22px 30px",
  background:
    "linear-gradient(180deg, rgba(18, 10, 49, 0.88), rgba(43, 18, 78, 0.86))",
  border: "1px solid rgba(255,255,255,0.14)",
  boxShadow: "0 28px 70px rgba(7, 3, 30, 0.42)",
  backdropFilter: "blur(18px)",
};

const starsLayerStyle = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
};

const HeaderRow = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      marginBottom: 14,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const CenterStack = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      textAlign: "center",
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const Eyebrow = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      color: "#ffbf66",
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      marginBottom: 10,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const HeroTitle = ({ children, style, ...props }) => (
  <h1
    {...props}
    style={{
      fontSize: "clamp(34px, 8vw, 58px)",
      lineHeight: 0.95,
      letterSpacing: "-0.05em",
      fontWeight: 900,
      margin: 0,
      ...(style || {}),
    }}
  >
    {children}
  </h1>
);
const BodyText = ({ children, narrow, style, ...props }) => (
  <p
    {...props}
    style={{
      maxWidth: narrow ? 360 : "none",
      margin: "16px 0 0",
      color: "rgba(232,239,255,0.78)",
      fontSize: 17,
      lineHeight: 1.65,
      fontWeight: 600,
      ...(style || {}),
    }}
  >
    {children}
  </p>
);
const TinyMeta = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      marginTop: 18,
      color: "rgba(225,233,255,0.52)",
      fontSize: 13,
      fontWeight: 700,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const InlineError = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      marginTop: 18,
      padding: "12px 14px",
      borderRadius: 14,
      background: "rgba(255, 107, 107, 0.14)",
      border: "1px solid rgba(255, 107, 107, 0.24)",
      color: "#ffd0d6",
      fontSize: 14,
      fontWeight: 700,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const TopBadge = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      padding: "8px 14px",
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      color: "#f4f7ff",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.16em",
      textTransform: "uppercase",
      marginBottom: 18,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const InfoRow = ({ children, centered, style, ...props }) => (
  <div
    {...props}
    style={{
      marginTop: 18,
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      justifyContent: centered ? "center" : "flex-start",
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const MetaPill = ({ children, tone, style, ...props }) => (
  <div
    {...props}
    style={{
      padding: "8px 12px",
      borderRadius: 999,
      background:
        tone === "accent"
          ? "rgba(255, 153, 0, 0.16)"
          : "rgba(255,255,255,0.08)",
      color: "#eef4ff",
      fontSize: 12,
      fontWeight: 800,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const TimerTrack = ({ children, style, ...props }) => (
  <div
    {...props}
    style={{
      width: "100%",
      height: 10,
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden",
      marginBottom: 20,
      ...(style || {}),
    }}
  >
    {children}
  </div>
);
const TimerFill = ({ tone, ...props }) => (
  <div
    {...props}
    style={{
      height: "100%",
      borderRadius: 999,
      background:
        tone === "danger" ? "#FF6B6B" : tone === "warn" ? "#FFB443" : "#48A7FF",
      transition: "width 0.2s ease",
      ...(props.style || {}),
    }}
  />
);
const QuestionText = ({ children, small, style, ...props }) => (
  <h2
    {...props}
    style={{
      fontSize: small ? 24 : 28,
      lineHeight: 1.12,
      letterSpacing: "-0.04em",
      margin: "0 0 20px",
      fontWeight: 900,
      ...(style || {}),
    }}
  >
    {children}
  </h2>
);
const AnswerGrid = (props) => (
  <div
    {...props}
    style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 12,
      ...(props.style || {}),
    }}
  />
);
const AnswerButton = (props) => (
  <button
    {...props}
    style={{
      minHeight: "clamp(72px, 18vw, 116px)",
      padding: "clamp(10px, 2.5vw, 20px) clamp(10px, 2.5vw, 16px)",
      borderRadius: 18,
      border: "1px solid transparent",
      color: "#fff",
      textAlign: "left",
      boxShadow: "0 18px 34px rgba(8, 4, 34, 0.24)",
      transition: "transform 0.16s ease, opacity 0.16s ease",
      touchAction: "manipulation",
      ...(props.style || {}),
    }}
  />
);
const AnswerKey = (props) => (
  <div
    {...props}
    style={{
      fontSize: "clamp(16px, 5vw, 28px)",
      fontWeight: 900,
      letterSpacing: "-0.03em",
      marginBottom: 6,
      opacity: 0.98,
      ...(props.style || {}),
    }}
  />
);
const AnswerLabel = (props) => (
  <div
    {...props}
    style={{
      fontSize: "clamp(12px, 3.5vw, 22px)",
      lineHeight: 1.2,
      fontWeight: 700,
      ...(props.style || {}),
    }}
  />
);
const DistributionList = (props) => (
  <div
    {...props}
    style={{ display: "grid", gap: 10, ...(props.style || {}) }}
  />
);
const DistributionRow = (props) => (
  <div
    {...props}
    style={{
      display: "grid",
      gridTemplateColumns: "30px 1fr 34px",
      alignItems: "center",
      gap: 10,
      ...(props.style || {}),
    }}
  />
);
const DistributionKey = (props) => (
  <div
    {...props}
    style={{ fontSize: 18, fontWeight: 900, ...(props.style || {}) }}
  />
);
const DistributionTrack = (props) => (
  <div
    {...props}
    style={{
      height: 28,
      borderRadius: 999,
      background: "rgba(255,255,255,0.08)",
      overflow: "hidden",
      ...(props.style || {}),
    }}
  />
);
const DistributionBar = (props) => (
  <div
    {...props}
    style={{
      height: "100%",
      borderRadius: 999,
      display: "flex",
      alignItems: "center",
      paddingLeft: 10,
      color: "#fff",
      fontWeight: 800,
      fontSize: 13,
      transition: "width 0.5s ease",
      ...(props.style || {}),
    }}
  />
);
const DistributionCount = (props) => (
  <div
    {...props}
    style={{
      color: "rgba(232,239,255,0.72)",
      fontWeight: 700,
      fontSize: 13,
      textAlign: "right",
      ...(props.style || {}),
    }}
  />
);
const ScoreBurst = (props) => (
  <div
    {...props}
    style={{
      marginTop: 18,
      fontSize: 36,
      fontWeight: 900,
      color: "#FFB443",
      ...(props.style || {}),
    }}
  />
);
const ScorePanel = (props) => (
  <div
    {...props}
    style={{
      margin: "8px 0 22px",
      padding: "22px 18px",
      borderRadius: 24,
      background: "rgba(255,255,255,0.08)",
      textAlign: "center",
      ...(props.style || {}),
    }}
  />
);
const ScoreMain = (props) => (
  <div
    {...props}
    style={{
      fontSize: "clamp(38px, 10vw, 58px)",
      lineHeight: 1,
      fontWeight: 900,
      ...(props.style || {}),
    }}
  />
);
const ScoreSub = (props) => (
  <div
    {...props}
    style={{
      marginTop: 10,
      color: "rgba(232,239,255,0.76)",
      fontSize: 16,
      fontWeight: 700,
      ...(props.style || {}),
    }}
  />
);
const ScoreChange = (props) => (
  <div
    {...props}
    style={{
      marginTop: 8,
      color: "#ffbf66",
      fontSize: 15,
      fontWeight: 800,
      ...(props.style || {}),
    }}
  />
);
const ListTitle = ({ children, style, ...props }) => (
  <h3
    {...props}
    style={{
      margin: "0 0 12px",
      fontSize: 22,
      fontWeight: 900,
      ...(style || {}),
    }}
  >
    {children}
  </h3>
);
const LeaderboardList = (props) => (
  <div {...props} style={{ display: "grid", gap: 8, ...(props.style || {}) }} />
);
const LeaderboardRow = (props) => (
  <div
    {...props}
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      borderRadius: 16,
      padding: "14px 16px",
      ...(props.style || {}),
    }}
  />
);
const LeaderboardLeft = (props) => (
  <div
    {...props}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      minWidth: 0,
      ...(props.style || {}),
    }}
  />
);
const LeaderboardRank = (props) => (
  <span
    {...props}
    style={{ width: 28, textAlign: "center", ...(props.style || {}) }}
  />
);
const MutedText = (props) => (
  <div
    {...props}
    style={{
      color: "rgba(232,239,255,0.62)",
      fontSize: 15,
      fontWeight: 700,
      ...(props.style || {}),
    }}
  />
);
const QuestionStage = (props) => (
  <div
    {...props}
    style={{
      position: "relative",
      padding: "22px 18px 18px",
      borderRadius: 28,
      background:
        "linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.02))",
      border: "1px solid rgba(255,255,255,0.08)",
      overflow: "hidden",
      ...(props.style || {}),
    }}
  />
);
const QuestionGlow = () => (
  <div
    style={{
      position: "absolute",
      inset: "-20% auto auto 50%",
      width: 220,
      height: 220,
      transform: "translateX(-50%)",
      background:
        "radial-gradient(circle, rgba(117, 194, 255, 0.16) 0%, rgba(0,0,0,0) 70%)",
      pointerEvents: "none",
    }}
  />
);

function InfoPill({ label, value, accent = "#eef4ff" }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: 16,
        background: "rgba(255,255,255,0.08)",
        minWidth: 120,
      }}
    >
      <div
        style={{
          color: "rgba(222,230,255,0.58)",
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 6,
          color: accent,
          fontSize: 18,
          fontWeight: 900,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TimerPill({ tone, ...props }) {
  const background =
    tone === "danger"
      ? "rgba(255, 107, 107, 0.18)"
      : tone === "warn"
        ? "rgba(255, 180, 67, 0.18)"
        : "rgba(72, 167, 255, 0.18)";

  return (
    <div
      {...props}
      style={{
        padding: "8px 12px",
        borderRadius: 999,
        background,
        color: "#fff",
        fontSize: 14,
        fontWeight: 900,
        ...(props.style || {}),
      }}
    />
  );
}

function glowStyle(top, left, size, color) {
  return {
    position: "absolute",
    top,
    left,
    width: size,
    height: size,
    borderRadius: "50%",
    background: `radial-gradient(circle, ${color} 0%, rgba(0,0,0,0) 70%)`,
    filter: "blur(18px)",
    pointerEvents: "none",
  };
}

function starStyle(top, left, size) {
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
