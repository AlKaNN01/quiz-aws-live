/*
 * Soru bittikten 2sn sonra sadece admin paneline gonderilir.
 * Admin 30sn icerisinde inceleyip ban yapabilir veya onaylayabilir.
 * autoPublishAt: 30sn sonrasinin epoch degeri — admin paneli sayac gosterir.
 * /user/queue/admin kanalından sadece admin'e gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class LeaderboardPending {
    @Builder.Default
    private String type = "LEADERBOARD_PENDING";
    private String gameId;
    private String questionId;
    private long autoPublishAt;
    private List<Map<String, Object>> top10;
}