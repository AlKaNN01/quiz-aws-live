/*
 * Oyun olusturma, yayina alma ve sorgulama islemlerini yonetir.
 */
package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.dto.request.CreateGameRequest;
import com.awsokanclub.GameAdmin.dto.response.GameResponse;
import com.awsokanclub.GameAdmin.dto.response.QuestionResponse;
import com.awsokanclub.GameAdmin.exception.GameAdminException;
import com.awsokanclub.GameAdmin.model.Game;
import com.awsokanclub.GameAdmin.model.GameResult;
import com.awsokanclub.GameAdmin.repository.GameRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import com.awsokanclub.GameAdmin.repository.GameResultRepository;


import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {


    private final GameRepository gameRepository;
    private final GameResultRepository gameResultRepository;

    public GameResponse createGame(CreateGameRequest request) {
        Game game = Game.builder()
                .title(request.getTitle())
                .status(Game.Status.DRAFT)
                .build();
        game = gameRepository.save(game);
        log.info("Oyun olusturuldu: {}", game.getId());
        return toResponse(game);
    }

    public GameResponse publishGame(Long gameId) {
        Game game = getGameById(gameId);
        if (game.getStatus() != Game.Status.DRAFT) {
            throw GameAdminException.badRequest("Sadece DRAFT durumundaki oyunlar yayina alinabilir.");
        }
        if (game.getQuestions() == null || game.getQuestions().isEmpty()) {
            throw GameAdminException.badRequest("Oyunda en az bir soru olmali.");
        }

        // Benzersiz join kodu uret
        String joinCode = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        game.setJoinCode(joinCode);
        game.setStatus(Game.Status.PUBLISHED);
        game = gameRepository.save(game);
        log.info("Oyun yayina alindi: {} joinCode: {}", game.getId(), joinCode);
        return toResponse(game);
    }

    public GameResponse getGame(Long gameId) {
        return toResponse(getGameById(gameId));
    }

    public List<GameResponse> getAllGames() {
        return gameRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // GameEngine'in soru listesi cekmesi icin kullanilir
    public List<QuestionResponse> getQuestionsForEngine(String joinCode) {
        Game game = gameRepository.findByJoinCode(joinCode)
                .orElseThrow(() -> GameAdminException.notFound("Join kodu ile oyun bulunamadi."));
        if (game.getQuestions() == null) return List.of();
        return game.getQuestions().stream()
                .map(this::toQuestionResponse)
                .collect(Collectors.toList());
    }

    private Game getGameById(Long gameId) {
        return gameRepository.findById(gameId)
                .orElseThrow(() -> GameAdminException.notFound("Oyun bulunamadi: " + gameId));
    }

    private GameResponse toResponse(Game game) {
        List<QuestionResponse> questions = game.getQuestions() == null ? List.of() :
                game.getQuestions().stream().map(this::toQuestionResponse).collect(Collectors.toList());
        return GameResponse.builder()
                .id(game.getId())
                .title(game.getTitle())
                .joinCode(game.getJoinCode())
                .status(game.getStatus().name())
                .createdAt(game.getCreatedAt())
                .questions(questions)
                .build();
    }

    private QuestionResponse toQuestionResponse(com.awsokanclub.GameAdmin.model.Question q) {
        return QuestionResponse.builder()
                .id(q.getId())
                .text(q.getText())
                .optionA(q.getOptionA())
                .optionB(q.getOptionB())
                .optionC(q.getOptionC())
                .optionD(q.getOptionD())
                .correctAnswer(q.getCorrectAnswer())
                .timerSeconds(q.getTimerSeconds())
                .orderIndex(q.getOrderIndex())
                .build();
    }
    public void deleteGame(Long gameId) {
        if (!gameRepository.existsById(gameId)) {
            throw GameAdminException.notFound("Oyun bulunamadi.");
        }
        gameRepository.deleteById(gameId);
        log.info("Oyun silindi: {}", gameId);
    }
    public GameResponse getActiveGame() {
        return gameRepository.findFirstByStatusOrderByCreatedAtDesc(Game.Status.PUBLISHED)
                .map(this::toResponse)
                .orElseThrow(() -> GameAdminException.notFound("Aktif oyun bulunamadi."));
    }
    /*
     * GameEngine oyun bitişinde bu metodu çağırır.
     * Tüm oyuncu sonuçlarını PostgreSQL'e kaydeder.
     */

    public void saveResults(String gameId, List<Map<String, Object>> results) {
        List<GameResult> entities = results.stream().map(r -> GameResult.builder()
                .gameId(gameId)
                .userId(r.get("userId").toString())
                .nickname(r.get("nickname").toString())
                .totalScore(((Number) r.get("totalScore")).intValue())
                .rank(((Number) r.get("rank")).intValue())
                .build()
        ).toList();
        gameResultRepository.saveAll(entities);
    }

    /*
     * Admin panelinde geçmiş oyun sonuçlarını gösterir.
     */
    public List<GameResult> getResults(String gameId) {
        return gameResultRepository.findByGameIdOrderByRankAsc(gameId);
    }
}