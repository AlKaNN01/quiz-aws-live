/*
 * Bir oyuncu bağlandığında kimlik kartı oluşturur ve Redis'e kaydeder.
 *
 * REFACTOR:
 * - createSession'da user_to_session:{gameId}:{userId} index eklendi.
 *   Ban ve lookup işlemleri artık O(1) — önceden tüm oyuncuları tarayıp 300 Redis GET yapıyordu.
 * - getSessionByUserId(gameId, userId) metodu eklendi: O(1) hızında direkt lookup.
 * - deleteSession'da index temizleniyor.
 */
package com.awsokanclub.GameEngine.service;

import com.awsokanclub.GameEngine.model.GameSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameSessionService {

    private final RedisTemplate<String, Object> redisTemplate;

    public GameSession createSession(String gameId, String nickname, String ipAddress, String principalName) {
        Long added = redisTemplate.opsForSet().add("game:" + gameId + ":nicknames", nickname);
        if (added == null || added == 0) return null;

        String sessionId = UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        String userId = "user_" + UUID.randomUUID().toString().substring(0, 8);

        GameSession session = GameSession.builder()
                .sessionId(sessionId)
                .userId(userId)
                .nickname(nickname)
                .gameId(gameId)
                .ipAddress(ipAddress)
                .principalName(principalName)
                .joinedAt(System.currentTimeMillis())
                .status(GameSession.Status.ACTIVE)
                .build();

        redisTemplate.opsForValue().set("session:" + sessionId, session, 2, TimeUnit.HOURS);
        redisTemplate.opsForSet().add("game:" + gameId + ":players", sessionId);
        redisTemplate.expire("game:" + gameId + ":players", 3, TimeUnit.HOURS);
        redisTemplate.expire("game:" + gameId + ":nicknames", 3, TimeUnit.HOURS);

        // userId -> sessionId index: ban ve arama O(1) olsun
        redisTemplate.opsForValue().set(
                "user_to_session:" + gameId + ":" + userId,
                sessionId,
                3, TimeUnit.HOURS
        );

        log.info("Session olusturuldu: {} nickname: {}", sessionId, nickname);
        return session;
    }

    public GameSession getSession(String sessionId) {
        Object obj = redisTemplate.opsForValue().get("session:" + sessionId);
        if (obj instanceof GameSession) return (GameSession) obj;
        return null;
    }

    /*
     * userId'den session'i O(1) hizinda bulur.
     * Eski yontem: players SET'i taranip her biri icin Redis GET (N+1 = 300 sorgu).
     * Yeni yontem: user_to_session index'ine tek sorgu.
     */
    public GameSession getSessionByUserId(String gameId, String userId) {
        Object sidObj = redisTemplate.opsForValue().get("user_to_session:" + gameId + ":" + userId);
        if (sidObj == null) return null;
        return getSession(sidObj.toString());
    }

    public boolean isNicknameTaken(String gameId, String nickname) {
        return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember("game:" + gameId + ":nicknames", nickname));
    }

    public int getPlayerCount(String gameId) {
        Long count = redisTemplate.opsForSet().size("game:" + gameId + ":players");
        return count != null ? count.intValue() : 0;
    }

    public int getAnsweredCount(String gameId, String questionId) {
        Long count = redisTemplate.opsForSet().size("answered:" + gameId + ":" + questionId);
        return count != null ? count.intValue() : 0;
    }

    public void deleteSession(String sessionId, String gameId, String nickname, String userId) {
        redisTemplate.delete("session:" + sessionId);
        redisTemplate.delete("user_to_session:" + gameId + ":" + userId);
        redisTemplate.opsForSet().remove("game:" + gameId + ":players", sessionId);
        redisTemplate.opsForSet().remove("game:" + gameId + ":nicknames", nickname);
    }

    public List<String> getPlayerIds(String gameId) {
        Set<Object> members = redisTemplate.opsForSet().members("game:" + gameId + ":players");
        if (members == null) return new ArrayList<>();
        return members.stream().map(Object::toString).toList();
    }
}