/*
 * Admin onayı veya 30sn timeout sonrasi puan ve siralama gosterilir.
 * nextQuestionAt: epoch ms — frontend bu zamana kadar leaderboard gösterir,
 * sonra kendi countdown'ını başlatır. Backend artık NEXT_QUESTION_COUNTDOWN göndermez.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@Builder
public class ScoreReveal {
    @Builder.Default
    private String type = "SCORE_REVEAL";
    private String gameId;
    private String questionId;
    private int pointsEarned;
    private int totalScore;
    private int myRank;
    private int rankChange;
    private int totalPlayers;
    private long nextQuestionAt; // 0 ise son soru, frontend GAME_FINISHED bekler
    private List<Map<String, Object>> top10;
}