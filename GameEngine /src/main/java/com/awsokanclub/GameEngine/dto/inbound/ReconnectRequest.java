/*
 * Baglantisi kopan oyuncunun yeniden baglanma istegi.
 * Frontend'den /app/game.reconnect adresine gonderilir.
 */
package com.awsokanclub.GameEngine.dto.inbound;

import lombok.Data;

@Data
public class ReconnectRequest {
    private String sessionId;
    private String gameId;
}