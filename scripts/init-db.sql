-- Initialize PostgreSQL Database for Quiz System
-- This script creates necessary tables and seed data

-- ================================================================
-- Tables
-- ================================================================

-- Games (quizzes)
CREATE TABLE IF NOT EXISTS games (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    join_code VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Questions
CREATE TABLE IF NOT EXISTS questions (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL,
    text TEXT NOT NULL,
    option_a VARCHAR(255) NOT NULL,
    option_b VARCHAR(255) NOT NULL,
    option_c VARCHAR(255) NOT NULL,
    option_d VARCHAR(255) NOT NULL,
    correct_answer VARCHAR(1) NOT NULL,
    timer_seconds INT DEFAULT 20,
    order_index INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- Game Results (başında oyun oturumları)
CREATE TABLE IF NOT EXISTS game_results (
    id BIGSERIAL PRIMARY KEY,
    game_id BIGINT NOT NULL,
    player_nickname VARCHAR(255),
    total_score INT DEFAULT 0,
    rank INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- ================================================================
-- Indexes
-- ================================================================

CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_join_code ON games(join_code);
CREATE INDEX idx_questions_game_id ON questions(game_id);
CREATE INDEX idx_game_results_game_id ON game_results(game_id);

-- ================================================================
-- Seed Data (Test için örnek quiz)
-- ================================================================

INSERT INTO games (title, status) VALUES 
    ('Temel Matematik', 'PUBLISHED'),
    ('Türkçe Dilbilgisi', 'PUBLISHED'),
    ('İngilizce Kelime Bilgisi', 'PUBLISHED')
ON CONFLICT DO NOTHING;

INSERT INTO questions (game_id, text, option_a, option_b, option_c, option_d, correct_answer, timer_seconds, order_index) VALUES 
    (1, '5 + 3 kaçtır?', '7', '8', '9', '10', 'B', 15, 1),
    (1, '12 - 4 kaçtır?', '8', '7', '6', '5', 'A', 15, 2),
    (1, '3 × 4 kaçtır?', '10', '11', '12', '13', 'C', 15, 3)
ON CONFLICT DO NOTHING;

INSERT INTO questions (game_id, text, option_a, option_b, option_c, option_d, correct_answer, timer_seconds, order_index) VALUES 
    (2, 'Aşağıdakilerden hangisi isim?', 'koşmak', 'güzel', 'hızlı', 'şimdi', 'B', 15, 1),
    (2, 'Plural nedir?', 'Şimdiki zaman', 'Çokluk', 'Geçmiş zaman', 'Kişi', 'B', 15, 2)
ON CONFLICT DO NOTHING;

-- ================================================================
-- Extensions (JSON desteği için)
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- Permissions
-- ================================================================

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT USAGE, CREATE ON SCHEMA public TO postgres;
