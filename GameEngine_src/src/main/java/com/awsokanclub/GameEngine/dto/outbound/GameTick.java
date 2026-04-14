/*
 * Server her 200ms gönderilen timer tick mesajı.
 * Client saat senkronizasyonu için sunucu-side timer kullanılır.
 * Client sadece bu değeri gösterir, hesaplama yapmaz.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameTick {
    @Builder.Default
    private String type = "GAME_TICK";
    private String gameId;
    private String questionId;
    private int secondsRemaining;
    private long timestamp;
}
