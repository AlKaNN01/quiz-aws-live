package com.awsokanclub.GameAdmin.dto.request;

import lombok.Data;

@Data
public class AiQuizRequest {
    private String topic;
    private int questionCount;
    private int timerSeconds;
}
