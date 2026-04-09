/*
 * Herhangi bir hata durumunda oyuncuya gonderilir.
 * retryable: true ise oyuncu tekrar deneyebilir (ornegin yanlis joinCode).
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ErrorMessage {
    @Builder.Default
    private String type = "ERROR";
    private String errorCode;
    private String message;
    private boolean retryable;
}