/*
 * Oyuncunun cevap gondermesi.
 * Frontend'den /app/game.answer adresine gonderilir.
 * reactionTimeMs: Frontend'in olctugu sure — butona basildigı an ile
 * sorunun basladigi an arasindaki fark (ms). Puan hesabinda kullanilir.
 */
package com.awsokanclub.GameEngine.dto.inbound;

import lombok.Data;

@Data
public class AnswerSubmit {
    private String gameId;
    private String questionId;
    private String sessionId;
    private String answer;         // A, B, C veya D
    private long reactionTimeMs;   // Frontend olcer, sunucu dogrular
}