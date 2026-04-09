/*
 * Oyun bittiginde herkese ve host ekranina gonderilir.
 * top5: Frontend dramatik sekilde birer birer acar.
 * /topic/game/{gameId} kanalından herkese gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class GameFinished {
    @Builder.Default
    private String type = "GAME_FINISHED";
    private String gameId;
    private List<Map<String, Object>> top5; // [{rank, nickname, score}]
}