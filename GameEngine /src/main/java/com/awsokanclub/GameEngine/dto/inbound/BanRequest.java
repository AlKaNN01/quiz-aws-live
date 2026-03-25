/*
 * Admin'in oyuncu banlama isteği.
 * /app/admin.ban adresine gönderilir.
 *
 * REFACTOR: sessionId kaldırıldı.
 * Frontend sessionId'yi bilmek zorunda değil — backend userId'den O(1) ile bulur.
 */
package com.awsokanclub.GameEngine.dto.inbound;

import lombok.Data;

@Data
public class BanRequest {
    private String gameId;
    private String userId;
    private String adminToken;
    private String reason;
}