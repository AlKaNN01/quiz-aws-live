/*
 * Global Exception Handler - Tüm exception'lar burada yakalanıp log edilir
 * Test aşamasında debug için detaylı bilgi verir
 */
package com.awsokanclub.GameAdmin.exception;

import com.awsokanclub.GameAdmin.dto.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import jakarta.servlet.http.HttpServletRequest;
import java.util.stream.Collectors;

@Slf4j
@ControllerAdvice
@RequiredArgsConstructor
public class GlobalExceptionHandler {

    /**
     * 1. Application Exception (Custom business errors)
     */
    @ExceptionHandler(ApplicationException.class)
    public ResponseEntity<ApiResponse<?>> handleApplicationException(
            ApplicationException ex,
            HttpServletRequest request) {

        String requestId = getRequestId();
        String endpoint = request.getRequestURI();
        String method = request.getMethod();

        if (ex.isClientError()) {
            log.warn("CLIENT ERROR [{}] {} {} - {} | {}",
                    requestId, method, endpoint, ex.getErrorCode().getCode(), ex.getMessage());
        } else {
            log.error("SERVER ERROR [{}] {} {} - {} | {}",
                    requestId, method, endpoint, ex.getErrorCode().getCode(), ex.getMessage(), ex);
        }

        ApiResponse<?> response = ApiResponse.error(
                ex.getErrorCode().getCode(),
                ex.getErrorCode().getMessage(),
                ex.getDetails()
        );
        response.setRequestId(requestId);

        return ResponseEntity
                .status(ex.getErrorCode().getHttpStatus())
                .body(response);
    }

    /**
     * 2. GameAdmin Domain Errors (404, 400, 401 vb.)
     */
    @ExceptionHandler(GameAdminException.class)
    public ResponseEntity<ApiResponse<?>> handleGameAdminException(
            GameAdminException ex,
            HttpServletRequest request) {

        String requestId = getRequestId();
        if (ex.getStatus().is4xxClientError()) {
            log.warn("GAME_ADMIN ERROR [{}] {} {} - {} {}",
                    requestId, request.getMethod(), request.getRequestURI(), ex.getStatus().value(), ex.getMessage());
        } else {
            log.error("GAME_ADMIN ERROR [{}] {} {} - {} {}",
                    requestId, request.getMethod(), request.getRequestURI(), ex.getStatus().value(), ex.getMessage(), ex);
        }

        ApiResponse<?> response = ApiResponse.error(
                String.valueOf(ex.getStatus().value()),
                ex.getMessage(),
                null
        );
        response.setRequestId(requestId);

        return ResponseEntity.status(ex.getStatus()).body(response);
    }

    /**
     * 3. Validation Errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ResponseEntity<ApiResponse<?>> handleValidationException(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {

        String requestId = getRequestId();
        String errors = ex.getBindingResult().getFieldErrors().stream()
                .map(e -> e.getField() + ": " + e.getDefaultMessage())
                .collect(Collectors.joining(", "));

        log.warn("VALIDATION ERROR [{}] {} {} - {}",
                requestId, request.getMethod(), request.getRequestURI(), errors);

        ApiResponse<?> response = ApiResponse.error(
                ErrorCode.VALIDATION_ERROR.getCode(),
                "Doğrulama hatası",
                errors
        );
        response.setRequestId(requestId);

        return ResponseEntity.badRequest().body(response);
    }

    /**
     * 3. Runtime Exception (Unexpected errors)
     */
    @ExceptionHandler(RuntimeException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<ApiResponse<?>> handleRuntimeException(
            RuntimeException ex,
            HttpServletRequest request) {

        String requestId = getRequestId();
        log.error("UNEXPECTED ERROR [{}] {} {} - {}",
                requestId, request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);

        ApiResponse<?> response = ApiResponse.error(
                ErrorCode.INTERNAL_ERROR.getCode(),
                ErrorCode.INTERNAL_ERROR.getMessage(),
                ex.getClass().getSimpleName() + ": " + ex.getMessage()
        );
        response.setRequestId(requestId);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(response);
    }

    /**
     * 4. Generic Exception Fallback
     */
    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ResponseEntity<ApiResponse<?>> handleGenericException(
            Exception ex,
            HttpServletRequest request) {

        String requestId = getRequestId();
        log.error("CRITICAL ERROR [{}] {} {} - {}",
                requestId, request.getMethod(), request.getRequestURI(), ex.getMessage(), ex);

        ApiResponse<?> response = ApiResponse.error(
                ErrorCode.INTERNAL_ERROR.getCode(),
                "Sistem hatası oluştu",
                "Lütfen daha sonra tekrar deneyin"
        );
        response.setRequestId(requestId);

        return ResponseEntity
                .status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(response);
    }

    /**
     * Extract correlation ID from request header or generate new one
     */
    private String getRequestId() {
        try {
            ServletRequestAttributes attrs = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
            if (attrs != null) {
                HttpServletRequest request = attrs.getRequest();
                String headerId = request.getHeader("X-Request-ID");
                if (headerId != null && !headerId.isBlank()) {
                    return headerId;
                }
            }
        } catch (Exception ignored) {
        }
        return "REQ-" + System.nanoTime();
    }
}