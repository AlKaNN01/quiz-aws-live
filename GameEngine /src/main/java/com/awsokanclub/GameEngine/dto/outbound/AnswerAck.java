/*
 * Oyuncunun cevabinin alındigını bildiren mesaj.
 * isCorrect YOKTUR — dogru cevap sure dolmadan ifsa edilmez.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AnswerAck {
    @Builder.Default
    private String type = "ANSWER_ACK";
    private String questionId;
    private String yourAnswer;
    private boolean received;
}