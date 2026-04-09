package com.awsokanclub.GameEngine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

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

    public enum Status {
        WAITING,
        QUESTION_INTRO,
        QUESTION_ACTIVE,
        QUESTION_END,       // Süre bitti, doğru cevap gösteriliyor
        ANSWER_REVEAL,      // Kişisel cevap gösterimi
        LEADERBOARD_REVIEW,
        SCORE_REVEALING,
        COUNTDOWN,
        FINISHED
    }
}