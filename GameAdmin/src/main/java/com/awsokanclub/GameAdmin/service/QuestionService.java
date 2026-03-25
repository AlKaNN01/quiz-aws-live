/*
 * Oyuna soru ekleme, duzenleme ve silme islemlerini yonetir.
 */
package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.dto.request.CreateQuestionRequest;
import com.awsokanclub.GameAdmin.dto.response.QuestionResponse;
import com.awsokanclub.GameAdmin.exception.GameAdminException;
import com.awsokanclub.GameAdmin.model.Game;
import com.awsokanclub.GameAdmin.model.Question;
import com.awsokanclub.GameAdmin.repository.GameRepository;
import com.awsokanclub.GameAdmin.repository.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final GameRepository gameRepository;

    public QuestionResponse addQuestion(Long gameId, CreateQuestionRequest request) {
        Game game = gameRepository.findById(gameId)
                .orElseThrow(() -> GameAdminException.notFound("Oyun bulunamadi."));
        if (game.getStatus() != Game.Status.DRAFT) {
            throw GameAdminException.badRequest("Yayindaki oyuna soru eklenemez.");
        }

        Question question = Question.builder()
                .game(game)
                .text(request.getText())
                .optionA(request.getOptionA())
                .optionB(request.getOptionB())
                .optionC(request.getOptionC())
                .optionD(request.getOptionD())
                .correctAnswer(request.getCorrectAnswer())
                .timerSeconds(request.getTimerSeconds())
                .orderIndex(request.getOrderIndex())
                .build();

        question = questionRepository.save(question);
        log.info("Soru eklendi: gameId={} questionId={}", gameId, question.getId());
        return toResponse(question);
    }

    public QuestionResponse updateQuestion(Long questionId, CreateQuestionRequest request) {
        Question question = questionRepository.findById(questionId)
                .orElseThrow(() -> GameAdminException.notFound("Soru bulunamadi."));

        question.setText(request.getText());
        question.setOptionA(request.getOptionA());
        question.setOptionB(request.getOptionB());
        question.setOptionC(request.getOptionC());
        question.setOptionD(request.getOptionD());
        question.setCorrectAnswer(request.getCorrectAnswer());
        question.setTimerSeconds(request.getTimerSeconds());
        question.setOrderIndex(request.getOrderIndex());

        question = questionRepository.save(question);
        return toResponse(question);
    }

    public void deleteQuestion(Long questionId) {
        if (!questionRepository.existsById(questionId)) {
            throw GameAdminException.notFound("Soru bulunamadi.");
        }
        questionRepository.deleteById(questionId);
        log.info("Soru silindi: {}", questionId);
    }

    public List<QuestionResponse> getQuestions(Long gameId) {
        return questionRepository.findByGameIdOrderByOrderIndex(gameId)
                .stream().map(this::toResponse).collect(Collectors.toList());
    }

    private QuestionResponse toResponse(Question q) {
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
}