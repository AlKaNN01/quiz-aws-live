package com.awsokanclub.GameEngine;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class GameEngineApplication {

	public static void main(String[] args) {
		SpringApplication.run(GameEngineApplication.class, args);
	}

}
