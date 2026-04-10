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
     * HOST_CONNECTED bildiriminin admin'e iletilebilmesi için gerekli.
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
        } catch (GameException e) {
            sendError(sessionId, e);
        }
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

            state.setHostConnected(true);
            gameStateService.saveState(state);

            String adminPrincipal = gameStateService.getAdminPrincipal(gameId);
            if (adminPrincipal != null) {
                gameEventPublisher.sendToAdmin(adminPrincipal,
                        Map.of("type", "HOST_CONNECTED", "gameId", gameId));
            }
            log.info("Host bağlandı: gameId={}", gameId);
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
     */
    @MessageMapping("admin.start")
    public void startGame(@Payload Map<String, String> request,
                          SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        try {
            validateAdmin(request.get("adminToken"));
            String gameId = request.get("joinCode");

            GameState state = gameStateService.getState(gameId);
            if (state == null) throw GameException.gameNotFound();

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
                    request.getReason()
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
        gameEventPublisher.sendToUser(sessionId, ErrorMessage.builder()
                .errorCode(e.getErrorCode())
                .message(e.getMessage())
                .retryable(e.isRetryable())
                .build());
    }
}