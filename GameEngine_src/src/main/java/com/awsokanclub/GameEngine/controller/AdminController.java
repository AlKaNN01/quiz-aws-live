/*
 * Admin panelinin WebSocket komutlarını karşılar.
 * İş mantığı GameFlowService'e delege edilir — controller sadece doğrulama yapar.
 *
 * REFACTOR:
 * - banPlayer: sessionId kaldırıldı. userId'den O(1) lookup ile session bulunur.
 *   Eski yöntemde sessionId boşsa 300 Redis GET döngüsü vardı — temizlendi.
 * - Map<String, String> payload'lar korundu (basit komutlar için DTO gereksiz).
 *   BanRequest ve LeaderboardApprove gibi karmaşık olanlar zaten DTO kullanıyor.
 */
package com.awsokanclub.GameEngine.controller;

import com.awsokanclub.GameEngine.dto.inbound.BanRequest;
import com.awsokanclub.GameEngine.dto.inbound.LeaderboardApprove;
import com.awsokanclub.GameEngine.dto.outbound.*;
import com.awsokanclub.GameEngine.exception.GameException;
import com.awsokanclub.GameEngine.model.GameSession;
import com.awsokanclub.GameEngine.model.GameState;
import com.awsokanclub.GameEngine.security.JwtUtil;
import com.awsokanclub.GameEngine.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Controller;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Slf4j
@Controller
@RequiredArgsConstructor
public class AdminController {

    private final GameStateService gameStateService;
    private final GameFlowService gameFlowService;
    private final LeaderboardService leaderboardService;
    private final GameEventPublisher gameEventPublisher;
    private final ModerationService moderationService;
    private final GameSessionService gameSessionService;
    private final GameAdminClient gameAdminClient;
    private final TaskScheduler taskScheduler;
    private final JwtUtil jwtUtil;
    private final RedisTemplate<String, Object> redisTemplate;

    /*
     * Admin WS bağlandığında principalName'i kaydeder.
     * Eğer oyun devam ediyorsa mevcut state'i ADMIN_HYDRATE ile geri gönderir
     * — admin sayfayı yenilese bile UI restore edilir.
     */
    @MessageMapping("admin.connect")
    public void adminConnect(@Payload Map<String, String> request,
                             SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            String gameId = request.get("joinCode");
            String principalName = headerAccessor.getUser() != null
                    ? headerAccessor.getUser().getName()
                    : headerAccessor.getSessionId();
            gameStateService.setAdminPrincipal(gameId, principalName);
            log.info("Admin bağlandı: gameId={} principal={}", gameId, principalName);

            // GameState yoksa oluştur — host.connect geldiğinde null bulmasın
            GameState existing = gameStateService.getState(gameId);
            if (existing == null) {
                GameState fresh = new GameState();
                fresh.setGameId(gameId);
                fresh.setStatus(GameState.Status.WAITING);
                fresh.setCurrentQuestionId("");
                fresh.setCurrentQuestionIndex(0);
                fresh.setTotalQuestions(0);
                fresh.setQuestionStartedAt(0);
                fresh.setTimerSeconds(20);
                gameStateService.saveState(fresh);
                log.info("GameState oluşturuldu: gameId={}", gameId);
            }

            // ── Hydration: devam eden oyunda reconnect ──
            sendHydration(gameId, principalName);

        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    /*
     * Mevcut oyun durumunu admin'e gönderir.
     * WAITING/null → hydration yok (lobi aşaması — zaten sıfırdan kurulur).
     * Diğer tüm state'lerde admin UI doğru ekrana konumlanır.
     */
    private void sendHydration(String gameId, String principalName) {
        GameState state = gameStateService.getState(gameId);
        if (state == null) return;

        // WAITING aşamasında: host/lobi durumunu bildir (race condition fix)
        if (state.getStatus() == GameState.Status.WAITING) {
            if (state.isHostConnected()) {
                // Hem broadcast hem personal queue — hangisi çalışıyorsa tutsun
                gameEventPublisher.broadcastToHost(gameId,
                        Map.of("type", "HOST_CONNECTED", "gameId", gameId));
                gameEventPublisher.sendToAdmin(principalName,
                        Map.of("type", "HOST_CONNECTED", "gameId", gameId));
            }
            if (state.isLobbyOpen()) {
                gameEventPublisher.broadcastToHost(gameId,
                        Map.of("type", "LOBBY_OPENED", "gameId", gameId));
                gameEventPublisher.sendToAdmin(principalName,
                        Map.of("type", "LOBBY_OPENED", "gameId", gameId));
            }
            return;
        }

        Map<String, Object> hydrate = new LinkedHashMap<>();
        hydrate.put("type", "ADMIN_HYDRATE");
        hydrate.put("gameId", gameId);
        hydrate.put("gameStatus", state.getStatus().name());
        hydrate.put("questionIndex", state.getCurrentQuestionIndex());
        hydrate.put("totalQuestions", state.getTotalQuestions());
        hydrate.put("questionId", state.getCurrentQuestionId());
        hydrate.put("playerCount", gameSessionService.getPlayerCount(gameId));

        if (state.getStatus() == GameState.Status.QUESTION_ACTIVE) {
            // Kalan süreyi ve cevap sayısını ekle
            long elapsed = System.currentTimeMillis() - state.getQuestionStartedAt();
            int remaining = (int) Math.max(0, state.getTimerSeconds() - elapsed / 1000);
            hydrate.put("timerRemaining", remaining);
            hydrate.put("answeredCount", gameSessionService.getAnsweredCount(gameId, state.getCurrentQuestionId()));

            // Soru metnini Redis'ten çek
            Map<String, Object> question = gameStateService.getQuestion(gameId, state.getCurrentQuestionIndex());
            if (question != null) {
                hydrate.put("questionText", question.get("text"));
                hydrate.put("timerSeconds", question.get("timerSeconds"));
                // Seçenekler
                Map<String, String> opts = new LinkedHashMap<>();
                opts.put("A", (String) question.get("optionA"));
                opts.put("B", (String) question.get("optionB"));
                opts.put("C", (String) question.get("optionC"));
                opts.put("D", (String) question.get("optionD"));
                hydrate.put("options", opts);
            }
        }

        if (state.getStatus() == GameState.Status.LEADERBOARD_REVIEW) {
            hydrate.put("autoPublishAt", state.getAutoPublishAt());
            hydrate.put("top10", buildHydrateTop10(gameId));
        }

        if (state.getStatus() == GameState.Status.SCORE_REVEALING
                || state.getStatus() == GameState.Status.COUNTDOWN) {
            hydrate.put("top10", buildHydrateTop10(gameId));
        }

        gameEventPublisher.sendToAdmin(principalName, hydrate);
        log.info("Hydration gönderildi: gameId={} status={}", gameId, state.getStatus());
    }

    private List<Map<String, Object>> buildHydrateTop10(String gameId) {
        List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
        List<String> redisKeys = sessionIds.stream().map(id -> "session:" + id).toList();
        List<Object> raw = redisKeys.isEmpty() ? List.of() : redisTemplate.opsForValue().multiGet(redisKeys);
        Map<String, String> nicknameMap = new HashMap<>();
        if (raw != null) {
            for (Object o : raw) {
                if (o instanceof com.awsokanclub.GameEngine.model.GameSession s) {
                    nicknameMap.put(s.getUserId(), s.getNickname());
                }
            }
        }
        List<Object[]> rawScores = leaderboardService.getTop10(gameId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < rawScores.size(); i++) {
            String uid = rawScores.get(i)[0].toString();
            Map<String, Object> entry = new HashMap<>();
            entry.put("rank", i + 1);
            entry.put("userId", uid);
            entry.put("nickname", nicknameMap.getOrDefault(uid, uid));
            entry.put("score", rawScores.get(i)[1]);
            result.add(entry);
        }
        return result;
    }

    /*
     * Host ekranı bağlandığında çağrılır.
     * state.hostConnected = true yapar, admin'e HOST_CONNECTED bildirir.
     */
    @MessageMapping("host.connect")
    public void hostConnect(@Payload Map<String, String> request,
                            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            String gameId = request.get("joinCode");
            GameState state = gameStateService.getState(gameId);
            if (state == null) throw GameException.gameNotFound();

            if (state.isHostConnected()) {
                log.info("Host zaten bağlı, tekrar broadcast edilmiyor: gameId={}", gameId);
                return;
            }

            state.setHostConnected(true);
            gameStateService.saveState(state);

            String adminPrincipal = gameStateService.getAdminPrincipal(gameId);
            log.info("Host bağlandı: gameId={} adminPrincipal={}", gameId, adminPrincipal);
            // HOST_CONNECTED'ı hem broadcast hem personal queue ile gönder —
            // convertAndSendToUser güvenilmez olabilir, broadcast kesin çalışır.
            gameEventPublisher.broadcastToHost(gameId,
                    Map.of("type", "HOST_CONNECTED", "gameId", gameId));
            if (adminPrincipal != null) {
                gameEventPublisher.sendToAdmin(adminPrincipal,
                        Map.of("type", "HOST_CONNECTED", "gameId", gameId));
            }
            log.info("HOST_CONNECTED broadcast edildi: gameId={}", gameId);
        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    /*
     * Admin lobi açma komutu.
     * Host bağlı değilse hata döner.
     * Lobi açılınca oyuncular join edebilir, host'a LOBBY_OPENED gönderilir.
     */
    @MessageMapping("admin.open.lobby")
    public void openLobby(@Payload Map<String, String> request,
                          SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            String gameId = request.get("joinCode");
            GameState state = gameStateService.getState(gameId);
            if (state == null) throw GameException.gameNotFound();
            if (!state.isHostConnected()) throw GameException.hostNotConnected();

            state.setLobbyOpen(true);
            gameStateService.saveState(state);

            gameEventPublisher.broadcastToHost(gameId,
                    Map.of("type", "LOBBY_OPENED", "gameId", gameId));
            log.info("Lobi açıldı: gameId={}", gameId);
        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    /*
     * Oyunu başlatır.
     * Soruları GameAdmin'den çeker, Redis'e kaydeder.
     * GAME_STARTED gönderir, 5sn sonra ilk soruyu başlatır.
     *
     * Redis Lock: admin "Başlat" butonuna çift tıklarsa veya network retry yaparsa
     * aynı oyun iki kez başlamaz. Lock 15sn TTL ile alınır; normal akışta 5-6sn içinde biter.
     */
    @MessageMapping("admin.start")
    public void startGame(@Payload Map<String, String> request,
                          SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        String gameId = request.get("joinCode");
        String lockKey = "lock:game:" + gameId + ":starting";
        boolean lockAcquired = false;
        try {
            validateAdmin(request.get("adminToken"));

            // Atomik lock — çift-start imkânsız hâle gelir
            Boolean locked = redisTemplate.opsForValue().setIfAbsent(lockKey, "1", 15, TimeUnit.SECONDS);
            if (!Boolean.TRUE.equals(locked)) throw GameException.gameAlreadyActive();
            lockAcquired = true;

            GameState state = gameStateService.getState(gameId);
            if (state == null) throw GameException.gameNotFound();

            // WAITING dışında bir state'te ise oyun zaten başlamış
            if (state.getStatus() != GameState.Status.WAITING) throw GameException.gameAlreadyActive();

            String principalName = headerAccessor.getUser() != null
                    ? headerAccessor.getUser().getName()
                    : headerAccessor.getSessionId();
            if (principalName != null) {
                gameStateService.setAdminPrincipal(gameId, principalName);
            }

            List<Map<String, Object>> questions = gameAdminClient.fetchQuestions(gameId);
            if (questions == null || questions.isEmpty()) throw GameException.gameNotFound();

            gameStateService.saveQuestions(gameId, questions);
            state.setTotalQuestions(questions.size());
            gameStateService.saveState(state);

            redisTemplate.delete("leaderboard:" + gameId);

            long firstQuestionAt = System.currentTimeMillis() + 5000;
            Map<String, Object> gameStarted = Map.of(
                    "type", "GAME_STARTED",
                    "gameId", gameId,
                    "message", "Oyun başlıyor!",
                    "firstQuestionAt", firstQuestionAt
            );
            gameEventPublisher.broadcastToGame(gameId, gameStarted);
            gameEventPublisher.broadcastToHost(gameId, gameStarted);

            gameStateService.updateStatus(gameId, GameState.Status.COUNTDOWN);
            taskScheduler.schedule(
                    () -> gameFlowService.startQuestion(gameId, 0),
                    Instant.now().plusMillis(5000)
            );

            log.info("Oyun başladı: {} toplam soru: {}", gameId, questions.size());

        } catch (GameException e) {
            sendError(sessionId, e);
        } finally {
            // Lock'u serbest bırak — başlatma tamamlandı ya da hata aldık
            // (Oyun timer'ı artık GameFlowService'te; bu lock sadece başlatma kritik bölgesi için)
            if (lockAcquired) {
                redisTemplate.delete(lockKey);
            }
        }
    }

    @MessageMapping("admin.end.question")
    public void endQuestion(@Payload Map<String, String> request,
                            SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            gameFlowService.endQuestion(request.get("joinCode"));
        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    @MessageMapping("admin.leaderboard.approve")
    public void approveLeaderboard(@Payload LeaderboardApprove request,
                                   SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.getAdminToken());
            gameFlowService.approveLeaderboard(request.getGameId(), request.getQuestionId());
            log.info("Leaderboard onaylandı: {}", request.getGameId());
        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    /*
     * Oyuncu banlar.
     * Frontend sadece userId gönderir — sessionId frontend'e sızdırılmaz.
     * Backend user_to_session index'inden O(1) ile session'ı bulur.
     */
    @MessageMapping("admin.ban")
    public void banPlayer(@Payload BanRequest request,
                          SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.getAdminToken());

            // O(1) lookup — userId'den direkt session bul
            GameSession session = gameSessionService.getSessionByUserId(
                    request.getGameId(), request.getUserId()
            );
            if (session == null) {
                log.warn("Ban: oyuncu bulunamadı userId={}", request.getUserId());
                return;
            }

            moderationService.banPlayer(
                    request.getGameId(),
                    session.getSessionId(),
                    session.getUserId(),
                    session.getIpAddress(),
                    sessionId,
                    request.getReason(),
                    request.isBanIpAddress()
            );

            log.info("Oyuncu banlandı: userId={} gameId={}", request.getUserId(), request.getGameId());

        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    @MessageMapping("admin.finish")
    public void finishGame(@Payload Map<String, String> request,
                           SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            gameFlowService.finishGame(request.get("joinCode"));
            log.info("Oyun admin tarafından bitirildi: {}", request.get("joinCode"));
        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    private void validateAdmin(String token) {
        if (token == null || !jwtUtil.validateToken(token)) {
            throw GameException.unauthorized();
        }
    }

    private void sendError(String sessionId, GameException e) {
        log.warn("AdminController hata: sessionId={} code={} msg={}", sessionId, e.getErrorCode(), e.getMessage());
        gameEventPublisher.sendToUser(sessionId, ErrorMessage.builder()
                .errorCode(e.getErrorCode())
                .message(e.getMessage())
                .retryable(e.isRetryable())
                .build());
    }
}