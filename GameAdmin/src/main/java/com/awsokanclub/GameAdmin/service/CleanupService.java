package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.repository.GameRepository;
import com.awsokanclub.GameAdmin.repository.GameResultRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Slf4j
@Service
@RequiredArgsConstructor
public class CleanupService {

    private static final int ABANDONED_SESSION_HOURS = 4;
    private static final int OLD_RESULTS_DAYS = 90;

    private final GameRepository gameRepository;
    private final GameResultRepository gameResultRepository;

    // Her 30 dakikada bir: 4 saatten eski terk edilmiş lobi join_code'larını temizle
    @Scheduled(fixedDelay = 30 * 60 * 1000)
    @Transactional
    public void clearAbandonedSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusHours(ABANDONED_SESSION_HOURS);
        int cleared = gameRepository.clearAbandonedJoinCodes(cutoff);
        if (cleared > 0) {
            log.info("Terk edilmiş lobi temizlendi: {} quiz join_code sıfırlandı (cutoff: {})", cleared, cutoff);
        }
    }

    // Her gece 03:00'da: 90 günden eski game_result satırlarını sil
    @Scheduled(cron = "0 0 3 * * *")
    @Transactional
    public void deleteOldResults() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(OLD_RESULTS_DAYS);
        int deleted = gameResultRepository.deleteOldResults(cutoff);
        if (deleted > 0) {
            log.info("Eski oyun sonuçları temizlendi: {} satır silindi (cutoff: {})", deleted, cutoff);
        }
    }
}
