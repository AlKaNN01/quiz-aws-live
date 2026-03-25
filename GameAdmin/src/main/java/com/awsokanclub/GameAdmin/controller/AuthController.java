/*
 * Admin giris endpoint'i.
 * /api/auth/login herkese acik, token dondurur.
 */
package com.awsokanclub.GameAdmin.controller;

import com.awsokanclub.GameAdmin.dto.request.LoginRequest;
import com.awsokanclub.GameAdmin.dto.response.LoginResponse;
import com.awsokanclub.GameAdmin.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }
}