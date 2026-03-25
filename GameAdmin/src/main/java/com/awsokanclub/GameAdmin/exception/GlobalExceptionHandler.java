/*
 * Tum exception'lari yakalar ve JSON olarak dondurur.
 */
package com.awsokanclub.GameAdmin.exception;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(GameAdminException.class)
    public ResponseEntity<Map<String, String>> handleGameAdminException(GameAdminException ex) {
        return ResponseEntity.status(ex.getStatus())
                .body(Map.of("error", ex.getMessage()));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleGenericException(Exception ex) {
        return ResponseEntity.internalServerError()
                .body(Map.of("error", "Sunucu hatasi: " + ex.getMessage()));
    }
}