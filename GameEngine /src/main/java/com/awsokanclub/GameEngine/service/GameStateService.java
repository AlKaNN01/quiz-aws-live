/*
 * Oyunun mevcut durumunu Redis'te saklar ve günceller.
 * Hangi soruda olunduğu, timer'ın ne zaman başladığı, oyunun hangi aşamada olduğu burada tutulur.
 *
 * REFACTOR:
 * - GameAdminClient bağımlılığı kaldırıldı (bu servis oyun state'i yönetir, API çağrısı yapmaz)
 * - getRedisTemplate() kaldırıldı (encapsulation ihlaliydi — başka servisler artık buradan Redis almaz)
 * - getPlayerAnswer() metodu eklendi (GameFlowService'in ihtiyaç duyduğu tek şey buydu)
 * - duplicate saveState(String, GameState) kaldırıldı, tek saveState(GameState) kullanılıyor
 */
package com.awsokanclub.GameEngine.service;

import com.awsokanclub.GameEngine.model.GameState;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameStateService {

    private final RedisTemplate<String, Object> redisTemplate;

    // ── State kaydet / oku ──────────────────────────────

    public void saveState(GameState state) {
        redisTemplate.opsForValue().set(
                "game:" + state.getGameId() + ":state",
                state,
                3, TimeUnit.HOURS
        );
    }

    public GameState getState(String gameId) {
        Object obj = redisTemplate.opsForValue().get("game:" + gameId + ":state");
        if (obj instanceof GameState) return (GameState) obj;
        return null;
    }

    public void updateStatus(String gameId, GameState.Status status) {
        GameState state = getState(gameId);
        if (state != null) {
            state.setStatus(status);
            saveState(state);
        }
    }

    // ── Sorular ──────────────────────────────────────────────

    public void saveQuestions(String gameId, List<Map<String, Object>> questions) {
        redisTemplate.opsForValue().set(
                "game:" + gameId + ":questions",
                questions,
                3, TimeUnit.HOURS
        );
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> getQuestion(String gameId, int index) {
        Object obj = redisTemplate.opsForValue().get("game:" + gameId + ":questions");
        if (obj instanceof List<?> list && index < list.size()) {
            return (Map<String, Object>) list.get(index);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    public String getCorrectAnswer(String gameId, String questionId) {
        Object obj = redisTemplate.opsForValue().get("game:" + gameId + ":questions");
        if (obj instanceof List<?> list) {
            for (Object item : list) {
                Map<String, Object> q = (Map<String, Object>) item;
                if (questionId.equals(q.get("id").toString())) {
                    return q.get("correctAnswer").toString();
                }
            }
        }
        return null;
    }

    // ── Oyuncu cevabı ────────────────────────────────────────
    // GameFlowService'in getRedisTemplate()'e ihtiyaç duymasının tek sebebi buydu.
    // Artık bu metod burada — encapsulation düzgün.

    public String getPlayerAnswer(String gameId, String questionId, String userId) {
        Object ans = redisTemplate.opsForValue().get(
                "answer:" + gameId + ":" + questionId + ":" + userId
        );
        return ans != null ? ans.toString() : null;
    }

    // ── Admin principal ──────────────────────────────────────

    public void setAdminPrincipal(String gameId, String principalName) {
        redisTemplate.opsForValue().set(
                "game:" + gameId + ":adminPrincipal",
                principalName,
                3, TimeUnit.HOURS
        );
    }

    public String getAdminPrincipal(String gameId) {
        Object obj = redisTemplate.opsForValue().get("game:" + gameId + ":adminPrincipal");
        return obj != null ? obj.toString() : null;
    }
}