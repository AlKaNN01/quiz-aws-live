/*
 * Lobi ekranina oyuncu sayisi guncelleme mesaji.
 * Her yeni oyuncu katildiginda lobideki herkese gonderilir.
 * /topic/game/{gameId}/lobby kanalından herkese gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WaitingRoomUpdate {
    @Builder.Default
    private String type = "WAITING_ROOM_UPDATE";
    private int playerCount;
}