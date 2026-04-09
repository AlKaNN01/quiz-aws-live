/*
 * Tum WebSocket mesajlarini gonderme merkezi.
 * Hicbir controller veya service SimpMessagingTemplate'i direkt kullanmaz,
 * hepsi bu sinif uzerinden gonderir.
 */
package com.awsokanclub.GameEngine.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameEventPublisher {

    private final SimpMessagingTemplate messagingTemplate;
    private final TaskScheduler taskScheduler;

    // Aktif auto-publish zamanlayicilarini tutar.
    // Admin onayladıgında ilgili zamanlayiciyi iptal etmek icin kullanilir.
    private final Map<String, ScheduledFuture<?>> pendingPublishTasks = new ConcurrentHashMap<>();

    // Oyundaki tum oyunculara mesaj gonderir.
    public void broadcastToGame(String gameId, Object message) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId, message);
        log.debug("Broadcast gonderildi: /topic/game/{}", gameId);
    }

    // Host ekranina ozel mesaj gonderir. Oyuncular bu kanali dinlemez.
    public void broadcastToHost(String gameId, Object message) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/host", message);
        log.debug("Host broadcast gonderildi: /topic/game/{}/host", gameId);
    }

    // Lobi ekranina mesaj gonderir (oyuncu sayisi guncelleme gibi).
    public void broadcastToLobby(String gameId, Object message) {
        messagingTemplate.convertAndSend("/topic/game/" + gameId + "/lobby", message);
    }

    // Tek bir oyuncuya ozel mesaj gonderir (JOIN_ACK, ANSWER_ACK, BANNED vs).
    public void sendToUser(String sessionId, Object message) {
        messagingTemplate.convertAndSendToUser(sessionId, "/queue/personal", message);
        log.debug("Kullaniciya mesaj gonderildi: {}", sessionId);
    }

    // Admin paneline ozel mesaj gonderir (LEADERBOARD_PENDING, LEADERBOARD_UPDATED).
    public void sendToAdmin(String adminId, Object message) {
        messagingTemplate.convertAndSendToUser(adminId, "/queue/admin", message);
        log.debug("Admin'e mesaj gonderildi: {}", adminId);
    }

    // QUESTION_END'den delayMs sonra otomatik olarak verilen görevi calistirir.
    // SCORE_REVEAL'i 2sn gecikmeyle yayinlamak icin kullanilir.
    public void scheduleScoreReveal(String gameId, long delayMs, Runnable task) {
        Instant triggerTime = Instant.now().plusMillis(delayMs);
        taskScheduler.schedule(task, triggerTime);
        log.debug("Score reveal zamanlandı: {}ms sonra, gameId: {}", delayMs, gameId);
    }

    // Admin onaylamazsa timeoutMs sonra SCORE_REVEAL'i otomatik yayinlar.
    // Her oyun+soru icin ayri bir zamanlayici tutulur.
    public void scheduleAutoPublish(String gameId, String questionId, long timeoutMs, Runnable task) {
        String key = gameId + ":" + questionId;
        Instant triggerTime = Instant.now().plusMillis(timeoutMs);
        ScheduledFuture<?> future = taskScheduler.schedule(task, triggerTime);
        pendingPublishTasks.put(key, future);
        log.debug("Auto-publish zamanlandı: {}ms sonra, key: {}", timeoutMs, key);
    }

    // Admin "Yayinla" bastiginda bekleyen zamanlayiciyi iptal eder.
    public void cancelAutoPublish(String gameId, String questionId) {
        String key = gameId + ":" + questionId;
        ScheduledFuture<?> future = pendingPublishTasks.remove(key);
        if (future != null) {
            future.cancel(false);
            log.debug("Auto-publish iptal edildi: {}", key);
        }
    }

    // Sonraki soru geri sayimini herkese gonderir.
    // Her saniye bir mesaj gonderilir: 5, 4, 3, 2, 1
    public void broadcastCountdown(String gameId, int seconds, Runnable onFinish) {
        for (int i = seconds; i >= 1; i--) {
            final int count = i;
            long delayMs = (long)(seconds - i) * 1000;
            Instant triggerTime = Instant.now().plusMillis(delayMs);
            taskScheduler.schedule(() -> {
                Map<String, Object> msg = Map.of(
                        "type", "NEXT_QUESTION_COUNTDOWN",
                        "gameId", gameId,
                        "countdownSeconds", count
                );
                broadcastToGame(gameId, msg);
                broadcastToHost(gameId, msg);
            }, triggerTime);
        }
        // Geri sayim bitince onFinish calisir (genellikle QUESTION_START)
        Instant finishTime = Instant.now().plusMillis((long) seconds * 1000);
        taskScheduler.schedule(onFinish, finishTime);
    }
}