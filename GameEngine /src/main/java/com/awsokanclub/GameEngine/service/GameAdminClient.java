/*
 * GameAdmin REST API ile iletisim kurar.
 * admin.start alindiginda soru listesini buradan ceker.
 */
package com.awsokanclub.GameEngine.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
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

    // joinCode ile soru listesini GameAdmin'den ceker
    public List<Map<String, Object>> fetchQuestions(String joinCode) {
        String url = gameAdminUrl + "/api/games/engine/questions?joinCode=" + joinCode;

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
            log.info("GameAdmin'den {} soru cekidi: joinCode={}",
                    response.getBody() != null ? response.getBody().size() : 0, joinCode);
            return response.getBody();
        } catch (Exception e) {
            log.error("GameAdmin'den soru cekilemedi: {}", e.getMessage());
            throw new RuntimeException("Soru listesi alinamadi.");
        }
    }
    // joinCode'un GameAdmin'deki aktif oyuna ait olup olmadığını doğrular
    public boolean validateJoinCode(String gameId, String joinCode) {
        if (joinCode == null || joinCode.isBlank()) return false;
        try {
            List<Map<String, Object>> questions = fetchQuestions(joinCode);
            return questions != null && !questions.isEmpty();
        } catch (Exception e) {
            log.warn("joinCode dogrulanamadi: {}", joinCode);
            return false;
        }
    }

    // Oyun bitince tüm sonuçları GameAdmin'e gönderir — PostgreSQL'e kaydedilir
    public void saveResults(String gameId, List<Map<String, Object>> results) {
        String url = gameAdminUrl + "/api/games/" + gameId + "/results";

        HttpHeaders headers = new HttpHeaders();
        headers.set("Authorization", "Bearer " + engineToken);
        headers.setContentType(MediaType.APPLICATION_JSON);

        HttpEntity<List<Map<String, Object>>> entity = new HttpEntity<>(results, headers);

        try {
            restTemplate.exchange(url, HttpMethod.POST, entity, Void.class);
            log.info("Sonuçlar kaydedildi: gameId={} oyuncu={}", gameId, results.size());
        } catch (Exception e) {
            log.error("Sonuçlar kaydedilemedi: {}", e.getMessage());
        }
    }
}