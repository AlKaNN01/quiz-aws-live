/*
 * Oyuncuların WebSocket mesajlarını karşılar.
 *
 * REFACTOR:
 * - FINISHED auto-reset kaldırıldı. Oyun bittiğinde state kendiliğinden sıfırlanmaz.
 *   Sıfırlama ancak admin'in admin.restart komutuyla yapılır.
 *   Eski yöntem: gecikmeli bir join isteği gelince kazananlar ekranı kapanıyor,
 *   leaderboard siliniyor, tüm state bozuluyordu.
 */
package com.awsokanclub.GameEngine.controller;

import com.awsokanclub.GameEngine.dto.inbound.AnswerSubmit;
import com.awsokanclub.GameEngine.dto.inbound.JoinRequest;
import com.awsokanclub.GameEngine.dto.inbound.ReconnectRequest;
import com.awsokanclub.GameEngine.dto.outbound.*;
import com.awsokanclub.GameEngine.exception.GameException;
import com.awsokanclub.GameEngine.model.GameSession;
import com.awsokanclub.GameEngine.model.GameState;
import com.awsokanclub.GameEngine.service.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Slf4j
@Controller
@RequiredArgsConstructor
public class GameController {

    private final GameSessionService gameSessionService;
    private final GameStateService gameStateService;
    private final AnswerService answerService;
    private final LeaderboardService leaderboardService;
    private final GameEventPublisher gameEventPublisher;
    private final ModerationService moderationService;
    private final GameAdminClient gameAdminClient;
    private final GameFlowService gameFlowService;

    @MessageMapping("game.join")
    public void join(@Payload JoinRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = getPrincipal(headerAccessor);
        String ipAddress = getIpAddress(headerAccessor);

        try {
            if (moderationService.isIpBanned(ipAddress)) throw GameException.ipBanned();

            boolean valid = gameAdminClient.validateJoinCode(request.getGameId(), request.getJoinCode());
            if (!valid) throw GameException.invalidJoinCode();

            GameState state = gameStateService.getState(request.getGameId());

            if (state == null) {
                // Redis'te state yok ama joinCode geçerli → otomatik WAITING state oluştur
                state = new GameState();
                state.setGameId(request.getGameId());
                state.setStatus(GameState.Status.WAITING);
                state.setCurrentQuestionId("");
                state.setCurrentQuestionIndex(0);
                state.setTotalQuestions(0);
                state.setQuestionStartedAt(0);
                state.setTimerSeconds(20);
                gameStateService.saveState(state);
                log.info("State otomatik oluşturuldu: gameId={}", request.getGameId());
            }

            // Oyun bitmişse katılım reddedilir.
            // Yeniden başlatmak için admin admin.restart komutunu göndermelidir.
            if (state.getStatus() != GameState.Status.WAITING) {
                throw GameException.gameAlreadyStarted();
            }

            GameSession session = gameSessionService.createSession(
                    request.getGameId(), request.getNickname(), ipAddress, sessionId
            );
            if (session == null) throw GameException.nicknameTaken();

            int playerCount = gameSessionService.getPlayerCount(request.getGameId());

            gameEventPublisher.sendToUser(sessionId, JoinAck.builder()
                    .success(true)
                    .sessionId(session.getSessionId())
                    .userId(session.getUserId())
                    .nickname(session.getNickname())
                    .gameId(session.getGameId())
                    .playerCount(playerCount)
                    .build());

            gameEventPublisher.broadcastToLobby(request.getGameId(),
                    WaitingRoomUpdate.builder().playerCount(playerCount).build());

            gameEventPublisher.broadcastToHost(request.getGameId(),
                    HostWaitingUpdate.builder()
                            .playerCount(playerCount)
                            .gameCode(request.getJoinCode())
                            .build());

            log.info("Oyuncu katıldı: {} gameId: {}", session.getNickname(), request.getGameId());

        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    @MessageMapping("game.answer")
    public void answer(@Payload AnswerSubmit request, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = getPrincipal(headerAccessor);

        try {
            GameSession session = gameSessionService.getSession(request.getSessionId());
            if (session == null) throw GameException.gameNotFound();
            if (session.getStatus() == GameSession.Status.BANNED) throw GameException.sessionBanned();

            GameState state = gameStateService.getState(request.getGameId());
            if (state == null || state.getStatus() != GameState.Status.QUESTION_ACTIVE) {
                throw GameException.questionNotActive();
            }

            boolean recorded = answerService.recordAnswer(
                    request.getGameId(), request.getQuestionId(),
                    session.getUserId(), request.getAnswer()
            );
            if (!recorded) throw GameException.alreadyAnswered();

            answerService.recordAnsweredPlayer(
                    request.getGameId(), request.getQuestionId(), session.getUserId()
            );

            String correctAnswer = gameStateService.getCorrectAnswer(
                    request.getGameId(), request.getQuestionId()
            );
            boolean isCorrect = correctAnswer != null && correctAnswer.equals(request.getAnswer());

            int score = answerService.calculateScore(
                    request.getReactionTimeMs(), state.getTimerSeconds(), isCorrect
            );

            if (score > 0) {
                leaderboardService.addScore(request.getGameId(), session.getUserId(), score);
            }

            gameFlowService.recordQuestionScore(
                    request.getGameId(), request.getQuestionId(), session.getUserId(), score
            );

            gameEventPublisher.sendToUser(sessionId, AnswerReceived.builder()
                    .gameId(request.getGameId())
                    .questionId(request.getQuestionId())
                    .yourAnswer(request.getAnswer())
                    .build());

            int answeredCount = gameSessionService.getAnsweredCount(
                    request.getGameId(), request.getQuestionId()
            );
            int totalPlayers = gameSessionService.getPlayerCount(request.getGameId());

            gameEventPublisher.broadcastToHost(request.getGameId(),
                    HostAnswerCount.builder()
                            .questionId(request.getQuestionId())
                            .answeredCount(answeredCount)
                            .totalPlayers(totalPlayers)
                            .build());

            log.info("Cevap kaydedildi: {} soru: {} doğru: {}", session.getNickname(), request.getQuestionId(), isCorrect);

        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    @MessageMapping("game.reconnect")
    public void reconnect(@Payload ReconnectRequest request, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = getPrincipal(headerAccessor);

        try {
            GameSession session = gameSessionService.getSession(request.getSessionId());
            if (session == null) throw GameException.gameNotFound();
            if (session.getStatus() == GameSession.Status.BANNED) throw GameException.sessionBanned();

            GameState state = gameStateService.getState(request.getGameId());
            int totalScore = leaderboardService.getUserScore(request.getGameId(), session.getUserId());

            gameEventPublisher.sendToUser(sessionId, ReconnectAck.builder()
                    .success(true)
                    .sessionId(session.getSessionId())
                    .totalScore(totalScore)
                    .gameStatus(state != null ? state.getStatus().name() : "UNKNOWN")
                    .build());

            log.info("Oyuncu yeniden bağlandı: {}", session.getNickname());

        } catch (GameException e) {
            sendError(sessionId, e);
        }
    }

    private String getPrincipal(SimpMessageHeaderAccessor headerAccessor) {
        return headerAccessor.getUser() != null
                ? headerAccessor.getUser().getName()
                : headerAccessor.getSessionId();
    }

    private String getIpAddress(SimpMessageHeaderAccessor headerAccessor) {
        try {
            Object ip = headerAccessor.getSessionAttributes() != null
                    ? headerAccessor.getSessionAttributes().get("ip") : null;
            return ip != null ? ip.toString() : "unknown";
        } catch (Exception e) {
            return "unknown";
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