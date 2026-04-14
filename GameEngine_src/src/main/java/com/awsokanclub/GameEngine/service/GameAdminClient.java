/*
 * GameAdmin REST API ile iletisim kurar.
 * Timeout, retry ve hata yonetimi ile resilience'i saglar.
 */
package com.awsokanclub.GameEngine.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.HttpServerErrorException;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestTemplate;

import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameAdminClient {

    private final RestTemplate restTemplate;

    @Value("${app.game-admin.url}")
    private String gameAdminUrl;

    @Value("${app.game-admin.engine-token}")
    private String engineToken;

    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 1000;

    // joinCode ile soru listesini GameAdmin'den ceker
    public List<Map<String, Object>> fetchQuestions(String joinCode) {
        String url = gameAdminUrl + "/api/games/engine/questions?joinCode=" + joinCode;
        
        return retryWithBackoff(() -> {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + engineToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<Void> entity = new HttpEntity<>(headers);

            try {
                ResponseEntity<List<Map<String, Object>>> response = restTemplate.exchange(
                        url,
                        HttpMethod.GET,
                        entity,
                        new ParameterizedTypeReference<>() {}
                );
                
                if (response.getBody() == null || response.getBody().isEmpty()) {
                    throw new IllegalStateException("GameAdmin'den bos soru listesi geldi: joinCode=" + joinCode);
                }
                
                log.info("GameAdmin'den {} soru cekidi: joinCode={}", response.getBody().size(), joinCode);
                return response.getBody();
                
            } catch (HttpClientErrorException.Unauthorized e) {
                log.error("ENGINE_TOKEN geçersiz: {}", e.getStatusCode());
                throw new IllegalStateException("Servis arası kimlik doğrulaması başarısız.");
            } catch (HttpClientErrorException.NotFound e) {
                log.warn("Oyun GameAdmin'de bulunamadı: joinCode={}", joinCode);
                return null;
            } catch (HttpServerErrorException e) {
                log.warn("GameAdmin 5xx hatası: {}", e.getStatusCode());
                throw e; // Retry'lanacak
            } catch (ResourceAccessException e) {
                log.warn("GameAdmin bağlantı hatası: {}", e.getMessage());
                throw e; // Retry'lanacak
            }
        });
    }

    // joinCode'un GameAdmin'deki aktif oyuna ait olup olmadığını doğrular
    public boolean validateJoinCode(String gameId, String joinCode) {
        if (joinCode == null || joinCode.isBlank()) return false;
        try {
            List<Map<String, Object>> questions = fetchQuestions(joinCode);
            return questions != null && !questions.isEmpty();
        } catch (Exception e) {
            log.warn("joinCode dogrulanamadi: {} - {}", joinCode, e.getMessage());
            return false;
        }
    }

    // Oyun oturumu bittikten sonra GameAdmin'e bildirir — joinCode temizlenir, quiz PUBLISHED olur
    public void endSession(String sessionCode) {
        String url = gameAdminUrl + "/api/games/session/" + sessionCode + "/end";
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + engineToken);
            restTemplate.exchange(url, HttpMethod.POST, new HttpEntity<>(headers), Void.class);
            log.info("Oturum sonlandirma bildirildi: sessionCode={}", sessionCode);
        } catch (Exception e) {
            log.error("Oturum sonlandirilamadi: sessionCode={} hata={}", sessionCode, e.getMessage());
            throw new RuntimeException("GameAdmin oturum sonlandirma bildirimi basarisiz: " + sessionCode, e);
        }
    }

    // Oyun bitince tüm sonuçları GameAdmin'e gönderir — PostgreSQL'e kaydedilir
    public void saveResults(String gameId, List<Map<String, Object>> results) {
        String url = gameAdminUrl + "/api/games/" + gameId + "/results";

        retryWithBackoff(() -> {
            HttpHeaders headers = new HttpHeaders();
            headers.set("Authorization", "Bearer " + engineToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<List<Map<String, Object>>> entity = new HttpEntity<>(results, headers);

            try {
                restTemplate.exchange(url, HttpMethod.POST, entity, Void.class);
                log.info("Sonuçlar kaydedildi: gameId={} oyuncu={}", gameId, results.size());
                return null;
            } catch (HttpServerErrorException e) {
                log.warn("GameAdmin sonuç kaydında 5xx hatası: {}",e.getStatusCode());
                throw e; // Retry'lanacak
            } catch (ResourceAccessException e) {
                log.warn("GameAdmin sonuç kaydında bağlantı hatası: {}", e.getMessage());
                throw e; // Retry'lanacak
            }
        });
    }

    /**
     * Exponential backoff ile retry mekanizması.
     * Servisler arası geçici hataları tolere eder.
     */
    private <T> T retryWithBackoff(java.util.function.Supplier<T> operation) {
        for (int attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                return operation.get();
            } catch (HttpServerErrorException | ResourceAccessException e) {
                if (attempt == MAX_RETRIES) {
                    log.error("Maksimum retry denemesine ulaşıldı ({}). Hata: {}", MAX_RETRIES, e.getMessage());
                    throw new RuntimeException("GameAdmin servisi kullanılamıyor. Daha sonra tekrar deneyin.", e);
                }
                
                long delayMs = RETRY_DELAY_MS * (long) Math.pow(2, attempt - 1);
                log.debug("Retry denemesi {} ({}ms bekleme): {}", attempt, delayMs, e.getMessage());
                
                try {
                    Thread.sleep(delayMs);
                } catch (InterruptedException ie) {
                    Thread.currentThread().interrupt();
                    throw new RuntimeException("Retry bekleme sırasında kesintiye uğradı.", ie);
                }
            }
        }
        throw new RuntimeException("Bilinmeyen hata.");
    }
}
