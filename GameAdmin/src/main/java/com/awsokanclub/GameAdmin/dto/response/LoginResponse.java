/*
 * Basarili giris sonrasi admin'e verilen JWT token.
 */
package com.awsokanclub.GameAdmin.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class LoginResponse {
    private String token;
    private String username;
    private String role;
}