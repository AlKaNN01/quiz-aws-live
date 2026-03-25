/*
 * Admin giris islemlerini yonetir.
 * Kullanici dogrulamasi ve JWT uretimi burada yapilir.
 */
package com.awsokanclub.GameAdmin.service;

import com.awsokanclub.GameAdmin.dto.request.LoginRequest;
import com.awsokanclub.GameAdmin.dto.response.LoginResponse;
import com.awsokanclub.GameAdmin.exception.GameAdminException;
import com.awsokanclub.GameAdmin.model.AdminUser;
import com.awsokanclub.GameAdmin.repository.AdminUserRepository;
import com.awsokanclub.GameAdmin.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {

    private final AdminUserRepository adminUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;

    public LoginResponse login(LoginRequest request) {
        AdminUser user = adminUserRepository.findByUsername(request.getUsername())
                .orElseThrow(() -> GameAdminException.unauthorized("Kullanici adi veya sifre yanlis."));

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            throw GameAdminException.unauthorized("Kullanici adi veya sifre yanlis.");
        }

        String token = jwtUtil.generateToken(user.getUsername(), user.getRole());
        log.info("Admin giris yapti: {}", user.getUsername());
        return new LoginResponse(token, user.getUsername(), user.getRole());
    }
}