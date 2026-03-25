/*
 * Admin giris istegi.
 */
package com.awsokanclub.GameAdmin.dto.request;

import lombok.Data;

@Data
public class LoginRequest {
    private String username;
    private String password;
}