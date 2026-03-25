/*
 * Oyunun tam akışını yöneten merkezi servis.
 *
 * REFACTOR:
 * - buildTop10'dan sessionId kaldırıldı. Frontend sessionId'yi bilmemeli.
 *   Ban işlemi userId üzerinden yapılıyor, backend O(1) ile session buluyor.
 * - publishAnswerReveal ve publishScoreReveal: for döngüsündeki 300 Redis GET
 *   multiGet ile tek sefere indirildi (N+1 → 1).
 * - getRedisTemplate() kullanımı kaldırıldı. getPlayerAnswer() artık GameStateService'te.
 */
package com.awsokanclub.GameEngine.service;

import com.awsokanclub.GameEngine.dto.outbound.*;
import com.awsokanclub.GameEngine.model.GameSession;
import com.awsokanclub.GameEngine.model.GameState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameFlowService {

    private final GameStateService gameStateService;
    private final GameSessionService gameSessionService;
    private final AnswerService answerService;
    private final LeaderboardService leaderboardService;
    private final GameEventPublisher gameEventPublisher;
    private final TaskScheduler taskScheduler;
    private final GameAdminClient gameAdminClient;
    private final RedisTemplate<String, Object> redisTemplate;

    private final Map<String, ScheduledFuture<?>> questionTimers = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> approvalTimers = new ConcurrentHashMap<>();
    private final Map<String, Integer> questionScores = new ConcurrentHashMap<>();

    private static final int NEXT_QUESTION_DELAY_SECONDS = 15;

    // ── Soruyu başlat ────────────────────────────────────
    public void startQuestion(String gameId, int questionIndex) {
        GameState state = gameStateService.getState(gameId);
        if (state == null) { log.error("startQuestion: state yok, gameId={}", gameId); return; }

        Map<String, Object> question = gameStateService.getQuestion(gameId, questionIndex);
        if (question == null) { log.error("startQuestion: soru yok, index={}", questionIndex); return; }

        String questionId = question.get("id").toString();

        // Önceki cevap key'lerini temizle
        redisTemplate.delete("answer:dist:" + gameId + ":" + questionId);
        redisTemplate.delete("answered:" + gameId + ":" + questionId);
        List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
        for (String sid : sessionIds) {
            GameSession s = gameSessionService.getSession(sid);
            if (s != null) redisTemplate.delete("answer:" + gameId + ":" + questionId + ":" + s.getUserId());
        }

        state.setCurrentQuestionId(questionId);
        state.setCurrentQuestionIndex(questionIndex);
        state.setTimerSeconds(((Number) question.get("timerSeconds")).intValue());
        state.setQuestionStartedAt(System.currentTimeMillis());
        state.setStatus(GameState.Status.QUESTION_ACTIVE);
        gameStateService.saveState(state);

        QuestionStart qs = QuestionStart.builder()
                .gameId(gameId)
                .questionId(state.getCurrentQuestionId())
                .questionIndex(questionIndex)
                .totalQuestions(state.getTotalQuestions())
                .questionText((String) question.get("text"))
                .options(buildOptions(question))
                .timerSeconds(state.getTimerSeconds())
                .startedAt(state.getQuestionStartedAt())
                .build();

        gameEventPublisher.broadcastToGame(gameId, qs);
        gameEventPublisher.broadcastToHost(gameId, qs);

        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> endQuestion(gameId),
                Instant.now().plusMillis(state.getTimerSeconds() * 1000L));
        questionTimers.put(gameId + ":question", future);

        log.info("Soru başladı: gameId={} index={} timer={}sn", gameId, questionIndex, state.getTimerSeconds());
    }

    // ── Soruyu bitir ─────────────────────────────────────
    public void endQuestion(String gameId) {
        GameState state = gameStateService.getState(gameId);
        if (state == null || state.getStatus() != GameState.Status.QUESTION_ACTIVE) {
            log.warn("endQuestion: geçersiz durum, gameId={}", gameId); return;
        }
        cancelQuestionTimer(gameId);

        String questionId = state.getCurrentQuestionId();
        gameStateService.updateStatus(gameId, GameState.Status.QUESTION_END);

        String correctAnswer = gameStateService.getCorrectAnswer(gameId, questionId);
        Map<Object, Object> rawDist = answerService.getAnswerDistribution(gameId, questionId);
        Map<String, Integer> dist = convertDistribution(rawDist);
        int totalAnswered = gameSessionService.getAnsweredCount(gameId, questionId);
        int totalPlayers = gameSessionService.getPlayerCount(gameId);

        QuestionEnd qe = QuestionEnd.builder()
                .gameId(gameId).questionId(questionId).correctAnswer(correctAnswer)
                .answerDistribution(dist).totalAnswered(totalAnswered).totalPlayers(totalPlayers)
                .build();
        gameEventPublisher.broadcastToGame(gameId, qe);
        gameEventPublisher.broadcastToHost(gameId, qe);

        taskScheduler.schedule(
                () -> publishAnswerReveal(gameId, questionId, correctAnswer),
                Instant.now().plusMillis(3000));
    }

    // ── Her oyuncuya kişisel cevap bilgisi ───────────────
    // REFACTOR: multiGet ile tüm session'lar tek seferde çekiliyor (N+1 → 1)
    private void publishAnswerReveal(String gameId, String questionId, String correctAnswer) {
        gameStateService.updateStatus(gameId, GameState.Status.ANSWER_REVEAL);

        List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
        List<GameSession> sessions = fetchSessionsBatch(sessionIds);

        for (GameSession session : sessions) {
            if (session.getStatus() == GameSession.Status.BANNED) continue;

            String playerAnswer = gameStateService.getPlayerAnswer(gameId, questionId, session.getUserId());
            boolean isCorrect = correctAnswer != null && correctAnswer.equals(playerAnswer);
            int pointsEarned = playerAnswer != null
                    ? questionScores.getOrDefault(gameId + ":" + questionId + ":" + session.getUserId(), 0)
                    : 0;

            gameEventPublisher.sendToUser(session.getPrincipalName(), AnswerReveal.builder()
                    .gameId(gameId).questionId(questionId).correctAnswer(correctAnswer)
                    .yourAnswer(playerAnswer).isCorrect(isCorrect).pointsEarned(pointsEarned)
                    .build());
        }

        log.info("AnswerReveal gönderildi: gameId={}", gameId);
        publishLeaderboardPending(gameId, questionId);
    }

    // ── Admin'e leaderboard onay ekranı ──────────────────
    private void publishLeaderboardPending(String gameId, String questionId) {
        gameStateService.updateStatus(gameId, GameState.Status.LEADERBOARD_REVIEW);

        long approvalTimeout = 30_000L;
        long autoPublishAt = System.currentTimeMillis() + approvalTimeout;
        List<Map<String, Object>> top10 = buildTop10(gameId);

        LeaderboardPending pending = LeaderboardPending.builder()
                .gameId(gameId)
                .questionId(questionId)
                .autoPublishAt(autoPublishAt)
                .top10(top10)
                .build();

        String adminPrincipal = gameStateService.getAdminPrincipal(gameId);
        if (adminPrincipal != null) {
            gameEventPublisher.sendToAdmin(adminPrincipal, pending);
        }
        gameEventPublisher.broadcastToHost(gameId, pending);

        String approvalKey = gameId + ":" + questionId;
        ScheduledFuture<?> future = taskScheduler.schedule(
                () -> publishScoreReveal(gameId, questionId),
                Instant.now().plusMillis(approvalTimeout));
        approvalTimers.put(approvalKey, future);
    }

    // ── Admin onayı ──────────────────────────────────────
    public void approveLeaderboard(String gameId, String questionId) {
        String approvalKey = gameId + ":" + questionId;
        ScheduledFuture<?> future = approvalTimers.remove(approvalKey);
        if (future != null) future.cancel(false);
        publishScoreReveal(gameId, questionId);
    }

    // ── Herkese puan ekranı ──────────────────────────────
    // REFACTOR: multiGet ile tüm session'lar tek seferde çekiliyor (N+1 → 1)
    public void publishScoreReveal(String gameId, String questionId) {
        GameState state = gameStateService.getState(gameId);
        if (state == null) return;

        if (state.getStatus() == GameState.Status.SCORE_REVEALING ||
                state.getStatus() == GameState.Status.COUNTDOWN ||
                state.getStatus() == GameState.Status.FINISHED) {
            log.warn("publishScoreReveal: zaten yayınlandı, gameId={}", gameId); return;
        }
        gameStateService.updateStatus(gameId, GameState.Status.SCORE_REVEALING);

        List<Map<String, Object>> top10 = buildTop10(gameId);
        int totalPlayers = gameSessionService.getPlayerCount(gameId);
        int nextIndex = state.getCurrentQuestionIndex() + 1;
        boolean hasNext = nextIndex < state.getTotalQuestions();
        long nextQuestionAt = hasNext
                ? System.currentTimeMillis() + (NEXT_QUESTION_DELAY_SECONDS * 1000L)
                : 0;

        List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
        List<GameSession> sessions = fetchSessionsBatch(sessionIds);

        for (GameSession session : sessions) {
            if (session.getStatus() == GameSession.Status.BANNED) continue;

            int totalScore = leaderboardService.getUserScore(gameId, session.getUserId());
            int myRank = leaderboardService.getUserRank(gameId, session.getUserId());
            int pointsEarned = questionScores.getOrDefault(
                    gameId + ":" + questionId + ":" + session.getUserId(), 0);

            gameEventPublisher.sendToUser(session.getPrincipalName(), ScoreReveal.builder()
                    .gameId(gameId).questionId(questionId).pointsEarned(pointsEarned)
                    .totalScore(totalScore).myRank(myRank).rankChange(0)
                    .totalPlayers(totalPlayers).top10(top10).nextQuestionAt(nextQuestionAt)
                    .build());
        }

        gameEventPublisher.broadcastToHost(gameId, ScoreReveal.builder()
                .gameId(gameId).questionId(questionId).pointsEarned(0).totalScore(0)
                .myRank(0).rankChange(0).totalPlayers(totalPlayers).top10(top10)
                .nextQuestionAt(nextQuestionAt).build());

        if (hasNext) {
            gameStateService.updateStatus(gameId, GameState.Status.COUNTDOWN);
            taskScheduler.schedule(
                    () -> startQuestion(gameId, nextIndex),
                    Instant.now().plusMillis(NEXT_QUESTION_DELAY_SECONDS * 1000L));
        } else {
            finishGame(gameId);
        }
    }

    // ── Oyunu bitir ──────────────────────────────────────
    public void finishGame(String gameId) {
        gameStateService.updateStatus(gameId, GameState.Status.FINISHED);

        List<String> sIds = gameSessionService.getPlayerIds(gameId);
        List<GameSession> sessions = fetchSessionsBatch(sIds);
        Map<String, String> nicknameMap = sessions.stream()
                .collect(Collectors.toMap(GameSession::getUserId, GameSession::getNickname));

        List<Object[]> top5Raw = leaderboardService.getTopN(gameId, 5);
        List<Map<String, Object>> top5 = new ArrayList<>();
        for (int i = 0; i < top5Raw.size(); i++) {
            String uid = top5Raw.get(i)[0].toString();
            Map<String, Object> entry = new HashMap<>();
            entry.put("rank", i + 1);
            entry.put("userId", uid);
            entry.put("nickname", nicknameMap.getOrDefault(uid, uid));
            entry.put("score", top5Raw.get(i)[1]);
            top5.add(entry);
        }

        GameFinished finished = GameFinished.builder().gameId(gameId).top5(top5).build();
        gameEventPublisher.broadcastToGame(gameId, finished);
        gameEventPublisher.broadcastToHost(gameId, finished);
        saveResultsToGameAdmin(gameId);

        // Memory leak fix: oyuna ait puan geçmişini RAM'den temizle.
        // 300 kişi × 20 soru = 6000 kayıt. Temizlenmezse arka arkaya oyunlarda RAM şişer.
        questionScores.keySet().removeIf(key -> key.startsWith(gameId + ":"));

        log.info("Oyun bitti: gameId={}", gameId);
    }

    // ── Sonuçları GameAdmin'e kaydet ─────────────────────
    private void saveResultsToGameAdmin(String gameId) {
        try {
            List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
            List<GameSession> sessions = fetchSessionsBatch(sessionIds);
            List<Object[]> allScores = leaderboardService.getTopN(gameId, 1000);
            Map<String, Integer> rankMap = new HashMap<>();
            for (int i = 0; i < allScores.size(); i++)
                rankMap.put(allScores.get(i)[0].toString(), i + 1);

            List<Map<String, Object>> results = new ArrayList<>();
            for (GameSession session : sessions) {
                Map<String, Object> result = new HashMap<>();
                result.put("userId", session.getUserId());
                result.put("nickname", session.getNickname());
                result.put("totalScore", leaderboardService.getUserScore(gameId, session.getUserId()));
                result.put("rank", rankMap.getOrDefault(session.getUserId(), 0));
                results.add(result);
            }
            gameAdminClient.saveResults(gameId, results);
        } catch (Exception e) {
            log.error("Sonuçlar kaydedilemedi: {}", e.getMessage());
        }
    }

    // ── Yardımcılar ──────────────────────────────────────

    /*
     * Tüm session'ları tek Redis round-trip ile çeker.
     * Önceden: for döngüsünde 300 ayrı GET (N+1).
     * Şimdi: multiGet ile tek seferde.
     */
    private List<GameSession> fetchSessionsBatch(List<String> sessionIds) {
        if (sessionIds.isEmpty()) return Collections.emptyList();
        List<String> keys = sessionIds.stream()
                .map(id -> "session:" + id)
                .collect(Collectors.toList());
        List<Object> raw = redisTemplate.opsForValue().multiGet(keys);
        if (raw == null) return Collections.emptyList();
        return raw.stream()
                .filter(o -> o instanceof GameSession)
                .map(o -> (GameSession) o)
                .collect(Collectors.toList());
    }

    /*
     * Top10 listesi — sessionId içermez.
     * Ban işlemi userId üzerinden yapılır, backend O(1) ile session bulur.
     */
    private List<Map<String, Object>> buildTop10(String gameId) {
        List<String> sessionIds = gameSessionService.getPlayerIds(gameId);
        List<GameSession> sessions = fetchSessionsBatch(sessionIds);
        Map<String, String> nicknameMap = sessions.stream()
                .collect(Collectors.toMap(GameSession::getUserId, GameSession::getNickname));

        List<Object[]> raw = leaderboardService.getTop10(gameId);
        List<Map<String, Object>> result = new ArrayList<>();
        for (int i = 0; i < raw.size(); i++) {
            String uid = raw.get(i)[0].toString();
            Map<String, Object> entry = new HashMap<>();
            entry.put("rank", i + 1);
            entry.put("userId", uid);
            entry.put("nickname", nicknameMap.getOrDefault(uid, uid));
            entry.put("score", raw.get(i)[1]);
            result.add(entry);
        }
        return result;
    }

    // options sırası garantili — Map.of() sırasız, LinkedHashMap A/B/C/D sırasını korur
    private Map<String, String> buildOptions(Map<String, Object> question) {
        Map<String, String> opts = new LinkedHashMap<>();
        opts.put("A", (String) question.get("optionA"));
        opts.put("B", (String) question.get("optionB"));
        opts.put("C", (String) question.get("optionC"));
        opts.put("D", (String) question.get("optionD"));
        return opts;
    }

    public void recordQuestionScore(String gameId, String questionId, String userId, int score) {
        questionScores.put(gameId + ":" + questionId + ":" + userId, score);
    }

    public void cancelQuestionTimer(String gameId) {
        ScheduledFuture<?> future = questionTimers.remove(gameId + ":question");
        if (future != null) future.cancel(false);
    }

    private Map<String, Integer> convertDistribution(Map<Object, Object> raw) {
        Map<String, Integer> result = new HashMap<>();
        raw.forEach((k, v) -> result.put(k.toString(), Integer.parseInt(v.toString())));
        return result;
    }
}