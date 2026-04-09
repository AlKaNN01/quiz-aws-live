/*
 * Lobi asamasinda host ekranina gonderilir.
 * Oyuncu sayisi ve oyun kodu gosterilir.
 * /topic/game/{gameId}/host kanalından sadece host ekranina gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HostWaitingUpdate {
    @Builder.Default
    private String type = "HOST_WAITING_UPDATE";
    private int playerCount;
    private String gameCode;
}