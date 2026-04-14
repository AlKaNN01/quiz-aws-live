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

    /*
     * Browser UUID tabanlı dedup:
     * Aynı tarayıcıdan 2. join isteği geldiğinde (SockJS retry, sekme reload vb.)
     * mevcut session principalName güncellenerek döndürülür — yeni session açılmaz.
     *
     * IP tabanlı dedup'tan farkı: NAT/paylaşımlı WiFi arkasındaki farklı kullanıcılar
     * artık birbirini bloklamaz. Her tarayıcı kendi UUID'sine sahiptir.
     *
     * browserId null/boş gelirse fallback: principalName (WS session ID) kullanılır.
     * ipAddress yalnızca IP ban kontrolü için saklanır, dedup'ta kullanılmaz.
     */
    public GameSession getOrCreateSession(String gameId, String nickname,
                                          String ipAddress, String principalName,
                                          String browserId) {
        try {
            String dedupKey = (browserId != null && !browserId.isBlank()) ? browserId : principalName;

            Object existingSessionId = redisTemplate.opsForHash().get("game:" + gameId + ":browser_sessions", dedupKey);
            if (existingSessionId != null) {
                GameSession existing = getSession(existingSessionId.toString());
                if (existing != null && existing.getStatus() != GameSession.Status.BANNED) {
                    existing.setPrincipalName(principalName);
                    redisTemplate.opsForValue().set("session:" + existing.getSessionId(), existing, 2, TimeUnit.HOURS);
                    log.info("Mevcut session guncellendi (ayni browser): {} nickname: {}", existing.getSessionId(), existing.getNickname());
                    return existing;
                }
            }

            // Yeni session olustur — once nickname kontrolu
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

            // userId -> sessionId index
            redisTemplate.opsForValue().set("user_to_session:" + gameId + ":" + userId, sessionId, 3, TimeUnit.HOURS);

            // browserId/fallback -> sessionId index (aynı tarayıcıdan tekrar join gelirse yakalanır)
            redisTemplate.opsForHash().put("game:" + gameId + ":browser_sessions", dedupKey, sessionId);
            redisTemplate.expire("game:" + gameId + ":browser_sessions", 3, TimeUnit.HOURS);

            log.info("Session olusturuldu: {} nickname: {} browserId: {}", sessionId, nickname, dedupKey);
            return session;
        } catch (Exception e) {
            log.error("Redis hatasi - session olusturulamadi: gameId={} nickname={} hata={}", gameId, nickname, e.getMessage(), e);
            throw new RuntimeException("Oyuna katilim sirasinda bir hata olustu.", e);
        }
    }

    // Geriye dönük uyumluluk — browserId olmayan çağrılar için
    public GameSession createSession(String gameId, String nickname, String ipAddress, String principalName) {
        return getOrCreateSession(gameId, nickname, ipAddress, principalName, null);
    }

    public GameSession getSession(String sessionId) {
        try {
            Object obj = redisTemplate.opsForValue().get("session:" + sessionId);
            if (obj instanceof GameSession) return (GameSession) obj;
            return null;
        } catch (Exception e) {
            log.error("Redis hatasi - session okunamadi: sessionId={} hata={}", sessionId, e.getMessage());
            return null;
        }
    }

    /*
     * userId'den session'i O(1) hizinda bulur.
     * Eski yontem: players SET'i taranip her biri icin Redis GET (N+1 = 300 sorgu).
     * Yeni yontem: user_to_session index'ine tek sorgu.
     */
    public GameSession getSessionByUserId(String gameId, String userId) {
        try {
            Object sidObj = redisTemplate.opsForValue().get("user_to_session:" + gameId + ":" + userId);
            if (sidObj == null) return null;
            return getSession(sidObj.toString());
        } catch (Exception e) {
            log.error("Redis hatasi - userId ile session okunamadi: gameId={} userId={} hata={}", gameId, userId, e.getMessage());
            return null;
        }
    }

    public boolean isNicknameTaken(String gameId, String nickname) {
        try {
            return Boolean.TRUE.equals(redisTemplate.opsForSet().isMember("game:" + gameId + ":nicknames", nickname));
        } catch (Exception e) {
            log.error("Redis hatasi - nickname kontrolu yapilamadi: gameId={} hata={}", gameId, e.getMessage());
            return true; // güvenli default: şüphelenilen nickname'i reddet
        }
    }

    public int getPlayerCount(String gameId) {
        try {
            Long count = redisTemplate.opsForSet().size("game:" + gameId + ":players");
            return count != null ? count.intValue() : 0;
        } catch (Exception e) {
            log.error("Redis hatasi - oyuncu sayisi okunamadi: gameId={} hata={}", gameId, e.getMessage());
            return 0;
        }
    }

    public int getAnsweredCount(String gameId, String questionId) {
        try {
            Long count = redisTemplate.opsForSet().size("answered:" + gameId + ":" + questionId);
            return count != null ? count.intValue() : 0;
        } catch (Exception e) {
            log.error("Redis hatasi - cevap sayisi okunamadi: gameId={} questionId={} hata={}", gameId, questionId, e.getMessage());
            return 0;
        }
    }

    public void deleteSession(String sessionId, String gameId, String nickname, String userId, String ipAddress, String browserId) {
        try {
            redisTemplate.delete("session:" + sessionId);
            redisTemplate.delete("user_to_session:" + gameId + ":" + userId);
            redisTemplate.opsForSet().remove("game:" + gameId + ":players", sessionId);
            redisTemplate.opsForSet().remove("game:" + gameId + ":nicknames", nickname);

            // browserId varsa hash'ten explicit olarak sil
            if (browserId != null && !browserId.isBlank()) {
                redisTemplate.opsForHash().delete("game:" + gameId + ":browser_sessions", browserId);
            }
        } catch (Exception e) {
            log.error("Redis hatasi - session silinemedi: sessionId={} gameId={} hata={}", sessionId, gameId, e.getMessage());
        }
    }

    // Geriye dönük uyumluluk — browserId olmayan çağrılar için
    public void deleteSession(String sessionId, String gameId, String nickname, String userId, String ipAddress) {
        deleteSession(sessionId, gameId, nickname, userId, ipAddress, null);
    }

    public List<String> getPlayerIds(String gameId) {
        try {
            Set<Object> members = redisTemplate.opsForSet().members("game:" + gameId + ":players");
            if (members == null) return new ArrayList<>();
            return members.stream().map(Object::toString).toList();
        } catch (Exception e) {
            log.error("Redis hatasi - oyuncu listesi okunamadi: gameId={} hata={}", gameId, e.getMessage());
            return new ArrayList<>();
        }
    }
}