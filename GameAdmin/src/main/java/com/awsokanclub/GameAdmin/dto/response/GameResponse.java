/*
 * Oyun bilgilerini disariya tasir.
 */
package com.awsokanclub.GameAdmin.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;

@Data
@Builder
public class GameResponse {
    private Long id;
    private String title;
    private String joinCode;
    private String status;
    private LocalDateTime createdAt;
    private List<QuestionResponse> questions;
}