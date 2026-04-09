/*
 * Ban yapildiginda admin paneline gonderilir.
 * 11. kisi 10. siraya gelir, admin guncell listeyi gorur.
 * /user/queue/admin kanalından sadece admin'e gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class LeaderboardUpdated {
    @Builder.Default
    private String type = "LEADERBOARD_UPDATED";
    private String gameId;
    private String questionId;
    private List<Map<String, Object>> top10;
}