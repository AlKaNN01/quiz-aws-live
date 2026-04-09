/*
 * WebSocket ve STOMP protokol ayarlari.
 * Oyuncular /ws endpoint'ine baglanir.
 * Mesaj yonlendirme kurallari burada tanimlanir.
 * Ban sonrasi baglanti kesmek icin WebSocketSessionRegistry kullanilir.
 *
 * Guvenlik:
 * - CORS: sadece izin verilen origin'lerden baglanti kabul edilir (ALLOWED_ORIGINS env).
 * - IP tracking: handshake sirasinda istemci IP'si session attribute'a yazilir.
 *   GameController.getIpAddress() bunu okur; IP ban sistemi bu sayede calisir.
 */
package com.awsokanclub.GameEngine.config;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.net.InetSocketAddress;
import java.security.Principal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketSessionRegistry sessionRegistry;

    @Value("${app.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = allowedOrigins.split(",");
        registry.addEndpoint("/ws")
                .setAllowedOrigins(origins)
                .setHandshakeHandler(new DefaultHandshakeHandler() {
                    @Override
                    protected Principal determineUser(ServerHttpRequest request,
                                                      WebSocketHandler wsHandler,
                                                      Map<String, Object> attributes) {
                        // IP'yi session attribute'a yaz — GameController.getIpAddress() okur.
                        // X-Forwarded-For varsa (proxy arkasi) onu kullan, yoksa dogrudan IP.
                        String ip = extractClientIp(request);
                        attributes.put("ip", ip);

                        String id = UUID.randomUUID().toString();
                        return () -> id;
                    }
                })
                .withSockJS();
    }

    // Bağlantı açılınca registry'ye ekler, kapanınca çıkarır.
    // Bu sayede ban sonrası sunucu tarafından bağlantı kesilebilir.
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration.addDecoratorFactory(handler -> new WebSocketHandlerDecorator(handler) {
            @Override
            public void afterConnectionEstablished(WebSocketSession session) throws Exception {
                if (session.getPrincipal() != null) {
                    sessionRegistry.register(session.getPrincipal().getName(), session);
                }
                super.afterConnectionEstablished(session);
            }

            @Override
            public void afterConnectionClosed(WebSocketSession session, CloseStatus closeStatus) throws Exception {
                if (session.getPrincipal() != null) {
                    sessionRegistry.unregister(session.getPrincipal().getName());
                }
                super.afterConnectionClosed(session, closeStatus);
            }
        });
    }

    private String extractClientIp(ServerHttpRequest request) {
        List<String> xff = request.getHeaders().get("X-Forwarded-For");
        if (xff != null && !xff.isEmpty()) {
            return xff.get(0).split(",")[0].trim();
        }
        InetSocketAddress remoteAddress = request.getRemoteAddress();
        if (remoteAddress != null) {
            return remoteAddress.getAddress().getHostAddress();
        }
        return "unknown";
    }
}