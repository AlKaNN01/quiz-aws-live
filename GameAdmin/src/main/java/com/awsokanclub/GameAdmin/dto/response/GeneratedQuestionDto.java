package com.awsokanclub.GameAdmin.dto.response;

import lombok.Data;

@Data
public class GeneratedQuestionDto {
    private String text;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    private String correctAnswer;
}
