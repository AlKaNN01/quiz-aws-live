/*
 * Global Error Codes - Test aşamasında hızlı debug için
 */
package com.awsokanclub.GameAdmin.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    // 4xx Client Errors
    INVALID_INPUT("E001", "Geçersiz input", 400),
    UNAUTHORIZED("E002", "Yetkilendirme başarısız", 401),
    FORBIDDEN("E003", "Erişim reddedildi", 403),
    NOT_FOUND("E004", "Kaynak bulunamadı", 404),
    ALREADY_EXISTS("E005", "Kaynak zaten var", 409),
    VALIDATION_ERROR("E006", "Doğrulama hatası", 400),

    // 5xx Server Errors
    INTERNAL_ERROR("E500", "İç sunucu hatası", 500),
    SERVICE_UNAVAILABLE("E503", "Hizmet kullanılamıyor", 503),
    DATABASE_ERROR("E501", "Veritabanı hatası", 500),
    REDIS_ERROR("E502", "Redis hatası", 500),
    TIMEOUT("E504", "İşlem zaman aşımı", 504),

    // Application Specific
    QUIZ_NOT_FOUND("Q001", "Quiz bulunamadı", 404),
    QUESTION_NOT_FOUND("Q002", "Soru bulunamadı", 404),
    INVALID_QUIZ_STATE("Q003", "Quiz geçersiz durumda", 400),
    GAME_NOT_FOUND("G001", "Oyun bulunamadı", 404),
    GAME_ALREADY_STARTED("G002", "Oyun zaten başladı", 409),
    GAME_ALREADY_ACTIVE("G003", "Oyun zaten aktif", 409),
    INSUFFICIENT_PLAYERS("G004", "Yetersiz oyuncu sayısı", 400),
    HOST_NOT_CONNECTED("G005", "Host bağlı değil", 400);

    private final String code;
    private final String message;
    private final int httpStatus;
}
