/*
 * Oyuna soru ekleme istegi.
 */
package com.awsokanclub.GameAdmin.dto.request;

import lombok.Data;

@Data
public class CreateQuestionRequest {
    private String text;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    private String correctAnswer;
    private int timerSeconds;
    private int orderIndex;
}