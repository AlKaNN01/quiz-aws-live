package com.awsokanclub.GameEngine.controller;

import com.awsokanclub.GameEngine.service.GameSessionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/player")
@RequiredArgsConstructor
public class PlayerController {

    private final GameSessionService gameSessionService;

    /**
     * Lobby'deki nickname mevcudiyetini kontrol eder.
     * Frontend bağlantı kurmadan önce bu endpoint'i çağırır;
     * nickname alınmışsa LandingPage'de hata gösterilir, PlayerPage'e geçilmez.
     */
    @GetMapping("/check-nickname")
    public ResponseEntity<Map<String, Boolean>> checkNickname(
            @RequestParam String gameId,
            @RequestParam String nickname) {
        boolean taken = gameSessionService.isNicknameTaken(gameId, nickname);
        return ResponseEntity.ok(Map.of("taken", taken));
    }
}
