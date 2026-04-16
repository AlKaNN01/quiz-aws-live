package com.awsokanclub.GameAdmin.controller;

import com.awsokanclub.GameAdmin.dto.request.AiQuizRequest;
import com.awsokanclub.GameAdmin.dto.response.GeneratedQuestionDto;
import com.awsokanclub.GameAdmin.service.AiQuizService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiQuizController {

    private final AiQuizService aiQuizService;

    @PostMapping("/generate")
    public ResponseEntity<List<GeneratedQuestionDto>> generate(@RequestBody AiQuizRequest request) {
        List<GeneratedQuestionDto> questions = aiQuizService.generate(
                request.getTopic(),
                request.getQuestionCount(),
                request.getTimerSeconds()
        );
        return ResponseEntity.ok(questions);
    }
}
