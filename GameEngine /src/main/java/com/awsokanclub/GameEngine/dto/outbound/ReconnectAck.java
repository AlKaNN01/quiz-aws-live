/*
 * Baglantisi kopup yeniden baglanan oyuncuya mevcut oyun durumu gonderilir.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.Map;

@Data
@Builder
public class ReconnectAck {
    @Builder.Default
    private String type = "RECONNECT_ACK";
    private boolean success;
    private String sessionId;
    private int totalScore;
    private String gameStatus;
    private Map<String, Object> currentQuestion;
}