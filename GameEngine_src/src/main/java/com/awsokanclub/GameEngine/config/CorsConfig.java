/*
 * REST API CORS headers interceptor.
 * Tüm HTTP response'larına uygun CORS header'ları ekler.
 * WebSocket için ayrı CORS config vardır (WebSocketConfig.java).
 */
package com.awsokanclub.GameEngine.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Value("${app.allowed-origins}")
    private String allowedOrigins;

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        String[] origins = allowedOrigins.split(",");
        
        registry.addMapping("/actuator/**")
                .allowedOrigins(origins)
                .allowedMethods("GET", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(true)
                .maxAge(3600);

        // STOMP WebSocket message'lar için ayrıca WebSocketConfig'te izin veriliyor
    }
}
