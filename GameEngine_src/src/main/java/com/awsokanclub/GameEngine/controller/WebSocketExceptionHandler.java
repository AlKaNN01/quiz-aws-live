/*
 * WebSocket mesaj isleyicilerinde firlatilan exception'lari yakalar.
 *
 * @ControllerAdvice + @MessageExceptionHandler kullanimi:
 * - Controller'da yakalanmayan bir exception buraya duser.
 * - Oyuncuya ErrorMessage olarak gonderilir, baglanti kopmaz.
 * - Yoksa exception TaskScheduler'da yutulur ve client bilgisiz kalir.
 */
package com.awsokanclub.GameEngine.controller;

import com.awsokanclub.GameEngine.dto.outbound.ErrorMessage;
import com.awsokanclub.GameEngine.exception.GameException;
import com.awsokanclub.GameEngine.service.GameEventPublisher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.web.bind.annotation.ControllerAdvice;

@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class WebSocketExceptionHandler {

    private final GameEventPublisher gameEventPublisher;

    @MessageExceptionHandler(GameException.class)
    public void handleGameException(GameException e, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = resolveSessionId(headerAccessor);
        log.warn("GameException yakalandi: code={} msg={} sessionId={}", e.getErrorCode(), e.getMessage(), sessionId);
        gameEventPublisher.sendToUser(sessionId, ErrorMessage.builder()
                .errorCode(e.getErrorCode())
                .message(e.getMessage())
                .retryable(e.isRetryable())
                .build());
    }

    @MessageExceptionHandler(Exception.class)
    public void handleGenericException(Exception e, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = resolveSessionId(headerAccessor);
        log.error("Beklenmeyen WebSocket hatasi: sessionId={}", sessionId, e);
        gameEventPublisher.sendToUser(sessionId, ErrorMessage.builder()
                .errorCode("INTERNAL_ERROR")
                .message("Sunucuda bir hata olustu. Lutfen tekrar deneyin.")
                .retryable(true)
                .build());
    }

    private String resolveSessionId(SimpMessageHeaderAccessor headerAccessor) {
        if (headerAccessor == null) return "unknown";
        if (headerAccessor.getUser() != null && headerAccessor.getUser().getName() != null) {
            return headerAccessor.getUser().getName();
        }
        return headerAccessor.getSessionId() != null ? headerAccessor.getSessionId() : "unknown";
    }
}
