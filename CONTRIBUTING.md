# Contributing Guide

Projeye katkıda bulunmaya hoş geldin! Aşağıda geliştirme standartlarını ve kuralları bulabilirsin.

## Git Workflow

### Branch Naming

```
feature/description     # Yeni özellik
bugfix/description      # Bug düzeltmesi
refactor/description    # Kod refactoring
docs/description        # Dokümantasyon
```

### Commit Messages

Conventional Commits formatını kullan:

```
feat: oyun başlama mekanizması ekle
fix: WebSocket bağlantı timeout'u düzelt
docs: deployment rehberini güncelle
refactor: GameAdminClient'ı simplify et
test: auth filter'ı için test ekle
chore: dependencies'i güncelledır
```

### Pull Requests

1. Açıklayıcı başlık ve açıklama yaz
2. Linked issues'i referans göster: `Fixes #123`
3. Code review ve tests geçmesini bekle
4. Minimum 1 approval gerekli (2 ideal)

## Code Standards

### Java (Backend)

**Formatting**: Google Java Style Guide

```bash
# Reformat (IDE veya command line)
mvn spotless:apply  # Recommeded
```

**Naming**:
- Classes: `PascalCase` (GameService, JwtUtil)
- Methods: `camelCase` (validateToken, saveResults)
- Constants: `UPPER_SNAKE_CASE`
- Private fields: `camelCase` (jwtSecret)

**Documentation**:

```java
/**
 * Oyun sonuçlarını kaydeder.
 * 
 * @param gameId Oyun ID'si (joinCode)
 * @param results Oyuncu sonuçları listesi
 * @throws IllegalArgumentException gameId boş ise
 */
public void saveResults(String gameId, List<GameResultRequest> results) {
    // ...
}
```

**Error Handling**:

```java
// ✅ Good
try {
    response = restTemplate.exchange(url, HttpMethod.GET, entity, new ParameterizedTypeReference<>() {});
} catch (HttpServerErrorException e) {
    log.warn("Temporary service error, will retry: {}", e.getStatusCode());
    throw e;  // Upstream retry mekanizmasına bırak
} catch (HttpClientErrorException.NotFound e) {
    log.debug("Resource not found: {}", url);
    return null;  // Handle gracefully
}

// ❌ Bad
try {
    // ...
} catch (Exception e) {
    throw new RuntimeException("Error occurred");  // Generic error
}
```

### TypeScript/React (Frontend)

**Formatting**: Prettier

```bash
npm run format
```

**Component Structure**:

```jsx
import React, { useState } from 'react';
import './GameForm.css';

/**
 * Oyun formu bileşeni.
 * @param {Object} props - Bileşen prop'ları
 * @param {Function} props.onSubmit - Form submit callback
 */
export default function GameForm({ onSubmit }) {
  const [title, setTitle] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(title);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Oyun başlığı"
        required
      />
      <button type="submit">Oluştur</button>
    </form>
  );
}
```

**Naming**:
- Components: `PascalCase` (GameForm, PlayerList)
- Hooks: `use*` (useWebSocket, useGameState)
- Utilities: `camelCase` (fetchGames, parseToken)

### SQL/Database

Migrations (Liquibase/Flyway formatı):

```sql
-- V1__initial_schema.sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- V2__add_game_results.sql
CREATE TABLE game_results (
    id SERIAL PRIMARY KEY,
    game_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    -- ...
    CONSTRAINT fk_game FOREIGN KEY (game_id) REFERENCES games(id)
);
```

## Testing

### Unit Tests

```java
@SpringBootTest
@DisplayName("GameService Unit Tests")
class GameServiceTest {

    @Mock
    private GameRepository gameRepository;

    @InjectMocks
    private GameService gameService;

    @BeforeEach
    void setUp() {
        MockitoAnnotations.openMocks(this);
    }

    @Test
    @DisplayName("should save results with valid data")
    void testSaveResults_Valid() {
        // Arrange
        List<GameResultRequest> results = List.of(
            GameResultRequest.builder()
                .gameId("game-1")
                .userId("user-1")
                .nickname("Player1")
                .totalScore(100)
                .rank(1)
                .build()
        );

        // Act
        gameService.saveResults("game-1", results);

        // Assert
        verify(gameRepository).saveAll(any());
    }

    @Test
    @DisplayName("should reject invalid results")
    void testSaveResults_Invalid() {
        // Arrange
        List<GameResultRequest> invalidResults = List.of(
            GameResultRequest.builder()
                .gameId("")  // Invalid: empty
                .userId("user-1")
                .totalScore(100)
                .rank(1)
                .build()
        );

        // Act & Assert
        assertThrows(ConstraintViolationException.class, 
            () -> gameService.saveResults("", invalidResults));
    }
}
```

### Integration Tests

```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GameControllerIT {

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    @DisplayName("should create game successfully")
    void testCreateGame() {
        CreateGameRequest request = new CreateGameRequest("Test Game");
        
        ResponseEntity<GameResponse> response = restTemplate.postForEntity(
            "/api/games",
            request,
            GameResponse.class
        );

        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody().getId());
    }
}
```

**Coverage Target**: Min. 70% for critical paths

```bash
# Generate coverage report
mvn jacoco:report
```

## Performance

### Load Testing

```bash
# Apache JMeter veya k6 ile load test
k6 run load-test.js
```

### Profiling

```bash
# Java Flight Recorder
java -XX:StartFlightRecording=duration=60s,filename=recording.jfr GameAdmin.jar

# Analyze
jmc recording.jfr
```

## Security

### OWASP Top 10 Compliance

- ✅ SQL Injection: Use parameterized queries (Spring Data)
- ✅ Authentication: JWT with strong secrets
- ✅ Authorization: Role-based access (Spring Security)
- ✅ Data Exposure: Always use HTTPS in production
- ✅ CSRF: CSRF tokens (Spring Security default)
- ✅ Insecure Dependencies: `npm audit`, `mvn dependency-check:check`
- ✅ XXE: Jackson konfigürasyonu (default safe)
- ✅ Access Control: requestMatchers ile endpoint güvenliği

### Dependency Security

```bash
# Java
mvn dependency-check:check

# JavaScript
npm audit
npm audit fix  # Auto-fix vulnerabilities
```

## Documentation

### API Documentation (Swagger/OpenAPI)

`pom.xml` (Backend):
```xml
<dependency>
    <groupId>org.springdoc</groupId>
    <artifactId>springdoc-openapi-starter-webmvc-ui</artifactId>
    <version>2.0.0</version>
</dependency>
```

Auto-generated: `/api-docs` and `/swagger-ui.html`

### Code Comments

```java
// ✅ Good: WHY, not WHAT
// Cache question list for 2 hours to reduce database load
// since questions don't change during a live game (admin-controlled)
redisTemplate.opsForValue().set("questions:" + gameId, questions, Duration.ofHours(2));

// ❌ Bad
// Set questions in Redis
redisTemplate.opsForValue().set("questions:" + gameId, questions);
```

## Release Checklist

Before deploying to production:

- [ ] All tests passing
- [ ] Code reviewed and approved
- [ ] Security scan clear (`npm audit`, `mvn dependency-check`)
- [ ] Performance baseline met
- [ ] Database migrations tested
- [ ] `.env.example` updated if new vars added
- [ ] README/DEPLOYMENT docs updated
- [ ] Git tag created: `v1.0.0`

```bash
# Tag release
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
```

## Common Issues

### Build Failures

```bash
# Clean and rebuild
mvn clean install -DskipTests

# Clear npm cache
npm cache clean --force && npm install
```

### Docker Issues

```bash
# Rebuild images
docker-compose down
docker-compose build --no-cache
docker-compose up
```

### Database Schema Issues

```bash
# Drop and recreate (dev only)
docker exec postgres dropdb -U postgres gameadmin
docker exec postgres createdb -U postgres gameadmin
docker-compose restart gameadmin
```

## Support

- Questions: GitHub Discussions
- Bugs: GitHub Issues
- Security: Email security@yourdomain.com (don't use public issues)

---

**Katkıların başında teşekkürler!** 🎉
