/*
 * WebSocket ve STOMP protokol ayarlari.
 * Oyuncular /ws endpoint'ine baglanir.
 * Mesaj yonlendirme kurallari burada tanimlanir.
 * Ban sonrasi baglanti kesmek icin WebSocketSessionRegistry kullanilir.
 */
package com.awsokanclub.GameEngine.config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.config.annotation.*;
import org.springframework.web.socket.handler.WebSocketHandlerDecorator;
import org.springframework.web.socket.handler.WebSocketHandlerDecoratorFactory;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;
import java.util.UUID;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketSessionRegistry sessionRegistry;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .setHandshakeHandler(new DefaultHandshakeHandler() {
                    @Override
                    protected Principal determineUser(ServerHttpRequest request,
                                                      WebSocketHandler wsHandler,
                                                      Map<String, Object> attributes) {
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
}