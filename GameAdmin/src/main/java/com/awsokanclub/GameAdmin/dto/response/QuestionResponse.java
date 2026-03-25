/*
 * Soru bilgilerini disariya tasir.
 * correctAnswer dahil — sadece GameEngine ve admin gorebilir.
 */
package com.awsokanclub.GameAdmin.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class QuestionResponse {
    private Long id;
    private String text;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    private String correctAnswer;
    private int timerSeconds;
    private int orderIndex;
}