/*
 * Global Error Codes - Test aşamasında hızlı debug için
 */
package com.awsokanclub.GameEngine.exception;

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

    // Application Specific - Game Engine
    GAME_NOT_FOUND("G001", "Oyun bulunamadı", 404),
    GAME_ALREADY_STARTED("G002", "Oyun zaten başladı", 409),
    GAME_ALREADY_ACTIVE("G003", "Oyun zaten aktif", 409),
    QUESTION_NOT_ACTIVE("G004", "Soru aktif değil", 400),
    ANSWER_ALREADY_SUBMITTED("G005", "Cevap zaten gönderildi", 409),
    INVALID_ANSWER("G006", "Geçersiz cevap", 400),
    NICKNAME_TAKEN("G007", "Nickname zaten alınmış", 409),
    INVALID_JOIN_CODE("G008", "Geçersiz oyun kodu", 400),
    IP_BANNED("G009", "IP banlandı", 403),
    SESSION_BANNED("G010", "Session banlandı", 403),
    LOBBY_NOT_OPEN("G011", "Lobi açık değil", 400),
    HOST_NOT_CONNECTED("G012", "Host bağlı değil", 400);

    private final String code;
    private final String message;
    private final int httpStatus;
}
