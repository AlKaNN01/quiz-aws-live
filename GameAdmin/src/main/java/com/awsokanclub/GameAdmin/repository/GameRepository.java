/*
 * Game icin veritabani islemleri.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, Long> {
    Optional<Game> findByJoinCode(String joinCode);
    Optional<Game> findFirstByStatusOrderByCreatedAtDesc(Game.Status status);

    @Query("SELECT g FROM Game g WHERE g.joinCode IS NOT NULL AND g.updatedAt < :cutoff")
    List<Game> findAbandonedSessions(@Param("cutoff") LocalDateTime cutoff);

    @Modifying
    @Query("UPDATE Game g SET g.joinCode = NULL, g.updatedAt = CURRENT_TIMESTAMP WHERE g.joinCode IS NOT NULL AND g.updatedAt < :cutoff")
    int clearAbandonedJoinCodes(@Param("cutoff") LocalDateTime cutoff);
}