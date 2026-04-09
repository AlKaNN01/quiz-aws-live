/*
 * Aktif WebSocket session'larını tutar.
 * Ban sonrası bağlantıyı sunucu tarafından kapatmak için kullanılır.
 * WebSocketConfig'e HandlerDecoratorFactory olarak eklenir.
 */
package com.awsokanclub.GameEngine.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;

@Slf4j
@Component
public class WebSocketSessionRegistry {

    // principalName → WebSocketSession
    private final ConcurrentHashMap<String, WebSocketSession> sessions = new ConcurrentHashMap<>();

    public void register(String principalName, WebSocketSession session) {
        sessions.put(principalName, session);
    }

    public void unregister(String principalName) {
        sessions.remove(principalName);
    }

    // Ban sonrası çağrılır — bağlantıyı sunucu tarafından kapatır
    public void closeSession(String principalName) {
        WebSocketSession session = sessions.get(principalName);
        if (session != null && session.isOpen()) {
            try {
                session.close();
                log.info("WebSocket bağlantısı kapatıldı: {}", principalName);
            } catch (IOException e) {
                log.warn("Bağlantı kapatılamadı: {}", principalName);
            }
        }
    }
}