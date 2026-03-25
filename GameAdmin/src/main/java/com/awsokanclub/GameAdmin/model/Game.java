/*
 * Bir bilgi yarismasi oyununu temsil eder.
 * Admin tarafindan olusturulur, yayina alininca oynanabilir hale gelir.
 */
package com.awsokanclub.GameAdmin.model;

import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "games")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Game {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(name = "join_code", unique = true)
    private String joinCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Status status;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "game", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderIndex ASC")
    private List<Question> questions;

    @PrePersist
    public void prePersist() {
        createdAt = LocalDateTime.now();
        if (status == null) status = Status.DRAFT;
    }

    public enum Status {
        DRAFT,      // Hazirlaniyor
        PUBLISHED,  // Yayinda, katilim acik
        ACTIVE,     // Oyun devam ediyor
        FINISHED    // Oyun bitti
    }
}