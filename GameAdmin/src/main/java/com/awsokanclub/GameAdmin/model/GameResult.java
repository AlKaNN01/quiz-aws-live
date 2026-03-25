/*
 * Oyun bitince her oyuncunun sonucunu kalıcı olarak saklar.
 * GameEngine oyun bitişinde bu tabloya yazar.
 */
package com.awsokanclub.GameAdmin.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "game_results")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GameResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "game_id", nullable = false)
    private String gameId; // joinCode

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private String nickname;

    @Column(nullable = false)
    private int totalScore;

    @Column(nullable = false)
    private int rank;

    @Column(name = "finished_at")
    private LocalDateTime finishedAt;

    @PrePersist
    public void prePersist() {
        finishedAt = LocalDateTime.now();
    }
}