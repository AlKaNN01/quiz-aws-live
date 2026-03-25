/*
 * Oyuncu cevabını gönderince sadece o oyuncuya gönderilir.
 * "Cevabın alındı, süre bekleniyor..." ekranını tetikler.
 * Diğer oyuncular soruyu görmeye devam eder.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AnswerReceived {
    @Builder.Default
    private String type = "ANSWER_RECEIVED";
    private String gameId;
    private String questionId;
    private String yourAnswer;
}