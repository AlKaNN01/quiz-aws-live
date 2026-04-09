/*
 * Adminin leaderboard'u onaylamasi.
 * Admin panelinden /app/admin.leaderboard.approve adresine gonderilir.
 * hostToken: Admin yetkisini dogrulamak icin JWT token.
 */
package com.awsokanclub.GameEngine.dto.inbound;

import lombok.Data;

@Data
public class LeaderboardApprove {
    private String gameId;
    private String questionId;
    private String adminToken;
}