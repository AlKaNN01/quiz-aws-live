/*
 * Soru yonetim endpoint'leri.
 * Ekle, duzenle, sil.
 */
package com.awsokanclub.GameAdmin.controller;

import com.awsokanclub.GameAdmin.dto.request.CreateQuestionRequest;
import com.awsokanclub.GameAdmin.dto.response.QuestionResponse;
import com.awsokanclub.GameAdmin.service.QuestionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/games/{gameId}/questions")
@RequiredArgsConstructor
public class QuestionController {

    private final QuestionService questionService;

    @PostMapping
    public ResponseEntity<QuestionResponse> addQuestion(@PathVariable Long gameId,
                                                        @RequestBody CreateQuestionRequest request) {
        return ResponseEntity.ok(questionService.addQuestion(gameId, request));
    }

    @PutMapping("/{questionId}")
    public ResponseEntity<QuestionResponse> updateQuestion(@PathVariable Long gameId,
                                                           @PathVariable Long questionId,
                                                           @RequestBody CreateQuestionRequest request) {
        return ResponseEntity.ok(questionService.updateQuestion(questionId, request));
    }

    @DeleteMapping("/{questionId}")
    public ResponseEntity<Void> deleteQuestion(@PathVariable Long gameId,
                                               @PathVariable Long questionId) {
        questionService.deleteQuestion(questionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<List<QuestionResponse>> getQuestions(@PathVariable Long gameId) {
        return ResponseEntity.ok(questionService.getQuestions(gameId));
    }
}