-- ==============================================================================
-- Benggala Database Schema
-- Database: sikemban1_benggala
-- ==============================================================================

CREATE TABLE IF NOT EXISTS `settings` (
    `setting_key` VARCHAR(64) PRIMARY KEY,
    `setting_value` TEXT NULL,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `detection_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `filename` VARCHAR(255) NOT NULL,
    `file_path` VARCHAR(255) NOT NULL,
    `detected_objects` TEXT NULL,
    `object_count` INT DEFAULT 0,
    `is_cctv` TINYINT(1) DEFAULT 0,
    `telegram_sent` TINYINT(1) DEFAULT 0,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default Application Settings
INSERT IGNORE INTO `settings` (`setting_key`, `setting_value`) VALUES
('llm_default_provider', 'deepseek'),
('deepseek_api_key', ''),
('deepseek_model', 'deepseek-chat'),
('gemini_api_key', ''),
('gemini_model', 'gemini-2.5-flash'),
('detection_threshold', '50'),
('sound_enabled', '1'),
('system_prompt', 'Anda adalah asisten AI Benggala yang bertugas menganalisis deteksi objek visual.'),
('telegram_enabled', '0'),
('telegram_bot_token', ''),
('telegram_chat_id', '');
