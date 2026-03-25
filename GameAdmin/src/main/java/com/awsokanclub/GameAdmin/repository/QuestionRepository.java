/*
 * Question icin veritabani islemleri.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.Question;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface QuestionRepository extends JpaRepository<Question, Long> {
    List<Question> findByGameIdOrderByOrderIndex(Long gameId);
    void deleteByGameId(Long gameId);
}