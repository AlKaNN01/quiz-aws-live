/*
 * AdminUser icin veritabani islemleri.
 */
package com.awsokanclub.GameAdmin.repository;

import com.awsokanclub.GameAdmin.model.AdminUser;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminUserRepository extends JpaRepository<AdminUser, Long> {
    Optional<AdminUser> findByUsername(String username);
}