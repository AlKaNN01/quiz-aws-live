/*
 * Her cevap geldiginde host ekranina gonderilir.
 * "147/300 cevapladi" seklinde canli sayac icin kullanilir.
 * /topic/game/{gameId}/host kanalından sadece host ekranina gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostAnswerCount {
    @Builder.Default
    private String type = "HOST_ANSWER_COUNT";
    private String questionId;
    private int answeredCount;
    private int totalPlayers;
}