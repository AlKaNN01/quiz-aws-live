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
    /*
     * Browser UUID — localStorage'dan gelir, IP yerine dedup için kullanılır.
     * Aynı tarayıcıdan ikinci join → mevcut session güncellenir, yeni session açılmaz.
     * NAT/paylaşılan WiFi arkasındaki farklı kullanıcıları bloklamaz.
     * Boş gelirse fallback: WS session principalName'i kullanılır.
     */
    private String browserId;
}