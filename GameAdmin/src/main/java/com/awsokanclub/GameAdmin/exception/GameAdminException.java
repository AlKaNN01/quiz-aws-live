/*
 * GameAdmin icin özel hata sinifi.
 * HTTP status kodu ile birlikte firlatilir.
 */
package com.awsokanclub.GameAdmin.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public class GameAdminException extends RuntimeException {

    private final HttpStatus status;

    public GameAdminException(String message, HttpStatus status) {
        super(message);
        this.status = status;
    }

    public static GameAdminException notFound(String message) {
        return new GameAdminException(message, HttpStatus.NOT_FOUND);
    }

    public static GameAdminException badRequest(String message) {
        return new GameAdminException(message, HttpStatus.BAD_REQUEST);
    }

    public static GameAdminException unauthorized(String message) {
        return new GameAdminException(message, HttpStatus.UNAUTHORIZED);
    }
}