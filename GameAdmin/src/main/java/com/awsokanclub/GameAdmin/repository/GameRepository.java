/*
 * Game icin veritabani islemleri.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.Game;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface GameRepository extends JpaRepository<Game, Long> {
    Optional<Game> findByJoinCode(String joinCode);
    Optional<Game> findFirstByStatusOrderByCreatedAtDesc(Game.Status status);
}