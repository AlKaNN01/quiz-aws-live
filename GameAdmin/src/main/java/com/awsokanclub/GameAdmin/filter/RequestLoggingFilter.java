package com.awsokanclub.GameAdmin.filter;

import lombok.extern.slf4j.Slf4j;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;

/**
 * HTTP Request/Response Logging Filter
 * Logs all incoming requests with unique request ID for tracing
 * Useful for debugging, audit trail, and performance monitoring
 */
@Slf4j
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final String REQUEST_ID = "requestId";
    private static final String REQUEST_ID_HEADER = "X-Request-ID";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        
        // Generate unique request ID or use existing header
        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isEmpty()) {
            requestId = UUID.randomUUID().toString();
        }
        
        // Add to MDC for all logs in this request
        MDC.put(REQUEST_ID, requestId);
        response.setHeader(REQUEST_ID_HEADER, requestId);
        
        long startTime = System.currentTimeMillis();
        String method = request.getMethod();
        String path = request.getRequestURI();
        String query = request.getQueryString();
        String remoteAddr = getClientIp(request);
        
        // Log incoming request
        String requestLog = query != null 
            ? String.format("[%s] %s %s?%s from %s", requestId, method, path, query, remoteAddr)
            : String.format("[%s] %s %s from %s", requestId, method, path, remoteAddr);
        log.info(">>> {}", requestLog);
        
        try {
            // Process request
            filterChain.doFilter(request, response);
            
            // Log response
            long duration = System.currentTimeMillis() - startTime;
            int statusCode = response.getStatus();

            if (statusCode >= 500) {
                log.error("<<< [{}] {} {} - {} ms", requestId, statusCode, path, duration);
            } else if (statusCode >= 400) {
                log.warn("<<< [{}] {} {} - {} ms", requestId, statusCode, path, duration);
            } else {
                log.info("<<< [{}] {} {} - {} ms", requestId, statusCode, path, duration);
            }
            
        } catch (Exception e) {
            long duration = System.currentTimeMillis() - startTime;
            log.error("[{}] EXCEPTION in {} {} - {} ms", requestId, method, path, duration, e);
            throw e;
        } finally {
            // Clean up MDC
            MDC.remove(REQUEST_ID);
        }
    }

    /**
     * Get client IP address, handling proxies
     */
    private String getClientIp(HttpServletRequest request) {
        String[] headers = {
            "X-Forwarded-For",
            "Proxy-Client-IP",
            "WL-Proxy-Client-IP",
            "HTTP_X_FORWARDED_FOR",
            "HTTP_X_FORWARDED",
            "HTTP_FORWARDED_FOR",
            "HTTP_FORWARDED",
            "HTTP_CLIENT_IP"
        };
        
        for (String header : headers) {
            String ip = request.getHeader(header);
            if (ip != null && !ip.isEmpty() && !ip.equals("unknown")) {
                return ip.split(",")[0].trim();
            }
        }
        
        return request.getRemoteAddr();
    }
}
