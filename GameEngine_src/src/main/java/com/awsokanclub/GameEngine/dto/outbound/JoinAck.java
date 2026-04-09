/*
 * Oyuncunun katilma isteğine verilen cevap.
 * Basarili veya hatali olabilir.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class JoinAck {
    @Builder.Default
    private String type = "JOIN_ACK";
    private boolean success;
    // Basari durumunda dolar:
    private String sessionId;
    private String userId;
    private String nickname;
    private String gameId;
    private int playerCount;
    // Hata durumunda dolar:
    private String errorCode;
    private String message;
}