/*
 * GameResult tablosuna erişim.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.GameResult;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface GameResultRepository extends JpaRepository<GameResult, Long> {
    List<GameResult> findByGameIdOrderByRankAsc(String gameId);
}
