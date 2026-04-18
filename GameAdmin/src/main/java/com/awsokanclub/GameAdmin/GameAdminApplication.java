package com.awsokanclub.GameAdmin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GameAdminApplication {

	public static void main(String[] args) {
		SpringApplication.run(GameAdminApplication.class, args);
	}

}
