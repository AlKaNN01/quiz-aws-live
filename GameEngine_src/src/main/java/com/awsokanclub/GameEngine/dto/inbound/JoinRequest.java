/*
 * Oyuncunun oyuna katilma istegi.
 * Frontend'den /app/game.join adresine gonderilir.
 */
package com.awsokanclub.GameEngine.dto.inbound;

import lombok.Data;

@Data
public class JoinRequest {
    private String gameId;
    private String joinCode;
    private String nickname;
}