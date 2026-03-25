/*
 * Soru bittikten 3sn sonra her oyuncuya kişisel olarak gönderilir.
 * Oyuncu kendi cevabını, doğru cevabı ve doğru/yanlış olduğunu görür.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AnswerReveal {
    @Builder.Default
    private String type = "ANSWER_REVEAL";
    private String gameId;
    private String questionId;
    private String correctAnswer;
    private String yourAnswer;      // null ise süre dolana kadar cevap vermedi
    private boolean isCorrect;
    private int pointsEarned;
}