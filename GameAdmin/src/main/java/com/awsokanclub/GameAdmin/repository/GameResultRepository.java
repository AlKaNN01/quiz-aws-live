/*
 * GameResult tablosuna erişim.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.GameResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface GameResultRepository extends JpaRepository<GameResult, Long> {
    List<GameResult> findByGameIdOrderByRankAsc(Long gameId);

    @Modifying
    @Query("DELETE FROM GameResult gr WHERE gr.createdAt < :cutoff")
    int deleteOldResults(@Param("cutoff") LocalDateTime cutoff);
}
