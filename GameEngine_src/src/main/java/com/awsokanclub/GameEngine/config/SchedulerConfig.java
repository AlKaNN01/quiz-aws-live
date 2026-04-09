/*
 * TaskScheduler thread havuzu konfigürasyonu.
 * Spring Boot varsayılanı tek thread — aynı anda 2 oyun varsa zamanlayıcılar birbirini bekler.
 * 10 thread ile her oyunun timer'ı bağımsız çalışır.
 */
package com.awsokanclub.GameEngine.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@Configuration
public class SchedulerConfig {

    @Bean
    public TaskScheduler taskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(10);
        scheduler.setThreadNamePrefix("GameScheduler-");
        scheduler.initialize();
        return scheduler;
    }
}