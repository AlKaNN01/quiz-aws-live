/*
 * Oyuncu cevaplarini atomik olarak kaydeder, tekrar eden cevabi engeller.
 * Kahoot formülüyle puan hesaplar, sik dagılımını ve cevaplayan sayısını tutar.
 */
package com.awsokanclub.GameEngine.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AnswerService {

    private final RedisTemplate<String, Object> redisTemplate;

    // Cevabi atomik olarak kaydeder.
    // SET NX kullanilir — ayni kullanici ayni soruya iki kez cevap veremez.
    // false donerse kullanici zaten cevap vermis demektir.
    public boolean recordAnswer(String gameId, String questionId, String userId, String answer) {
        String key = "answer:" + gameId + ":" + questionId + ":" + userId;
        Boolean isFirst = redisTemplate.opsForValue().setIfAbsent(key, answer, 24, TimeUnit.HOURS);
        if (Boolean.TRUE.equals(isFirst)) {
            // Sik dagılımını guncelle — kac kisi hangi sikki secti
            redisTemplate.opsForHash().increment(
                    "answer:dist:" + gameId + ":" + questionId, answer, 1
            );
            redisTemplate.expire("answer:dist:" + gameId + ":" + questionId, 24, TimeUnit.HOURS);
        }
        return Boolean.TRUE.equals(isFirst);
    }

    /*
     * Puan hesaplama — Kahoot formülü.
     *
     * Taban puan: min 500, max 1000 (doğru cevapta).
     * Formül: base = (1 - ratio/2) × 1000  [Kahoot'la birebir aynı: 500 + 500×(1-ratio)]
     *
     * Streak bonus (ardışık doğru cevaplar):
     *   - 2 ardışık → +100 puan
     *   - 3+ ardışık → +200 puan
     *   Toplam skor 1200 ile sınırlandırılır.
     *
     * Kural dışı durumlar:
     *   - reactionTimeMs < 150 → fizyolojik olarak imkânsız, bot şüphesi → 0
     *   - reactionTimeMs ≥ maxMs → süre aşımı → 0
     *   - yanlış cevap → 0, streak sıfırlanır
     */
    public int calculateScore(long reactionTimeMs, int timerSeconds, boolean isCorrect, int streak) {
        if (!isCorrect) return 0;
        if (reactionTimeMs < 150) return 0;
        long maxMs = timerSeconds * 1000L;
        if (reactionTimeMs >= maxMs) return 0;
        double ratio = (double) reactionTimeMs / maxMs;
        int base = (int) Math.round((1.0 - ratio / 2.0) * 1000.0);
        int bonus = streak >= 3 ? 200 : streak == 2 ? 100 : 0;
        return Math.min(base + bonus, 1200);
    }

    // Geriye dönük uyumluluk (streak yok → bonus 0)
    public int calculateScore(long reactionTimeMs, int timerSeconds, boolean isCorrect) {
        return calculateScore(reactionTimeMs, timerSeconds, isCorrect, 0);
    }

    /*
     * Streak takibi — doğru cevapta artırır, yanlışta sıfırlar.
     * Döndürülen değer: güncel streak (doğruysa ≥ 1, yanlışsa 0).
     * Redis key: streak:{gameId}:{userId}, oyun bitiminde cleanupGameRedis ile silinir.
     */
    public int recordAndGetStreak(String gameId, String userId, boolean isCorrect) {
        String key = "streak:" + gameId + ":" + userId;
        if (!isCorrect) {
            redisTemplate.delete(key);
            return 0;
        }
        Long streak = redisTemplate.opsForValue().increment(key);
        redisTemplate.expire(key, 24, TimeUnit.HOURS);
        return streak != null ? streak.intValue() : 1;
    }

    // Host ekraninin "X/300 cevapladi" sayaci icin cevaplayan oyuncuyu kaydeder.
    // answered:{gameId}:{questionId} setine userId eklenir.
    public void recordAnsweredPlayer(String gameId, String questionId, String userId) {
        String key = "answered:" + gameId + ":" + questionId;
        redisTemplate.opsForSet().add(key, userId);
        redisTemplate.expire(key, 24, TimeUnit.HOURS);
    }

    public boolean hasAnswered(String gameId, String questionId, String userId) {
        return Boolean.TRUE.equals(
                redisTemplate.opsForSet().isMember("answered:" + gameId + ":" + questionId, userId));
    }

    // Soru bittiginde hangi sikki kac kisi secti bilgisini dondurur.
    // QUESTION_END mesajindaki answerDistribution alani buradan doldurulur.
    public Map<Object, Object> getAnswerDistribution(String gameId, String questionId) {
        return redisTemplate.opsForHash().entries(
                "answer:dist:" + gameId + ":" + questionId
        );
    }
}