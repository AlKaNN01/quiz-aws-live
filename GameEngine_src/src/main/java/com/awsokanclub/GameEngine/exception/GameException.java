/*
 * Tum oyun hatalarini temsil eder.
 * Factory metodlariyla kullanilir: throw GameException.nicknameTaken()
 * Controller'lar bu exception'i yakalar ve ErrorMessage olarak oyuncuya gonderir.
 */
package com.awsokanclub.GameEngine.exception;

import lombok.Getter;

@Getter
public class GameException extends RuntimeException {

    private final String errorCode;
    private final boolean retryable;

    private GameException(String errorCode, String message, boolean retryable) {
        super(message);
        this.errorCode = errorCode;
        this.retryable = retryable;
    }

    public static GameException nicknameTaken() {
        return new GameException("NICKNAME_TAKEN", "Bu nickname zaten alinmis.", true);
    }

    public static GameException gameNotFound() {
        return new GameException("GAME_NOT_FOUND", "Oyun bulunamadi.", false);
    }

    public static GameException gameNotStarted() {
        return new GameException("GAME_NOT_STARTED", "Oyun henuz baslamadi.", false);
    }

    public static GameException gameAlreadyStarted() {
        return new GameException("GAME_ALREADY_STARTED", "Oyun zaten basladi.", false);
    }

    public static GameException alreadyAnswered() {
        return new GameException("ALREADY_ANSWERED", "Bu soruyu zaten cevapladın.", false);
    }

    public static GameException questionNotActive() {
        return new GameException("QUESTION_NOT_ACTIVE", "Soru su an aktif degil.", false);
    }

    public static GameException ipBanned() {
        return new GameException("IP_BANNED", "Bu IP adresi engellenmis.", false);
    }

    public static GameException sessionBanned() {
        return new GameException("SESSION_BANNED", "Bu oturum engellenmis.", false);
    }

    public static GameException unauthorized() {
        return new GameException("UNAUTHORIZED", "Yetkiniz yok.", false);
    }

    public static GameException invalidJoinCode() {
        return new GameException("INVALID_JOIN_CODE", "Gecersiz katilim kodu.", true);
    }

    public static GameException invalidAnswer() {
        return new GameException("INVALID_ANSWER", "Gecersiz cevap. Sadece A, B, C veya D gonderilebilir.", false);
    }

    public static GameException lobbyNotOpen() {
        return new GameException("LOBBY_NOT_OPEN", "Lobi henuz acilmadi. Host'un baglantisini ve admin onayini bekleyin.", true);
    }

    public static GameException hostNotConnected() {
        return new GameException("HOST_NOT_CONNECTED", "Host henuz baglanmadi.", false);
    }
}