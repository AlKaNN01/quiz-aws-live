package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.dto.response.GeneratedQuestionDto;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

@Slf4j
@Service
public class AiQuizService {

    private static final String GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    private static final String MODEL    = "llama-3.3-70b-versatile";

    @Value("${groq.api-key:}")
    private String apiKey;

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<GeneratedQuestionDto> generate(String topic, int questionCount, int timerSeconds) {
        String prompt      = buildPrompt(topic, questionCount);
        String requestBody = buildRequestBody(prompt);

        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(GROQ_URL))
                    .header("Content-Type", "application/json")
                    .header("Authorization", "Bearer " + apiKey)
                    .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                    .timeout(Duration.ofSeconds(30))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() != 200) {
                log.error("Groq API hatasi: status={} body={}", response.statusCode(), response.body());
                throw new RuntimeException("Groq API hatasi: " + response.statusCode());
            }

            return parseResponse(response.body());
        } catch (RuntimeException e) {
            throw e;
        } catch (Exception e) {
            log.error("Groq API cagrisinda hata", e);
            throw new RuntimeException("AI servisi ile iletisim kurulamadi: " + e.getMessage());
        }
    }

    private String buildPrompt(String topic, int questionCount) {
        return String.format(
                "Türkçe olarak '%s' konusunda %d adet çoktan seçmeli soru üret. " +
                "Her soru 4 seçenek içersin (A, B, C, D). " +
                "Sadece geçerli bir JSON array döndür, başka hiçbir açıklama veya markdown yazma. " +
                "Format: [{\"text\":\"Soru metni?\",\"optionA\":\"...\",\"optionB\":\"...\",\"optionC\":\"...\",\"optionD\":\"...\",\"correctAnswer\":\"A\"}]",
                topic, questionCount
        );
    }

    private String buildRequestBody(String prompt) {
        try {
            return objectMapper.writeValueAsString(
                    objectMapper.createObjectNode()
                            .put("model", MODEL)
                            .put("temperature", 0.7)
                            .set("messages", objectMapper.createArrayNode()
                                    .add(objectMapper.createObjectNode()
                                            .put("role", "user")
                                            .put("content", prompt)))
            );
        } catch (Exception e) {
            throw new RuntimeException("Request body olusturulamadi", e);
        }
    }

    private List<GeneratedQuestionDto> parseResponse(String responseBody) {
        try {
            JsonNode root = objectMapper.readTree(responseBody);
            String text = root
                    .path("choices").get(0)
                    .path("message")
                    .path("content")
                    .asText();

            // Markdown kod bloklarını temizle (```json ... ```)
            text = text.replaceAll("(?s)```json\\s*", "").replaceAll("(?s)```\\s*", "").trim();

            return objectMapper.readValue(text, new TypeReference<List<GeneratedQuestionDto>>() {});
        } catch (Exception e) {
            log.error("Groq yaniti parse edilemedi", e);
            throw new RuntimeException("AI yaniti islenemedı. Lütfen tekrar deneyin.");
        }
    }
}
