package com.awsokanclub.GameAdmin.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class EngineTokenAuthFilter extends OncePerRequestFilter {

    @Value("${app.security.engine-token}")
    private String engineToken;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        String requestPath = request.getRequestURI();

        if (!shouldValidateToken(requestPath, request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String authHeader = request.getHeader("Authorization");

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            log.warn("Engine token missing: {}", requestPath);
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.getWriter().write("{\"error\": \"Engine token required\"}");
            return;
        }

        String token = authHeader.substring(7);

        if (!token.equals(engineToken)) {
            log.warn("Invalid engine token: {}", requestPath);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.getWriter().write("{\"error\": \"Invalid engine token\"}");
            return;
        }

        log.debug("Engine token validated: {}", requestPath);
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "game-engine", null, List.of(new SimpleGrantedAuthority("ROLE_ENGINE"))
        );
        SecurityContextHolder.getContext().setAuthentication(auth);
        filterChain.doFilter(request, response);
    }

    // Engine token sadece iki durumda zorunlu:
    // 1. /api/games/engine/** — engine'e özel yönetim endpoint'leri
    // 2. POST /api/games/{id}/results — engine'in sonuç kaydettiği endpoint
    // GET /api/games/{id}/results admin JWT ile erişilebilir, engine token gerektirmez.
    private boolean shouldValidateToken(String path, String method) {
        if (path.startsWith("/api/games/engine/")) return true;
        return "POST".equals(method) && path.matches("/api/games/[^/]+/results");
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !shouldValidateToken(request.getRequestURI(), request.getMethod());
    }
}
