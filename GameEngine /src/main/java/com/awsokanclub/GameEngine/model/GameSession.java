package com.awsokanclub.GameEngine.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameSession {
    private String sessionId;
    private String userId;
    private String nickname;
    private String principalName;
    private String gameId;
    private String ipAddress;
    private long joinedAt;

    public enum Status {
        ACTIVE, BANNED
    }

    private Status status;
}
