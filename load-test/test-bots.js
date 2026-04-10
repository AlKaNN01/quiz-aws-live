/**
 * Quiz Load Test — 200 Bot Senaryosu
 *
 * Senaryo:
 *  1. Admin login → token al
 *  2. 10 sorulu oyun oluştur → publish et → joinCode al
 *  3. 200 bot WebSocket bağlantısı kur → oyuna katıl
 *  4. Admin WebSocket → oyunu başlat
 *  5. Her soruda botlar rastgele cevap verir (2-18s arası)
 *  6. Admin her LEADERBOARD_PENDING'i otomatik onaylar
 *  7. GAME_FINISHED sonrası istatistik raporu yaz
 *
 * Kullanım:
 *   npm install
 *   node test-bots.js
 *   BOT_COUNT=50 node test-bots.js   (hızlı test)
 */

'use strict';

const { Client } = require('@stomp/stompjs');
const WebSocket  = require('ws');

// ─── Konfigürasyon ──────────────────────────────────────────────────────────

const CFG = {
  // Servis URL'leri (GameAdmin ve GameEngine portları docker-compose.local.yml'de expose edildi)
  apiUrl:    process.env.API_URL    || 'http://localhost:8081',
  wsUrl:     process.env.WS_URL     || 'ws://localhost:8080/ws/websocket',

  // Admin kullanıcı (.env.local'daki ADMIN_PASSWORD ile eşleşmeli)
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'TestAdmin123!',

  // Test parametreleri
  botCount:       parseInt(process.env.BOT_COUNT       || '200'),
  questionCount:  parseInt(process.env.QUESTION_COUNT  || '10'),
  timerSeconds:   parseInt(process.env.TIMER_SECONDS   || '20'),

  // Botları stagger etmek için gruplar
  botBatchSize:  20,   // Her grupta kaç bot
  batchDelayMs:  150,  // Gruplar arası bekleme (ms)

  // SockJS Origin başlığı — ALLOWED_ORIGINS'de tanımlı olmalı
  wsOrigin: 'http://localhost',
};

// ─── Yardımcı araçlar ────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = {
  info:  (...a) => console.log(`[${ts()}] ℹ`, ...a),
  ok:    (...a) => console.log(`[${ts()}] ✓`, ...a),
  warn:  (...a) => console.warn(`[${ts()}] ⚠`, ...a),
  error: (...a) => console.error(`[${ts()}] ✗`, ...a),
  sep:   ()     => console.log('─'.repeat(60)),
};

function ts() {
  return new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
}

// ─── HTTP yardımcısı ─────────────────────────────────────────────────────────

async function api(method, path, token = null, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${CFG.apiUrl}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${method} ${path}: ${text}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// ─── STOMP istemci fabrikası ─────────────────────────────────────────────────

function makeStompClient(onConnect, onMessage, label = '') {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`STOMP bağlantı zaman aşımı: ${label}`)), 15_000);

    const client = new Client({
      // SockJS'un raw WebSocket endpoint'i — /ws/websocket
      webSocketFactory: () => new WebSocket(CFG.wsUrl, {
        headers: { Origin: CFG.wsOrigin },
      }),
      reconnectDelay: 0, // bot testinde yeniden bağlanma istemiyoruz
      onConnect: (frame) => {
        clearTimeout(timeout);
        onConnect(client, frame);
        resolve(client);
      },
      onStompError: (frame) => {
        clearTimeout(timeout);
        reject(new Error(`STOMP hata (${label}): ${frame.headers?.message}`));
      },
      onDisconnect: () => {
        // sessizce kapat
      },
      // @stomp/stompjs v7 — loglama kapat
      debug: () => {},
    });

    client.activate();

    // Mesaj handler'ı client'a ekle
    client._onMessage = onMessage;
  });
}

// ─── İstatistikler ───────────────────────────────────────────────────────────

const stats = {
  botsConnected:   0,
  botsJoined:      0,
  botsJoinFailed:  0,
  answersSubmitted: 0,
  answersCorrect:  0,
  gameFinishedAt:  null,
  questionTimes:   [], // her soru için ortalama cevap süresi
  errors:          [],
};

// ─── AŞAMA 1: Kurulum (REST API) ─────────────────────────────────────────────

async function setupGame(token) {
  log.info('Oyun oluşturuluyor...');
  const game = await api('POST', '/api/games', token, { title: 'Bot Load Test' });
  log.ok(`Oyun oluşturuldu: id=${game.id}`);

  log.info(`${CFG.questionCount} soru ekleniyor...`);
  for (let i = 0; i < CFG.questionCount; i++) {
    await api('POST', `/api/games/${game.id}/questions`, token, {
      text:          `Soru ${i + 1}: Aşağıdakilerden hangisi doğrudur?`,
      optionA:       'Bu seçenek doğru',   // Her zaman A doğru → botlar rastgele seçer
      optionB:       'Bu seçenek yanlış 1',
      optionC:       'Bu seçenek yanlış 2',
      optionD:       'Bu seçenek yanlış 3',
      correctAnswer: 'A',
      timerSeconds:  CFG.timerSeconds,
      orderIndex:    i,
    });
  }
  log.ok(`${CFG.questionCount} soru eklendi`);

  log.info('Oyun yayına alınıyor...');
  const published = await api('POST', `/api/games/${game.id}/publish`, token);
  log.ok(`Yayında: joinCode=${published.joinCode}`);

  return published;
}

// ─── AŞAMA 2: Bot istemcileri ─────────────────────────────────────────────────

function createBotClient(botIndex, joinCode) {
  return new Promise((resolve) => {
    const nickname = `Bot${String(botIndex + 1).padStart(3, '0')}`;
    let sessionData = null;
    let currentQuestion = null;
    let client;

    const onConnect = (c) => {
      client = c;
      stats.botsConnected++;

      // Abonelikler
      // 1. Kişisel mesajlar: JOIN_ACK, ANSWER_RECEIVED, ANSWER_REVEAL, SCORE_REVEAL
      c.subscribe('/user/queue/personal', (msg) => {
        try { handleBotMessage(JSON.parse(msg.body)); }
        catch (e) { /* parse hatası — yoksay */ }
      });

      // 2. Oyun broadcast: GAME_STARTED, QUESTION_START, QUESTION_END, SCORE_REVEAL, GAME_FINISHED
      c.subscribe(`/topic/game/${joinCode}`, (msg) => {
        try { handleBotMessage(JSON.parse(msg.body)); }
        catch (e) { /* yoksay */ }
      });

      // 3. Lobi: WAITING_ROOM_UPDATE
      c.subscribe(`/topic/game/${joinCode}/lobby`, () => { /* sayaç güncelleme, önemli değil */ });

      // Oyuna katıl
      c.publish({
        destination: '/app/game.join',
        body: JSON.stringify({ gameId: joinCode, joinCode, nickname }),
      });
    };

    const handleBotMessage = (msg) => {
      switch (msg.type) {
        case 'JOIN_ACK':
          if (msg.success) {
            sessionData = { sessionId: msg.sessionId, userId: msg.userId };
            stats.botsJoined++;
          } else {
            stats.botsJoinFailed++;
            stats.errors.push(`${nickname}: join red — ${msg.message}`);
          }
          break;

        case 'QUESTION_START': {
          currentQuestion = msg;
          if (!sessionData) break; // join olmadıysa cevap verme

          // Rastgele gecikme: 1s – (timerSeconds-2)s arası
          const maxDelay = (CFG.timerSeconds - 2) * 1000;
          const delay    = 1000 + Math.floor(Math.random() * maxDelay);
          const answers  = ['A', 'B', 'C', 'D'];
          const answer   = answers[Math.floor(Math.random() * 4)];

          setTimeout(() => {
            if (!client?.connected || !sessionData) return;
            client.publish({
              destination: '/app/game.answer',
              body: JSON.stringify({
                gameId:        joinCode,
                questionId:    msg.questionId,
                sessionId:     sessionData.sessionId,
                answer,
                reactionTimeMs: delay,
              }),
            });
            stats.answersSubmitted++;
            if (answer === 'A') stats.answersCorrect++; // A her zaman doğru
          }, delay);
          break;
        }

        case 'GAME_FINISHED':
          stats.gameFinishedAt = Date.now();
          // Bağlantıyı temizce kapat
          setTimeout(() => client?.deactivate(), 500);
          break;

        case 'ERROR_MESSAGE':
          stats.errors.push(`${nickname}: ${msg.message}`);
          break;
      }
    };

    makeStompClient(onConnect, handleBotMessage, nickname)
      .then(() => resolve({ nickname, getClient: () => client }))
      .catch((err) => {
        stats.botsJoinFailed++;
        stats.errors.push(`${nickname}: bağlantı hatası — ${err.message}`);
        resolve(null); // Hata olsa bile devam et
      });
  });
}

async function spawnBots(joinCode) {
  log.info(`${CFG.botCount} bot bağlanıyor (${CFG.botBatchSize}'li gruplar)...`);
  const allBots = [];

  for (let i = 0; i < CFG.botCount; i += CFG.botBatchSize) {
    const batchEnd  = Math.min(i + CFG.botBatchSize, CFG.botCount);
    const batchNums = Array.from({ length: batchEnd - i }, (_, k) => i + k);

    const batch = await Promise.all(batchNums.map((idx) => createBotClient(idx, joinCode)));
    allBots.push(...batch.filter(Boolean));

    // Gruplar arası bekleme — sunucuya nefes aldır
    if (batchEnd < CFG.botCount) await sleep(CFG.batchDelayMs);

    process.stdout.write(`\r   Bağlanan: ${stats.botsConnected}/${CFG.botCount}  `);
  }

  console.log(); // satır sonu
  await sleep(1000); // JOIN mesajlarının işlenmesi için

  log.ok(`Bağlanan: ${stats.botsConnected}  Katılan: ${stats.botsJoined}  Hata: ${stats.botsJoinFailed}`);
  return allBots;
}

// ─── AŞAMA 3: Admin / Host istemcisi ─────────────────────────────────────────

function createAdminClient(token, joinCode) {
  return new Promise((resolve, reject) => {
    let adminClient;
    let questionsApproved = 0;

    const onConnect = (c) => {
      adminClient = c;

      // Kişisel admin kuyruğu — LEADERBOARD_PENDING burada gelir
      c.subscribe('/user/queue/admin', (msg) => {
        try { handleAdminMessage(c, JSON.parse(msg.body)); }
        catch (e) { /* yoksay */ }
      });

      // Host topic — GAME_STARTED, QUESTION_START, LEADERBOARD_PENDING, SCORE_REVEAL, GAME_FINISHED
      c.subscribe(`/topic/game/${joinCode}/host`, (msg) => {
        try { handleAdminMessage(c, JSON.parse(msg.body)); }
        catch (e) { /* yoksay */ }
      });
    };

    const handleAdminMessage = (c, msg) => {
      switch (msg.type) {
        case 'LEADERBOARD_PENDING':
          // Anında onayla — 30s timeout'u beklemeden
          c.publish({
            destination: '/app/admin.leaderboard.approve',
            body: JSON.stringify({
              adminToken: token,
              gameId:     joinCode,
              questionId: msg.questionId,
            }),
          });
          questionsApproved++;
          log.info(`Leaderboard onaylandı: soru ${questionsApproved}/${CFG.questionCount}`);
          break;

        case 'GAME_FINISHED':
          log.ok('Admin: GAME_FINISHED alındı');
          stats.gameFinishedAt = stats.gameFinishedAt || Date.now();
          break;
      }
    };

    makeStompClient(onConnect, () => {}, 'admin')
      .then(() => resolve(adminClient))
      .catch(reject);
  });
}

// ─── AŞAMA 4: Oyun sonuç doğrulama ──────────────────────────────────────────

async function verifyResults(token, joinCode) {
  try {
    const results = await api('GET', `/api/games/${joinCode}/results`, token);
    log.ok(`PostgreSQL'de kayıtlı oyuncu sonucu: ${results.length}`);
    if (results.length > 0) {
      const top3 = results.slice(0, 3);
      log.info('İlk 3 sıralama:');
      top3.forEach((r) => {
        console.log(`   #${r.rank}  ${r.nickname.padEnd(12)} ${r.totalScore} puan`);
      });
    }
    return results.length;
  } catch (e) {
    log.warn(`Sonuç doğrulama hatası: ${e.message}`);
    return 0;
  }
}

// ─── ANA AKIŞ ────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();

  log.sep();
  console.log('  Quiz Bot Load Test');
  console.log(`  Bot sayısı   : ${CFG.botCount}`);
  console.log(`  Soru sayısı  : ${CFG.questionCount}`);
  console.log(`  Soru süresi  : ${CFG.timerSeconds}s`);
  console.log(`  API          : ${CFG.apiUrl}`);
  console.log(`  WebSocket    : ${CFG.wsUrl}`);
  log.sep();
  console.log();

  // ── 1. Login ─────────────────────────────────────────────
  log.info('Admin girişi yapılıyor...');
  const { token } = await api('POST', '/api/auth/login', null, {
    username: CFG.adminUser,
    password: CFG.adminPass,
  });
  log.ok('Token alındı');
  console.log();

  // ── 2. Oyun kurulumu ─────────────────────────────────────
  log.sep();
  log.info('AŞAMA 1 — Oyun kurulumu');
  log.sep();
  const game = await setupGame(token);
  const joinCode = game.joinCode;
  console.log();

  // ── 3. Botları bağla ─────────────────────────────────────
  log.sep();
  log.info('AŞAMA 2 — Botlar bağlanıyor');
  log.sep();
  await spawnBots(joinCode);
  console.log();

  // ── 4. Admin bağlan ──────────────────────────────────────
  log.sep();
  log.info('AŞAMA 3 — Admin bağlanıyor');
  log.sep();
  const adminClient = await createAdminClient(token, joinCode);
  log.ok('Admin WebSocket bağlı');

  // ── 5. Oyunu başlat ──────────────────────────────────────
  await sleep(500);
  log.info('Oyun başlatılıyor...');
  adminClient.publish({
    destination: '/app/admin.start',
    body: JSON.stringify({ adminToken: token, joinCode }),
  });
  log.ok('admin.start gönderildi');
  console.log();

  // ── 6. Oyunun bitmesini bekle ─────────────────────────────
  log.sep();
  log.info('AŞAMA 4 — Oyun oynuyor...');
  log.sep();

  // Maksimum bekleme: (timerSaniye + onay süresi + geri sayım) × soru sayısı + buffer
  const maxWaitMs = (CFG.timerSeconds + 8 + 6) * CFG.questionCount * 1000 + 30_000;
  const checkInterval = 5_000;
  let waited = 0;

  while (!stats.gameFinishedAt && waited < maxWaitMs) {
    await sleep(checkInterval);
    waited += checkInterval;
    const progress = Math.min(100, Math.round((waited / maxWaitMs) * 100));
    process.stdout.write(
      `\r   Bekleniyor: ${(waited / 1000).toFixed(0)}s / ${(maxWaitMs / 1000).toFixed(0)}s` +
      `  Cevap: ${stats.answersSubmitted}  [${progress}%]  `
    );
  }
  console.log();

  if (!stats.gameFinishedAt) {
    log.warn('Oyun beklenen sürede bitmedi!');
  } else {
    log.ok(`Oyun bitti (süre: ${((stats.gameFinishedAt - startedAt) / 1000).toFixed(1)}s)`);
  }
  console.log();

  // ── 7. Sonuçları doğrula ──────────────────────────────────
  log.sep();
  log.info('AŞAMA 5 — Sonuçlar doğrulanıyor');
  log.sep();
  await sleep(2000); // GameAdmin'e kaydedilmesi için
  const savedCount = await verifyResults(token, joinCode);
  console.log();

  // ── 8. Rapor ──────────────────────────────────────────────
  const totalMs = Date.now() - startedAt;
  log.sep();
  console.log('  TEST RAPORU');
  log.sep();
  console.log(`  Bot hedef        : ${CFG.botCount}`);
  console.log(`  WebSocket bağlı  : ${stats.botsConnected}`);
  console.log(`  Oyuna katılan    : ${stats.botsJoined}`);
  console.log(`  Katılım hatası   : ${stats.botsJoinFailed}`);
  console.log('');
  console.log(`  Toplam cevap     : ${stats.answersSubmitted}`);
  console.log(`  Doğru cevap      : ${stats.answersCorrect}`);
  const expectedAnswers = stats.botsJoined * CFG.questionCount;
  const answerRate = expectedAnswers > 0
    ? ((stats.answersSubmitted / expectedAnswers) * 100).toFixed(1)
    : 0;
  console.log(`  Cevap oranı      : %${answerRate} (${stats.answersSubmitted}/${expectedAnswers} beklenen)`);
  console.log('');
  console.log(`  DB'ye kaydedilen : ${savedCount}`);
  console.log(`  Toplam süre      : ${(totalMs / 1000).toFixed(1)}s`);
  log.sep();

  if (stats.errors.length > 0) {
    console.log(`\n  Hatalar (ilk 10):`);
    stats.errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`   ... ve ${stats.errors.length - 10} hata daha`);
    }
  }

  // Bağlantıları kapat
  adminClient?.deactivate();
  process.exit(0);
}

// Yakalanmayan hatalar için
process.on('unhandledRejection', (err) => {
  log.error('Beklenmedik hata:', err);
  process.exit(1);
});

main().catch((err) => {
  log.error('Ana akış hatası:', err.message);
  process.exit(1);
});
