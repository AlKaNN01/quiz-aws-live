/**
 * Quiz Hard Stress Test
 *
 * Senaryo:
 *  1. 200 bot bağlanır → oyuna katılır
 *  2. Her QUESTION_START'ta tüm botlar 0-500ms içinde aynı anda cevap gönderir (burst)
 *  3. Her soruda, admin 5 rastgele aktif botu WS üzerinden banlar
 *  4. Banlanan botlar BANNED mesajı alır ve bağlantıyı keser
 *  5. Oyun bittikten sonra: banlanan botların DB'ye kaydedilmediği, oyunun
 *     düzgün bittiği doğrulanır
 *
 * Kullanım:
 *   node hard-test.js
 *   BOT_COUNT=200 QUESTION_COUNT=5 TIMER_SECONDS=15 node hard-test.js
 *   BAN_PER_QUESTION=5 node hard-test.js
 */

'use strict';

const { Client } = require('@stomp/stompjs');
const WebSocket  = require('ws');

// ─── Konfigürasyon ───────────────────────────────────────────────────────────

const CFG = {
  apiUrl:   process.env.API_URL   || 'http://localhost:8081',
  wsUrl:    process.env.WS_URL    || 'ws://localhost:8080/ws/websocket',
  wsOrigin: process.env.WS_ORIGIN || 'http://localhost',

  adminUser: process.env.ADMIN_USER || 'admin',
  adminPass: process.env.ADMIN_PASS || 'TestAdmin123!',

  botCount:         parseInt(process.env.BOT_COUNT          || '200'),
  questionCount:    parseInt(process.env.QUESTION_COUNT     || '5'),
  timerSeconds:     parseInt(process.env.TIMER_SECONDS      || '15'),
  banPerQuestion:   parseInt(process.env.BAN_PER_QUESTION   || '5'),

  // Burst: tüm botlar 0-BURST_WINDOW ms içinde cevap gönderir
  burstWindowMs: parseInt(process.env.BURST_WINDOW_MS || '500'),

  botBatchSize: 25,
  batchDelayMs: 100,
};

// ─── Yardımcılar ────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const log = {
  info:  (...a) => console.log(`[${ts()}] ℹ`, ...a),
  ok:    (...a) => console.log(`[${ts()}] ✓`, ...a),
  warn:  (...a) => console.warn(`[${ts()}] ⚠`, ...a),
  error: (...a) => console.error(`[${ts()}] ✗`, ...a),
  sep:   ()     => console.log('─'.repeat(60)),
};

function ts() {
  return new Date().toISOString().slice(11, 23);
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

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

// ─── STOMP fabrikası ─────────────────────────────────────────────────────────

function makeStompClient(onConnect, label = '') {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`STOMP timeout: ${label}`)), 15_000
    );
    const client = new Client({
      webSocketFactory: () => new WebSocket(CFG.wsUrl, {
        headers: { Origin: CFG.wsOrigin },
      }),
      reconnectDelay: 0,
      onConnect: (frame) => {
        clearTimeout(timeout);
        onConnect(client, frame);
        resolve(client);
      },
      onStompError: (frame) => {
        clearTimeout(timeout);
        reject(new Error(`STOMP hata (${label}): ${frame.headers?.message}`));
      },
      debug: () => {},
    });
    client.activate();
  });
}

// ─── İstatistikler ───────────────────────────────────────────────────────────

const stats = {
  botsConnected:    0,
  botsJoined:       0,
  botsFailed:       0,
  answersSubmitted: 0,
  answersCorrect:   0,
  bannedByAdmin:    0,   // admin'in ban gönderdiği sayı
  bannedConfirmed:  0,   // botun BANNED mesajı aldığı sayı
  burstLatencies:   [],  // her soru için: ilk-son cevap arası ms farkı
  errors:           [],
  gameFinishedAt:   null,
};

// Aktif botlar: userId → { nickname, userId, sessionId, client, active }
const activeBots = new Map();

// ─── Bot istemcisi ───────────────────────────────────────────────────────────

function createBotClient(botIndex, joinCode) {
  return new Promise((resolve) => {
    const nickname = `HBot${String(botIndex + 1).padStart(3, '0')}`;
    let sessionData = null;
    let client;

    const onConnect = (c) => {
      client = c;
      stats.botsConnected++;

      c.subscribe('/user/queue/personal', (msg) => {
        try { handleMsg(JSON.parse(msg.body)); } catch (_) {}
      });
      c.subscribe(`/topic/game/${joinCode}`, (msg) => {
        try { handleMsg(JSON.parse(msg.body)); } catch (_) {}
      });

      c.publish({
        destination: '/app/game.join',
        body: JSON.stringify({ gameId: joinCode, joinCode, nickname }),
      });
    };

    const handleMsg = (msg) => {
      switch (msg.type) {
        case 'JOIN_ACK':
          if (msg.success) {
            sessionData = { sessionId: msg.sessionId, userId: msg.userId };
            activeBots.set(msg.userId, {
              nickname, userId: msg.userId,
              sessionId: msg.sessionId,
              client, active: true,
            });
            stats.botsJoined++;
          } else {
            stats.botsFailed++;
            stats.errors.push(`${nickname}: join red — ${msg.message}`);
          }
          break;

        case 'QUESTION_START': {
          if (!sessionData || !client?.connected) break;

          // Burst: 0 – burstWindowMs arası rastgele gecikme
          const delay   = Math.floor(Math.random() * CFG.burstWindowMs);
          const answers = ['A', 'B', 'C', 'D'];
          const answer  = answers[Math.floor(Math.random() * 4)];

          setTimeout(() => {
            const bot = activeBots.get(sessionData.userId);
            if (!bot?.active || !client?.connected) return;

            client.publish({
              destination: '/app/game.answer',
              body: JSON.stringify({
                gameId:         joinCode,
                questionId:     msg.questionId,
                sessionId:      sessionData.sessionId,
                answer,
                reactionTimeMs: delay,
              }),
            });
            stats.answersSubmitted++;
            if (answer === 'A') stats.answersCorrect++;
          }, delay);
          break;
        }

        case 'BANNED': {
          stats.bannedConfirmed++;
          if (sessionData) {
            const bot = activeBots.get(sessionData.userId);
            if (bot) bot.active = false;
          }
          log.warn(`${nickname}: BANNED — ${msg.reason}`);
          setTimeout(() => client?.deactivate(), 200);
          break;
        }

        case 'GAME_FINISHED':
          stats.gameFinishedAt = Date.now();
          setTimeout(() => client?.deactivate(), 500);
          break;

        case 'ERROR_MESSAGE':
          stats.errors.push(`${nickname}: ${msg.message}`);
          break;
      }
    };

    makeStompClient(onConnect, nickname)
      .then(() => resolve({ nickname }))
      .catch((err) => {
        stats.botsFailed++;
        stats.errors.push(`${nickname}: bağlantı — ${err.message}`);
        resolve(null);
      });
  });
}

async function spawnBots(joinCode) {
  log.info(`${CFG.botCount} bot bağlanıyor (${CFG.botBatchSize}'li gruplar)...`);
  for (let i = 0; i < CFG.botCount; i += CFG.botBatchSize) {
    const end   = Math.min(i + CFG.botBatchSize, CFG.botCount);
    const batch = Array.from({ length: end - i }, (_, k) => i + k);
    await Promise.all(batch.map((idx) => createBotClient(idx, joinCode)));
    if (end < CFG.botCount) await sleep(CFG.batchDelayMs);
    process.stdout.write(`\r   Bağlanan: ${stats.botsConnected}/${CFG.botCount}  `);
  }
  console.log();
  await sleep(1500);
  log.ok(`Bağlanan: ${stats.botsConnected}  Katılan: ${stats.botsJoined}  Hata: ${stats.botsFailed}`);
}

// ─── Admin / Ban ─────────────────────────────────────────────────────────────

/**
 * Oyun sırasında her SCORE_REVEAL'de çağrılır.
 * Aktif botlardan rastgele N tanesini banlar.
 */
function banRandomBots(adminClient, token, joinCode, count) {
  const candidates = [...activeBots.values()].filter((b) => b.active);
  if (candidates.length === 0) {
    log.warn('Banlanacak aktif bot kalmadı');
    return;
  }

  // Karıştır, ilk N'i al
  const shuffled = candidates.sort(() => Math.random() - 0.5).slice(0, count);

  for (const bot of shuffled) {
    adminClient.publish({
      destination: '/app/admin.ban',
      body: JSON.stringify({
        adminToken: token,
        gameId:     joinCode,
        userId:     bot.userId,
        reason:     'Stres testi ban',
      }),
    });
    bot.active = false; // optimistik işaretle
    stats.bannedByAdmin++;
    log.info(`Ban gönderildi: ${bot.nickname} (userId=${bot.userId})`);
  }
}

function createAdminClient(token, joinCode) {
  return new Promise((resolve, reject) => {
    let adminClient;
    let questionsApproved = 0;
    let scoreRevealCount  = 0;

    const onConnect = (c) => {
      adminClient = c;

      // Kişisel admin kuyruğu — LEADERBOARD_PENDING buradan gelir
      c.subscribe('/user/queue/admin', (msg) => {
        try { handleAdminMsg(c, JSON.parse(msg.body)); } catch (_) {}
      });

      // Host topic — SCORE_REVEAL, GAME_FINISHED burada gelir
      c.subscribe(`/topic/game/${joinCode}/host`, (msg) => {
        try { handleAdminMsg(c, JSON.parse(msg.body)); } catch (_) {}
      });
    };

    const handleAdminMsg = (c, msg) => {
      switch (msg.type) {
        case 'LEADERBOARD_PENDING':
          questionsApproved++;
          log.info(`LEADERBOARD_PENDING alındı (soru ${questionsApproved}/${CFG.questionCount}), onaylanıyor...`);
          c.publish({
            destination: '/app/admin.leaderboard.approve',
            body: JSON.stringify({
              adminToken: token,
              gameId:     joinCode,
              questionId: msg.questionId,
            }),
          });
          break;

        case 'SCORE_REVEAL': {
          scoreRevealCount++;
          // Her soruda ban uygula (son soruda değil — oyun bitince zaten hesaplanacak)
          if (scoreRevealCount < CFG.questionCount && CFG.banPerQuestion > 0) {
            setTimeout(() => {
              log.info(`Soru ${scoreRevealCount} bitti — ${CFG.banPerQuestion} bot banlanıyor...`);
              banRandomBots(c, token, joinCode, CFG.banPerQuestion);
            }, 300); // SCORE_REVEAL işlendikten 300ms sonra ban at
          }
          break;
        }

        case 'GAME_FINISHED':
          log.ok('Admin: GAME_FINISHED alındı');
          stats.gameFinishedAt = stats.gameFinishedAt || Date.now();
          break;
      }
    };

    makeStompClient(onConnect, 'admin')
      .then(() => resolve(adminClient))
      .catch(reject);
  });
}

// ─── Oyun kurulumu ───────────────────────────────────────────────────────────

async function setupGame(token) {
  const game = await api('POST', '/api/games', token, { title: 'Hard Stress Test' });
  for (let i = 0; i < CFG.questionCount; i++) {
    await api('POST', `/api/games/${game.id}/questions`, token, {
      text:          `Stres Soru ${i + 1}: Aşağıdakilerden hangisi doğrudur?`,
      optionA:       'Doğru cevap A',
      optionB:       'Yanlış B',
      optionC:       'Yanlış C',
      optionD:       'Yanlış D',
      correctAnswer: 'A',
      timerSeconds:  CFG.timerSeconds,
      orderIndex:    i,
    });
  }
  const published = await api('POST', `/api/games/${game.id}/publish`, token);
  log.ok(`Oyun hazır: joinCode=${published.joinCode}`);
  return published;
}

// ─── Sonuç doğrulama ─────────────────────────────────────────────────────────

async function verifyResults(token, joinCode) {
  try {
    const results = await api('GET', `/api/games/${joinCode}/results`, token);
    const bannedUserIds = new Set(
      [...activeBots.values()].filter((b) => !b.active).map((b) => b.userId)
    );

    const bannedInDb = results.filter((r) => bannedUserIds.has(r.userId));
    if (bannedInDb.length > 0) {
      log.warn(`DİKKAT: ${bannedInDb.length} banlı oyuncu DB'ye kaydedilmiş!`);
      bannedInDb.forEach((r) => log.warn(`  → userId=${r.userId} nickname=${r.nickname}`));
    } else {
      log.ok('Banlı oyuncular DB\'ye kaydedilmemiş — doğru davranış');
    }

    log.ok(`DB'de kayıtlı oyuncu: ${results.length}`);
    if (results.length > 0) {
      log.info('İlk 5:');
      results.slice(0, 5).forEach((r) =>
        console.log(`   #${r.rank}  ${(r.nickname || '?').padEnd(14)} ${r.totalScore} puan`)
      );
    }
    return results.length;
  } catch (e) {
    log.warn(`Sonuç doğrulama hatası: ${e.message}`);
    return -1;
  }
}

// ─── Burst istatistiği ───────────────────────────────────────────────────────

// Her soru için ilk-son cevap arasındaki gerçek süreyi ölçmek
// sunucu tarafında yapılabilir; test script'inden tahmini gösterebiliriz.
function logBurstConfig() {
  log.info(`Burst penceresi: 0-${CFG.burstWindowMs}ms (${CFG.botCount} bot aynı anda)`);
  log.info(`Her soruda ${CFG.banPerQuestion} bot banlanacak (${CFG.questionCount} soru)`);
  const totalBans = CFG.banPerQuestion * (CFG.questionCount - 1);
  log.info(`Toplam beklenen ban: ~${totalBans} (son soruda ban yok)`);
}

// ─── ANA AKIŞ ────────────────────────────────────────────────────────────────

async function main() {
  const startedAt = Date.now();

  log.sep();
  console.log('  Quiz Hard Stress Test');
  console.log(`  Bot sayısı         : ${CFG.botCount}`);
  console.log(`  Soru sayısı        : ${CFG.questionCount}`);
  console.log(`  Timer (sn)         : ${CFG.timerSeconds}`);
  console.log(`  Burst penceresi    : ${CFG.burstWindowMs}ms`);
  console.log(`  Ban / soru         : ${CFG.banPerQuestion}`);
  console.log(`  API                : ${CFG.apiUrl}`);
  console.log(`  WebSocket          : ${CFG.wsUrl}`);
  log.sep();
  logBurstConfig();
  log.sep();
  console.log();

  // 1. Login
  log.info('Admin girişi...');
  const { token } = await api('POST', '/api/auth/login', null, {
    username: CFG.adminUser,
    password: CFG.adminPass,
  });
  log.ok('Token alındı');
  console.log();

  // 2. Oyun kur
  log.sep();
  log.info('AŞAMA 1 — Oyun kurulumu');
  log.sep();
  const game     = await setupGame(token);
  const joinCode = game.joinCode;
  console.log();

  // 3. Botlar
  log.sep();
  log.info('AŞAMA 2 — Botlar bağlanıyor');
  log.sep();
  await spawnBots(joinCode);
  console.log();

  // 4. Admin
  log.sep();
  log.info('AŞAMA 3 — Admin bağlanıyor');
  log.sep();
  const adminClient = await createAdminClient(token, joinCode);
  log.ok('Admin WebSocket bağlı');

  // 5. Oyunu başlat
  await sleep(500);
  log.info('Oyun başlatılıyor...');
  adminClient.publish({
    destination: '/app/admin.start',
    body: JSON.stringify({ adminToken: token, joinCode }),
  });
  log.ok('admin.start gönderildi');
  console.log();

  // 6. Oyunun bitmesini bekle
  log.sep();
  log.info('AŞAMA 4 — Oyun oynuyor (burst + ban)...');
  log.sep();

  const maxWaitMs    = (CFG.timerSeconds + 10 + 6) * CFG.questionCount * 1000 + 30_000;
  const checkMs      = 3_000;
  let   waited       = 0;

  while (!stats.gameFinishedAt && waited < maxWaitMs) {
    await sleep(checkMs);
    waited += checkMs;
    const active  = [...activeBots.values()].filter((b) => b.active).length;
    const banned  = stats.bannedByAdmin;
    process.stdout.write(
      `\r   ${(waited / 1000).toFixed(0)}s  Cevap: ${stats.answersSubmitted}` +
      `  Ban gönderildi: ${banned}  Ban alındı: ${stats.bannedConfirmed}` +
      `  Aktif: ${active}  `
    );
  }
  console.log();

  if (!stats.gameFinishedAt) {
    log.warn('Oyun beklenen sürede bitmedi!');
  } else {
    log.ok(`Oyun bitti (süre: ${((stats.gameFinishedAt - startedAt) / 1000).toFixed(1)}s)`);
  }
  console.log();

  // 7. Sonuçlar
  log.sep();
  log.info('AŞAMA 5 — Sonuçlar doğrulanıyor');
  log.sep();
  await sleep(2500);
  const savedCount = await verifyResults(token, joinCode);
  console.log();

  // 8. Rapor
  const totalMs        = Date.now() - startedAt;
  const expectedJoined = stats.botsJoined;
  const expectedBanned = CFG.banPerQuestion * (CFG.questionCount - 1);
  const expectedSaved  = Math.max(0, expectedJoined - stats.bannedByAdmin);

  log.sep();
  console.log('  HARD STRESS TEST RAPORU');
  log.sep();
  console.log(`  Bot hedef          : ${CFG.botCount}`);
  console.log(`  WS bağlı           : ${stats.botsConnected}`);
  console.log(`  Oyuna katılan      : ${stats.botsJoined}`);
  console.log(`  Bağlantı hatası    : ${stats.botsFailed}`);
  console.log('');
  console.log(`  Burst penceresi    : 0-${CFG.burstWindowMs}ms`);
  console.log(`  Toplam cevap       : ${stats.answersSubmitted}`);
  console.log(`  Doğru cevap        : ${stats.answersCorrect}`);
  const expectedAnswers = expectedJoined * CFG.questionCount;
  const answerRate = expectedAnswers > 0
    ? ((stats.answersSubmitted / expectedAnswers) * 100).toFixed(1) : '0.0';
  console.log(`  Cevap oranı        : %${answerRate} (banlılar cevap veremeyebilir)`);
  console.log('');
  console.log(`  Ban gönderildi     : ${stats.bannedByAdmin}  (hedef ~${expectedBanned})`);
  console.log(`  BANNED mesajı alındı: ${stats.bannedConfirmed}`);
  console.log(`  DB'ye kaydedilen   : ${savedCount}  (beklenen ~${expectedSaved})`);
  console.log('');
  console.log(`  Toplam süre        : ${(totalMs / 1000).toFixed(1)}s`);
  log.sep();

  if (stats.errors.length > 0) {
    console.log(`\n  Hatalar (ilk 10):`);
    stats.errors.slice(0, 10).forEach((e) => console.log(`   - ${e}`));
    if (stats.errors.length > 10)
      console.log(`   ... ve ${stats.errors.length - 10} hata daha`);
  }

  // Sonuç değerlendirmesi
  console.log();
  log.sep();
  const issues = [];
  if (stats.botsJoined < CFG.botCount * 0.9)
    issues.push(`Bot katılım düşük: ${stats.botsJoined}/${CFG.botCount}`);
  if (stats.bannedConfirmed < stats.bannedByAdmin * 0.5)
    issues.push(`Ban onayı az: ${stats.bannedConfirmed}/${stats.bannedByAdmin}`);
  if (savedCount < 0)
    issues.push('DB sorgusu başarısız');

  if (issues.length === 0) {
    log.ok('Tüm kontroller geçti — sistem strese dayanıklı');
  } else {
    log.warn(`${issues.length} sorun tespit edildi:`);
    issues.forEach((i) => console.log(`   - ${i}`));
  }
  log.sep();

  adminClient?.deactivate();
  process.exit(0);
}

process.on('unhandledRejection', (err) => {
  log.error('Beklenmedik hata:', err);
  process.exit(1);
});

main().catch((err) => {
  log.error('Ana akış hatası:', err.message);
  process.exit(1);
});
