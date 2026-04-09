/*
 * Yeni soru basladiginda tum oyunculara ve host ekranina gonderilir.
 * Frontend startedAt + timerSeconds ile kendi timer'ini kurar.
 * /topic/game/{gameId} kanalından herkese gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class QuestionStart {
    @Builder.Default
    private String type = "QUESTION_START";
    private String gameId;
    private String questionId;
    private int questionIndex;
    private int totalQuestions;
    private String questionText;
    private Map<String, String> options; // {A: "...", B: "...", C: "...", D: "..."}
    private int timerSeconds;
    private long startedAt;
}