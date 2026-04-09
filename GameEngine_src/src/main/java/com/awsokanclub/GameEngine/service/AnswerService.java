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

    // Puan hesaplamasi.
    // reactionTimeMs: Frontend'in olctugu sure — butona basildigı an ile sorunun
    // basladigi an arasindaki fark. Sunucu saati kullanilmaz, ping adaletsizligi onlenir.
    // 150ms alti: fizyolojik olarak imkansiz, hile sayilir → 0 puan.
    // Sure asiminda: 0 puan.
    // Ne kadar hizli basarsan o kadar yuksek puan, max 1000.
    public int calculateScore(long reactionTimeMs, int timerSeconds, boolean isCorrect) {
        if (!isCorrect) return 0;
        if (reactionTimeMs < 150) return 0;
        long maxMs = timerSeconds * 1000L;
        if (reactionTimeMs >= maxMs) return 0;
        double ratio = (double) reactionTimeMs / maxMs;
        return (int) Math.round((1.0 - ratio / 2.0) * 1000.0);
    }

    // Host ekraninin "X/300 cevapladi" sayaci icin cevaplayan oyuncuyu kaydeder.
    // answered:{gameId}:{questionId} setine userId eklenir.
    public void recordAnsweredPlayer(String gameId, String questionId, String userId) {
        String key = "answered:" + gameId + ":" + questionId;
        redisTemplate.opsForSet().add(key, userId);
        redisTemplate.expire(key, 24, TimeUnit.HOURS);
    }

    // Soru bittiginde hangi sikki kac kisi secti bilgisini dondurur.
    // QUESTION_END mesajindaki answerDistribution alani buradan doldurulur.
    public Map<Object, Object> getAnswerDistribution(String gameId, String questionId) {
        return redisTemplate.opsForHash().entries(
                "answer:dist:" + gameId + ":" + questionId
        );
    }
}