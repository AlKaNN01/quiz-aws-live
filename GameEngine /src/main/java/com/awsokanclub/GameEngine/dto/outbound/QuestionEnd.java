/*
 * Soru bittiginde dogru cevap ve sik dagilimini gonderir.
 * /topic/game/{gameId} kanalından herkese ve host ekranina gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class QuestionEnd {
    @Builder.Default
    private String type = "QUESTION_END";
    private String gameId;
    private String questionId;
    private String correctAnswer;
    private Map<String, Integer> answerDistribution; // {A: 23, B: 201, C: 15, D: 8}
    private int totalAnswered;
    private int totalPlayers;
}