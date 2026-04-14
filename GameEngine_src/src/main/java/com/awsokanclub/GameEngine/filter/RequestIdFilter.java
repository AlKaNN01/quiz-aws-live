/*
 * Request ID Filter - Her request için correlation ID oluşturur
 * Logging'de request tracing için kullanılır
 */
package com.awsokanclub.GameEngine.filter;

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

@Slf4j
@Component
public class RequestIdFilter extends OncePerRequestFilter {

    private static final String REQUEST_ID_HEADER = "X-Request-ID";
    private static final String REQUEST_ID_MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {

        try {
            // Extract or generate request ID
            String requestId = request.getHeader(REQUEST_ID_HEADER);
            if (requestId == null || requestId.isBlank()) {
                requestId = "REQ-" + UUID.randomUUID().toString();
            }

            // Add to MDC (logging context)
            MDC.put(REQUEST_ID_MDC_KEY, requestId);
            MDC.put("method", request.getMethod());
            MDC.put("endpoint", request.getRequestURI());

            // Add to response header
            response.addHeader(REQUEST_ID_HEADER, requestId);

            // Log incoming request
            log.debug("Incoming request - Method: {}, Endpoint: {}, RequestId: {}",
                    request.getMethod(), request.getRequestURI(), requestId);

            // Continue filter chain
            filterChain.doFilter(request, response);

        } finally {
            // Cleanup MDC to prevent memory leaks in thread pools
            MDC.remove(REQUEST_ID_MDC_KEY);
            MDC.remove("method");
            MDC.remove("endpoint");
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        // Skip health check endpoints
        String path = request.getRequestURI();
        return path.startsWith("/actuator/health") || path.startsWith("/actuator/metrics");
    }
}
