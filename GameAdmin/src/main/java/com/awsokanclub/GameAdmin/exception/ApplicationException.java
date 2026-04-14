/*
 * Typ  Application Exception - Tüm business logic hatalarının base sınıfı
 */
package com.awsokanclub.GameAdmin.exception;

import lombok.Getter;

@Getter
public class ApplicationException extends RuntimeException {
    private final ErrorCode errorCode;
    private final String details;
    private final long timestamp = System.currentTimeMillis();

    public ApplicationException(ErrorCode errorCode) {
        this(errorCode, null, null);
    }

    public ApplicationException(ErrorCode errorCode, String details) {
        this(errorCode, details, null);
    }

    public ApplicationException(ErrorCode errorCode, String details, Throwable cause) {
        super(errorCode.getMessage() + (details != null ? " - " + details : ""), cause);
        this.errorCode = errorCode;
        this.details = details;
    }

    /*
     * Builder methods for common scenarios
     */
    public static ApplicationException notFound(String resource) {
        return new ApplicationException(ErrorCode.NOT_FOUND, resource + " bulunamadı");
    }

    public static ApplicationException alreadyExists(String resource) {
        return new ApplicationException(ErrorCode.ALREADY_EXISTS, resource + " zaten var");
    }

    public static ApplicationException invalidState(String details) {
        return new ApplicationException(ErrorCode.INVALID_INPUT, details);
    }

    public static ApplicationException validation(String field, String reason) {
        return new ApplicationException(ErrorCode.VALIDATION_ERROR, field + ": " + reason);
    }

    public boolean isClientError() {
        return errorCode.getHttpStatus() >= 400 && errorCode.getHttpStatus() < 500;
    }

    public boolean isServerError() {
        return errorCode.getHttpStatus() >= 500;
    }
}
