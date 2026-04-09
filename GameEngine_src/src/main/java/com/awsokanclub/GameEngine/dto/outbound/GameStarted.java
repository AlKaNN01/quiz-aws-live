/*
 * Admin oyunu baslattiginda herkese ve host ekranina gonderilir.
 * /topic/game/{gameId} kanalından herkese gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class GameStarted {
    @Builder.Default
    private String type = "GAME_STARTED";
    private String gameId;
    private String message;
}