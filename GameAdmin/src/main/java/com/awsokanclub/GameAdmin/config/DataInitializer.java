/*
 * Uygulama ilk basladiginda varsayilan admin kullanicisi olusturur.
 * Production'da bu sifreyi degistir.
 */
//TODO şifreyi değiştirmeyi unutma
package com.awsokanclub.GameAdmin.config;

import com.awsokanclub.GameAdmin.model.AdminUser;
import com.awsokanclub.GameAdmin.repository.AdminUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements CommandLineRunner {

    private final AdminUserRepository adminUserRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) {
        if (adminUserRepository.findByUsername("admin").isEmpty()) {
            AdminUser admin = AdminUser.builder()
                    .username("admin")
                    .password(passwordEncoder.encode("admin123"))
                    .role("ADMIN")
                    .build();
            adminUserRepository.save(admin);
            log.info("Varsayilan admin kullanicisi olusturuldu: admin / admin123");
        }

        if (adminUserRepository.findByUsername("host").isEmpty()) {
            AdminUser host = AdminUser.builder()
                    .username("host")
                    .password(passwordEncoder.encode("host123"))
                    .role("HOST")
                    .build();
            adminUserRepository.save(host);
            log.info("Varsayilan host kullanicisi olusturuldu: host / host123");
        }
    }
}