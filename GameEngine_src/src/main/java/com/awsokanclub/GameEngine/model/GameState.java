package com.awsokanclub.GameEngine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameState {

    private String gameId;
    private String currentQuestionId;
    private int currentQuestionIndex;
    private int totalQuestions;
    private long questionStartedAt;
    private int timerSeconds;
    private Status status;
    private boolean hostConnected;
    private boolean lobbyOpen;
    // Hydration için: admin reconnect'te LEADERBOARD_REVIEW timeout'u restore edilir
    private long autoPublishAt;

    public enum Status {
        WAITING,
        QUESTION_INTRO,     // Tanımlı ama şu an kullanılmıyor — ileride intro animasyonu için
        QUESTION_ACTIVE,
        QUESTION_END,       // Süre bitti, doğru cevap gösteriliyor
        ANSWER_REVEAL,      // Kişisel cevap gösterimi
        LEADERBOARD_REVIEW,
        SCORE_REVEALING,
        COUNTDOWN,
        FINISHED
    }

    /*
     * FSM — İzin verilen state geçişleri.
     * updateStatus() bu haritayı kontrol eder; geçersiz geçişler WARN loglanır ama bloklanmaz.
     * Any state → WAITING: admin.restart'ta her yerden sıfırlama yapılabilir.
     */
    private static final Map<Status, Set<Status>> VALID_TRANSITIONS = Map.of(
        Status.WAITING,           EnumSet.of(Status.COUNTDOWN),
        Status.COUNTDOWN,         EnumSet.of(Status.QUESTION_ACTIVE, Status.QUESTION_INTRO),
        Status.QUESTION_INTRO,    EnumSet.of(Status.QUESTION_ACTIVE),
        Status.QUESTION_ACTIVE,   EnumSet.of(Status.QUESTION_END),
        Status.QUESTION_END,      EnumSet.of(Status.ANSWER_REVEAL),
        Status.ANSWER_REVEAL,     EnumSet.of(Status.LEADERBOARD_REVIEW),
        Status.LEADERBOARD_REVIEW,EnumSet.of(Status.SCORE_REVEALING, Status.FINISHED),
        Status.SCORE_REVEALING,   EnumSet.of(Status.COUNTDOWN, Status.FINISHED),
        Status.FINISHED,          EnumSet.of(Status.WAITING)
    );

    public boolean isValidTransition(Status to) {
        if (to == Status.WAITING) return true; // restart her zaman izinli
        Set<Status> allowed = VALID_TRANSITIONS.get(this.status);
        return allowed != null && allowed.contains(to);
    }
}