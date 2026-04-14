/*
 * Nickname küfür / uygunsuz içerik filtresi.
 *
 * Yaklaşım: substring tarama — "orospu" içeren her nickname reddedilir.
 * Liste kasıtlı kısa tutuldu; amacı açık hakaret ve spam nickname'leri engellemek,
 * kapsamlı içerik moderasyonu yapmak değil.
 *
 * Yeni kelime eklemek için BLOCKED_WORDS set'ine eklemek yeterli.
 */
package com.awsokanclub.GameEngine.service;

import org.springframework.stereotype.Service;

import java.util.Set;

@Service
public class ProfanityFilter {

    private static final Set<String> BLOCKED_WORDS = Set.of(
        // Türkçe
        "orospu", "oruspu", "bok", "sik", "amk", "amına", "amina",
        "götveren", "otuzbir", "ibne", "pezevenk",
        "yarrak", "taşak", "amcık",
        // İngilizce
        "fuck", "shit", "cunt", "bitch", "asshole", "nigger", "faggot"
    );

    /*
     * Nickname'in uygun olup olmadığını kontrol eder.
     * true → temiz, false → engelli.
     */
    public boolean isClean(String nickname) {
        if (nickname == null || nickname.isBlank()) return false;
        String lower = nickname.toLowerCase().replaceAll("\\s+", "");
        for (String word : BLOCKED_WORDS) {
            if (lower.contains(word)) return false;
        }
        return true;
    }
}
