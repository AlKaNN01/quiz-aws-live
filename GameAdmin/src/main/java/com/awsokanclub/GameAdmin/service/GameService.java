/*
 * Oyun olusturma, yayina alma ve sorgulama islemlerini yonetir.
 */
package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.dto.request.CreateGameRequest;
import com.awsokanclub.GameAdmin.dto.request.GameResultRequest;
import com.awsokanclub.GameAdmin.dto.response.GameResponse;
import com.awsokanclub.GameAdmin.dto.response.QuestionResponse;
import com.awsokanclub.GameAdmin.exception.GameAdminException;
import com.awsokanclub.GameAdmin.model.Game;
import com.awsokanclub.GameAdmin.model.GameResult;
import com.awsokanclub.GameAdmin.repository.GameRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.awsokanclub.GameAdmin.repository.GameResultRepository;


import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GameService {


    private final GameRepository gameRepository;
    private final GameResultRepository gameResultRepository;

    @Transactional
    public GameResponse createGame(CreateGameRequest request) {
        log.info("Creating new game: title={}", request.getTitle());
        Game game = Game.builder()
                .title(request.getTitle())
                .status(Game.Status.DRAFT)
                .build();
        game = gameRepository.save(game);
        log.info("Oyun olusturuldu: {}", game.getId());
        return toResponse(game);
    }

    @Transactional
    public GameResponse publishGame(Long gameId) {
        log.info("Publishing game: id={}", gameId);
        Game game = getGameById(gameId);
        if (game.getStatus() != Game.Status.DRAFT) {
            throw GameAdminException.badRequest("Sadece DRAFT durumundaki quizler yayina alinabilir.");
        }
        if (game.getQuestions() == null || game.getQuestions().isEmpty()) {
            throw GameAdminException.badRequest("Quizde en az bir soru olmali.");
        }
        game.setStatus(Game.Status.PUBLISHED);
        game = gameRepository.save(game);
        log.info("Quiz yayina alindi: {}", game.getId());
        return toResponse(game);
    }

    /*
     * Quiz icin yeni bir oyun oturumu baslatir.
     * Quiz status'u degismez — her zaman PUBLISHED kalir.
     * Rastgele 6 karakterli benzersiz sessionCode uretilir ve joinCode olarak kaydedilir.
     * Ayni quiz birden fazla oturum icin arka arkaya baslatilabilir.
     */
    @Transactional
    public String startSession(Long gameId) {
        Game game = getGameById(gameId);
        if (game.getStatus() != Game.Status.PUBLISHED && game.getStatus() != Game.Status.ACTIVE) {
            throw GameAdminException.badRequest("Sadece yayinlanmis quizler baslatilabilir.");
        }
        if (game.getQuestions() == null || game.getQuestions().isEmpty()) {
            throw GameAdminException.badRequest("Quizde soru yok.");
        }
        String sessionCode = generateUniqueCode();
        game.setJoinCode(sessionCode);
        // Quiz status degismez — kalici quiz tanimi PUBLISHED olarak kalir
        gameRepository.save(game);
        log.info("Oturum baslatildi: quizId={} sessionCode={}", gameId, sessionCode);
        return sessionCode;
    }

    /*
     * GameEngine oyun bitisinde cagirilir. joinCode temizlenir.
     * Quiz status'u PUBLISHED'a alinir (DB'de eski ACTIVE kayitlari da duzeltilir).
     */
    @Transactional
    public void endSession(String sessionCode) {
        gameRepository.findByJoinCode(sessionCode).ifPresent(game -> {
            game.setJoinCode(null);
            game.setStatus(Game.Status.PUBLISHED);
            gameRepository.save(game);
            log.info("Oturum sonlandirildi: quizId={} sessionCode={}", game.getId(), sessionCode);
        });
    }

    private String generateUniqueCode() {
        String code;
        do {
            code = UUID.randomUUID().toString().substring(0, 6).toUpperCase();
        } while (gameRepository.findByJoinCode(code).isPresent());
        return code;
    }

    public GameResponse getGame(Long gameId) {
        return toResponse(getGameById(gameId));
    }

    public List<GameResponse> getAllGames() {
        return gameRepository.findAll().stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // GameEngine'in soru listesi cekmesi icin kullanilir.
    // joinCode ile eslesen aktif oturumlara ait sorulari dondurur — eski/stale kodlar reddedilir.
    // Not: startSession quiz statusunu degistirmiyor (PUBLISHED kalir), sadece joinCode set ediyor.
    public List<QuestionResponse> getQuestionsForEngine(String sessionCode) {
        Game game = gameRepository.findByJoinCode(sessionCode)
                .orElseThrow(() -> GameAdminException.notFound("Gecerli oturum bulunamadi."));
        if (game.getStatus() != Game.Status.PUBLISHED && game.getStatus() != Game.Status.ACTIVE) {
            throw GameAdminException.notFound("Oturum aktif degil.");
        }
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
    @Transactional
    public GameResponse updateGameTitle(Long gameId, String title) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> GameAdminException.notFound("Oyun bulunamadi."));
        game.setTitle(title);
        return toResponse(gameRepository.save(game));
    }

    @Transactional
    public void deleteGame(Long gameId) {
        log.info("Deleting game: id={}", gameId);
        if (!gameRepository.existsById(gameId)) {
            throw GameAdminException.notFound("Oyun bulunamadi.");
        }
        gameRepository.deleteById(gameId);
        log.info("Oyun silindi: {}", gameId);
    }
    public GameResponse getActiveGame() {
        // Once ACTIVE oturum ara, yoksa PUBLISHED quiz dondur
        return gameRepository.findFirstByStatusOrderByCreatedAtDesc(Game.Status.ACTIVE)
                .or(() -> gameRepository.findFirstByStatusOrderByCreatedAtDesc(Game.Status.PUBLISHED))
                .map(this::toResponse)
                .orElseThrow(() -> GameAdminException.notFound("Oynanabilir quiz bulunamadi."));
    }
    /*
     * GameEngine oyun bitişinde bu metodu çağırır.
     * Tüm oyuncu sonuçlarını PostgreSQL'e kaydeder.
     */

    @Transactional
    public void saveResults(String gameId, List<GameResultRequest> results) {
        log.info("Saving results for game: gameId={}, resultCount={}", gameId, results.size());
        List<GameResult> entities = results.stream().map(r -> GameResult.builder()
                .gameId(gameId)
                .userId(r.getUserId())
                .nickname(r.getNickname())
                .totalScore(r.getTotalScore())
                .rank(r.getRank())
                .build()
        ).toList();
        gameResultRepository.saveAll(entities);
        log.info("Game results saved successfully: gameId={}", gameId);
    }

    /*
     * Admin panelinde geçmiş oyun sonuçlarını gösterir.
     */
    public List<GameResult> getResults(String gameId) {
        return gameResultRepository.findByGameIdOrderByRankAsc(gameId);
    }
}