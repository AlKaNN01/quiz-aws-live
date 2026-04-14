/*
 * Resilience4j Configuration - Retry ve Circuit Breaker ayarları
 * Servis çağrıları esnasında hataları yeniden deneme ve kademeli arızaları yönetme
 */
package com.awsokanclub.GameAdmin.config;

import io.github.resilience4j.circuitbreaker.CircuitBreaker;
import io.github.resilience4j.circuitbreaker.CircuitBreakerConfig;
import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import io.github.resilience4j.core.registry.EntryAddedEvent;
import io.github.resilience4j.core.registry.EntryRemovedEvent;
import io.github.resilience4j.core.registry.EntryReplacedEvent;
import io.github.resilience4j.core.registry.RegistryEventConsumer;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import io.github.resilience4j.retry.RetryRegistry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Slf4j
@Configuration
public class ResilienceConfig {

    /**
     * Retry Configuration for transient failures
     * Kullanım: @Retry(name = "default") annotasyonu ile method'u ekle
     */
    @Bean
    public RetryRegistry retryRegistry() {
        RetryConfig config = RetryConfig.custom()
                .maxAttempts(3)
                .waitDuration(Duration.ofMillis(500))
                .retryOnException(exception -> isRetryable(exception))
                .failAfterMaxAttempts(true)
                .build();

        RetryRegistry registry = RetryRegistry.of(config);
        registry.getEventPublisher()
                .onEntryAdded(event -> log.info("Retry config registered: {}", event.getAddedEntry().getName()))
                .onEntryRemoved(event -> log.info("Retry config removed: {}", event.getRemovedEntry().getName()));

        return registry;
    }

    /**
     * Circuit Breaker Configuration for cascading failures
     * Kullanım: @CircuitBreaker(name = "default") annotasyonu ile method'u ekle
     */
    @Bean
    public CircuitBreakerRegistry circuitBreakerRegistry() {
        CircuitBreakerConfig config = CircuitBreakerConfig.custom()
                .failureRateThreshold(50)                    // 50% başarısızlık oranı
                .slowCallRateThreshold(50)                   // 50% yavaş çağrı oranı
                .slowCallDurationThreshold(Duration.ofSeconds(2))  // 2 saniyeden fazla = yavaş
                .waitDurationInOpenState(Duration.ofSeconds(30))   // Open → Half-open 30 sn sonra
                .permittedNumberOfCallsInHalfOpenState(3)    // Half-open'da 3 çağrı dene
                .automaticTransitionFromOpenToHalfOpenEnabled(true)
                .recordException(exception -> isRetryable(exception))
                .build();

        CircuitBreakerRegistry registry = CircuitBreakerRegistry.of(config, registerCircuitBreakerEventConsumer());
        registry.getEventPublisher()
                .onEntryAdded(event -> log.info("CircuitBreaker config registered: {}", event.getAddedEntry().getName()))
                .onEntryRemoved(event -> log.info("CircuitBreaker config removed: {}", event.getRemovedEntry().getName()));

        return registry;
    }

    /**
     * Hangi exception'ların retry/circuit breaker'a tabi tutulacağı
     */
    private static boolean isRetryable(Throwable exception) {
        // Socket, timeout, connection reset'ler retry yükselir
        String message = exception.getClass().getName();
        return message.contains("IOException") ||
               message.contains("TimeoutException") ||
               message.contains("ConnectionException") ||
               message.contains("NetworkException");
    }

    /**
     * Circuit Breaker event monitoring
     */
    private RegistryEventConsumer<CircuitBreaker> registerCircuitBreakerEventConsumer() {
        return new RegistryEventConsumer<CircuitBreaker>() {
            @Override
            public void onEntryAddedEvent(EntryAddedEvent<CircuitBreaker> event) {
                CircuitBreaker cb = event.getAddedEntry();
                cb.getEventPublisher()
                        .onStateTransition(e -> log.warn("CircuitBreaker [{}] transition: {} -> {}",
                                cb.getName(), e.getStateTransition().getFromState(), e.getStateTransition().getToState()))
                        .onError(e -> log.debug("CircuitBreaker [{}] recorded error: {}", cb.getName(), e.getThrowable().getMessage()))
                        .onSuccess(e -> log.debug("CircuitBreaker [{}] recorded success", cb.getName()));
            }

            @Override
            public void onEntryRemovedEvent(EntryRemovedEvent<CircuitBreaker> event) {}

            @Override
            public void onEntryReplacedEvent(EntryReplacedEvent<CircuitBreaker> event) {}
        };
    }
}
