-- Azula Code schema (MySQL 8). Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(80) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  bio VARCHAR(500) NULL,
  plan VARCHAR(40) NOT NULL DEFAULT 'free',
  referral_code VARCHAR(16) NOT NULL UNIQUE,
  referred_by INT UNSIGNED NULL,
  credits INT NOT NULL DEFAULT 0,
  suspended TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_ref FOREIGN KEY (referred_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Roles live in their own table, never on users.
CREATE TABLE IF NOT EXISTS user_roles (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  role ENUM('admin','moderator','user') NOT NULL,
  UNIQUE KEY uq_user_role (user_id, role),
  CONSTRAINT fk_roles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS api_keys (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  provider VARCHAR(40) NOT NULL,
  label VARCHAR(60) NOT NULL DEFAULT '',
  key_cipher TEXT NOT NULL,
  last4 VARCHAR(4) NOT NULL,
  base_url VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_keys_user (user_id),
  CONSTRAINT fk_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS models (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(40) NOT NULL,
  model_id VARCHAR(120) NOT NULL,
  label VARCHAR(80) NOT NULL,
  context_window INT NOT NULL DEFAULT 128000,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort INT NOT NULL DEFAULT 0,
  UNIQUE KEY uq_model (provider, model_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS plans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(60) NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  currency VARCHAR(3) NOT NULL DEFAULT 'USD',
  interval_label VARCHAR(20) NOT NULL DEFAULT 'month',
  features JSON NOT NULL,
  max_workspaces INT NOT NULL DEFAULT 3,
  disk_mb INT NOT NULL DEFAULT 1024,
  highlighted TINYINT(1) NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  sort INT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS referrals (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  referrer_id INT UNSIGNED NOT NULL,
  referred_id INT UNSIGNED NOT NULL UNIQUE,
  reward INT NOT NULL DEFAULT 0,
  rewarded TINYINT(1) NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ref_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_ref_referred FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS site_settings (
  k VARCHAR(80) PRIMARY KEY,
  v TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workspaces (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  name VARCHAR(60) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ws_user (user_id),
  CONSTRAINT fk_ws_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS messages (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT UNSIGNED NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content MEDIUMTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_msg_ws (workspace_id),
  CONSTRAINT fk_msg_ws FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  workspace_id INT UNSIGNED NOT NULL,
  user_id INT UNSIGNED NOT NULL,
  model VARCHAR(160) NOT NULL,
  mode VARCHAR(10) NOT NULL,
  status ENUM('running','done','error','stopped') NOT NULL DEFAULT 'running',
  steps INT NOT NULL DEFAULT 0,
  tokens_in INT NOT NULL DEFAULT 0,
  tokens_out INT NOT NULL DEFAULT 0,
  error VARCHAR(1000) NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  finished_at DATETIME NULL,
  KEY idx_runs_user (user_id),
  CONSTRAINT fk_runs_ws FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NULL,
  action VARCHAR(60) NOT NULL,
  detail VARCHAR(2000) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ---------- Seed ----------
INSERT IGNORE INTO models (provider, model_id, label, context_window, sort) VALUES
  ('openai', 'gpt-4.1', 'GPT-4.1', 1000000, 1),
  ('openai', 'gpt-4.1-mini', 'GPT-4.1 mini', 1000000, 2),
  ('anthropic', 'claude-sonnet-4-5', 'Claude Sonnet 4.5', 200000, 3),
  ('google', 'gemini-2.5-pro', 'Gemini 2.5 Pro', 1000000, 4),
  ('google', 'gemini-2.5-flash', 'Gemini 2.5 Flash', 1000000, 5),
  ('openrouter', 'deepseek/deepseek-chat', 'DeepSeek V3 (OpenRouter)', 128000, 6),
  ('groq', 'llama-3.3-70b-versatile', 'Llama 3.3 70B (Groq)', 128000, 7);

INSERT IGNORE INTO plans (slug, name, price_cents, features, max_workspaces, disk_mb, highlighted, sort) VALUES
  ('free', 'Free', 0, JSON_ARRAY('Bring your own API key','3 workspaces','1 GB disk per workspace','Live preview','Community support'), 3, 1024, 0, 1),
  ('pro', 'Pro', 900, JSON_ARRAY('Everything in Free','25 workspaces','10 GB disk per workspace','Longer command timeouts','Priority queue'), 25, 10240, 1, 2),
  ('team', 'Team', 2900, JSON_ARRAY('Everything in Pro','Unlimited workspaces','Shared workspaces','Admin audit log','Email support'), 1000, 20480, 0, 3);

INSERT IGNORE INTO site_settings (k, v) VALUES
  ('site_name', 'Azula Code'),
  ('tagline', 'An agent that ships code, not suggestions.'),
  ('support_email', ''),
  ('referral_reward', '50'),
  ('max_workspaces_free', '3'),
  ('exec_timeout_seconds', '180'),
  ('registrations_open', 'true'),
  ('announcement', '');
