/*
 * GameEngine'den gelen oyun sonucu kaydı.
 * Doğrulama ve tip güvenliği sağlar.
 */
package com.awsokanclub.GameAdmin.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameResultRequest {

    @NotBlank(message = "gameId boş olamaz")
    private String gameId;

    @NotBlank(message = "userId boş olamaz")
    private String userId;

    @NotBlank(message = "nickname boş olamaz")
    private String nickname;

    @NotNull(message = "totalScore null olamaz")
    @PositiveOrZero(message = "totalScore negatif olamaz")
    private Integer totalScore;

    @NotNull(message = "rank null olamaz")
    @PositiveOrZero(message = "rank negatif olamaz")
    private Integer rank;
}
