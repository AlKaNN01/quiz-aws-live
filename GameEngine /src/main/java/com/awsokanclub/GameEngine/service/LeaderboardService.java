/*
 * Redis ZSET uzerinde puan ve siralama islemlerini yonetir.
 * ZSET yapisi: key=leaderboard:{gameId}, member=userId, score=toplam puan.
 * En yuksek puan en uste gelir (ZREVRANGE kullanilir).
 */
package com.awsokanclub.GameEngine.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeaderboardService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Oyuncunun puanini arttirir.
    // ZINCRBY: mevcut puana ekler, yoksa olusturur.
    public void addScore(String gameId, String userId, int points) {
        String key = "leaderboard:" + gameId;
        redisTemplate.opsForZSet().incrementScore(key, userId, points);
        redisTemplate.expire(key, 3, TimeUnit.HOURS);
        log.debug("Puan eklendi: {} userId: {} points: {}", gameId, userId, points);
    }

    // Oyuncunun siradaki yerini dondurur. 0 = birinci.
    // null donerse oyuncu leaderboard'da yok demektir.
    public Long getRank(String gameId, String userId) {
        return redisTemplate.opsForZSet().reverseRank("leaderboard:" + gameId, userId);
    }

    // Oyuncunun toplam puanini dondurur.
    public int getUserScore(String gameId, String userId) {
        Double score = redisTemplate.opsForZSet().score("leaderboard:" + gameId, userId);
        return score != null ? score.intValue() : 0;
    }

    // Ilk N kisiyi puana gore sirali dondurur.
    // Her eleman: [userId, puan] seklinde bir Object dizisi.
    // SCORE_REVEAL ve GAME_FINISHED mesajlari bu metodu kullanir.
    public List<Object[]> getTopN(String gameId, int n) {
        Set<org.springframework.data.redis.core.ZSetOperations.TypedTuple<Object>> result =
                redisTemplate.opsForZSet().reverseRangeWithScores("leaderboard:" + gameId, 0, n - 1);

        List<Object[]> list = new ArrayList<>();
        if (result != null) {
            for (var entry : result) {
                list.add(new Object[]{ entry.getValue(), entry.getScore() });
            }
        }
        return list;
    }

    // Ilk 10 kisiyi dondurur. SCORE_REVEAL'de kullanilir.
    public List<Object[]> getTop10(String gameId) {
        return getTopN(gameId, 10);
    }

    // Ban sonrasi oyuncuyu leaderboard'dan kaldirir.
    // 11. kisi otomatik olarak 10. siraya gelir.
    public void removePlayer(String gameId, String userId) {
        redisTemplate.opsForZSet().remove("leaderboard:" + gameId, userId);
        log.info("Oyuncu leaderboard'dan kaldirildi: {} userId: {}", gameId, userId);
    }
    // Oyuncunun sırasını 1-bazlı döndürür
    public int getUserRank(String gameId, String userId) {
        Long rank = redisTemplate.opsForZSet().reverseRank("leaderboard:" + gameId, userId);
        return rank != null ? rank.intValue() + 1 : 0;
    }
}