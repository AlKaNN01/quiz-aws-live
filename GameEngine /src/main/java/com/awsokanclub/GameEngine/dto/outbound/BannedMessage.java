/*
 * Banlanan oyuncuya gonderilen son mesaj.
 * Frontend baglantıyı kapatir, ekrani karatir.
 * /user/queue/personal kanalından sadece o oyuncuya gider.
 */
package com.awsokanclub.GameEngine.dto.outbound;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class BannedMessage {
    @Builder.Default
    private String type = "BANNED";
    private String message;
    private boolean permanent;
}