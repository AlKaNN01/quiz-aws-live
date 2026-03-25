/*
 * Banlama ve engel kontrol işlemlerini yönetir.
 *
 * REFACTOR:
 * - broadcastToGame ile BANNED yayını kaldırıldı (geçici yamadır).
 *   Artık backend userId'den O(1) ile session'ı buluyor, principalName güvenilir geliyor.
 *   BANNED mesajı sadece o oyuncuya sendToUser ile gönderiliyor.
 * - Frontend'de userId filtresi artık gerekmiyor.
 */
package com.awsokanclub.GameEngine.service;

import com.awsokanclub.GameEngine.model.GameSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class ModerationService {

    private final RedisTemplate<String, Object> redisTemplate;
    private final GameSessionService gameSessionService;
    private final LeaderboardService leaderboardService;
    private final GameEventPublisher gameEventPublisher;

    public void banPlayer(String gameId, String sessionId, String userId,
                          String ipAddress, String adminId, String reason) {

        // 1. Session'ı BANNED olarak işaretle
        GameSession session = gameSessionService.getSession(sessionId);
        if (session != null) {
            session.setStatus(GameSession.Status.BANNED);
            redisTemplate.opsForValue().set("session:" + sessionId, session, 2, TimeUnit.HOURS);
        }

        // 2. Ban key'lerini yaz
        redisTemplate.opsForValue().set("ban:session:" + sessionId, reason, 24, TimeUnit.HOURS);
        if (ipAddress != null && !ipAddress.equals("unknown")) {
            redisTemplate.opsForValue().set("ban:ip:" + ipAddress, reason, 24, TimeUnit.HOURS);
        }

        // 3. Leaderboard'dan kaldır
        leaderboardService.removePlayer(gameId, userId);

        // 4. Players SET'inden kaldır — yoksa her güncellemede geri gelir
        redisTemplate.opsForSet().remove("game:" + gameId + ":players", sessionId);

        // 5. Sadece o oyuncuya BANNED gönder — principalName artık güvenilir
        // (userId → sessionId O(1) lookup ile session doğru geliyor)
        String principalName = session != null ? session.getPrincipalName() : sessionId;
        gameEventPublisher.sendToUser(principalName, Map.of(
                "type", "BANNED",
                "message", "Oyundan çıkarıldınız.",
                "reason", reason != null ? reason : "",
                "permanent", false
        ));

        log.info("Oyuncu banlandı: sessionId={} userId={} reason={}", sessionId, userId, reason);
    }

    public boolean isIpBanned(String ipAddress) {
        return Boolean.TRUE.equals(redisTemplate.hasKey("ban:ip:" + ipAddress));
    }

    public boolean isSessionBanned(String sessionId) {
        GameSession session = gameSessionService.getSession(sessionId);
        if (session == null) return false;
        return session.getStatus() == GameSession.Status.BANNED;
    }
}