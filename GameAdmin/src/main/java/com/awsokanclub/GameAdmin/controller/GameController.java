/*
 * Oyun yonetim endpoint'leri.
 * Olustur, yayina al, sorgula.
 */
package com.awsokanclub.GameAdmin.controller;

import com.awsokanclub.GameAdmin.dto.request.CreateGameRequest;
import com.awsokanclub.GameAdmin.dto.response.GameResponse;
import com.awsokanclub.GameAdmin.dto.response.QuestionResponse;
import com.awsokanclub.GameAdmin.service.GameService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.awsokanclub.GameAdmin.model.GameResult;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/games")
@RequiredArgsConstructor
public class GameController {

    private final GameService gameService;

    @PostMapping
    public ResponseEntity<GameResponse> createGame(@RequestBody CreateGameRequest request) {
        return ResponseEntity.ok(gameService.createGame(request));
    }

    @PostMapping("/{gameId}/publish")
    public ResponseEntity<GameResponse> publishGame(@PathVariable Long gameId) {
        return ResponseEntity.ok(gameService.publishGame(gameId));
    }

    @GetMapping("/{gameId}")
    public ResponseEntity<GameResponse> getGame(@PathVariable Long gameId) {
        return ResponseEntity.ok(gameService.getGame(gameId));
    }

    @GetMapping
    public ResponseEntity<List<GameResponse>> getAllGames() {
        return ResponseEntity.ok(gameService.getAllGames());
    }

    // GameEngine bu endpoint'i kullanir — joinCode ile soru listesini ceker
    @GetMapping("/engine/questions")
    public ResponseEntity<List<QuestionResponse>> getQuestionsForEngine(@RequestParam String joinCode) {
        return ResponseEntity.ok(gameService.getQuestionsForEngine(joinCode));
    }
    // Host girişi yapınca aktif oyunu otomatik bulur
    @GetMapping("/active")
    public ResponseEntity<GameResponse> getActiveGame() {
        return ResponseEntity.ok(gameService.getActiveGame());
    }
    @DeleteMapping("/{gameId}")
    public ResponseEntity<Void> deleteGame(@PathVariable Long gameId) {
        gameService.deleteGame(gameId);
        return ResponseEntity.noContent().build();
    }

    // GameEngine oyun bitince buraya POST atar — sonuçları kaydeder
    @PostMapping("/{gameId}/results")
    public ResponseEntity<Void> saveResults(@PathVariable String gameId,
                                            @RequestBody List<Map<String, Object>> results) {
        gameService.saveResults(gameId, results);
        return ResponseEntity.ok().build();
    }

    // Admin panelinde geçmiş oyun sonuçlarını görür
    @GetMapping("/{gameId}/results")
    public ResponseEntity<List<GameResult>> getResults(@PathVariable String gameId) {
        return ResponseEntity.ok(gameService.getResults(gameId));
    }

}