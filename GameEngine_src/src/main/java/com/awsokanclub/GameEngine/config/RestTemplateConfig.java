/*
 * RestTemplate bean tanimi.
 * GameAdmin ile HTTP iletisimi icin kullanilir.
 *
 * Timeout ayarlari:
 * - connectTimeout: GameAdmin'e baglanti suresi (5sn). Asarsa RuntimeException firlatilir.
 * - readTimeout: GameAdmin'in yanit suresi (5sn). WebSocket thread'i bloke etmez.
 * Timeout olmadan GameAdmin yavassa WebSocket thread'i 60sn bloke olur,
 * soru zamanlayicilari calismayi durdurur.
 */
package com.awsokanclub.GameEngine.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5000);
        factory.setReadTimeout(5000);
        return new RestTemplate(factory);
    }
}