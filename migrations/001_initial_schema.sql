-- migrations/001_initial_schema.sql

-- ── Extensions ────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  pj_number      TEXT NOT NULL,
  is_superadmin  BOOLEAN NOT NULL DEFAULT false,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  hashed_otp     TEXT,
  otp_expires_at TIMESTAMPTZ,
  last_login     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_email_unique     UNIQUE (email),
  CONSTRAINT users_pj_number_unique UNIQUE (pj_number)
);

-- ── Departments ───────────────────────────────────────────────────────────────

CREATE TABLE departments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  code       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT departments_code_unique UNIQUE (code)
);

-- ── User ↔ Department memberships ─────────────────────────────────────────────

CREATE TYPE department_role AS ENUM ('admin', 'officer', 'viewer');

CREATE TABLE user_departments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  role          department_role NOT NULL DEFAULT 'viewer',
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT user_departments_unique UNIQUE (user_id, department_id)
);

-- ── Documents ─────────────────────────────────────────────────────────────────

CREATE TYPE document_type AS ENUM (
  'memo', 'letter', 'judgment', 'ruling', 'order', 'correspondence', 'upload'
);

CREATE TYPE document_status AS ENUM (
  'draft', 'pending', 'review', 'marked', 'filed'
);

CREATE TYPE document_category AS ENUM (
  'judgments', 'rulings', 'correspondence', 'orders', 'drafts', 'general'
);

CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  type            document_type NOT NULL,
  category        document_category,
  status          document_status NOT NULL DEFAULT 'draft',
  reference_no    TEXT,

  -- Rich text body (memo / letter)
  body            TEXT,

  -- Cloudinary fields (upload types only)
  file_url        TEXT,
  file_public_id  TEXT,
  file_size_bytes BIGINT,
  mime_type       TEXT,
  original_name   TEXT,

  -- Relations
  assigned_to     UUID REFERENCES users(id)       ON DELETE SET NULL,
  created_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  department_id   UUID REFERENCES departments(id) ON DELETE SET NULL,

  -- Signing
  is_signed       BOOLEAN NOT NULL DEFAULT false,
  signed_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  signed_at       TIMESTAMPTZ,

  -- Sending
  is_sent         BOOLEAN NOT NULL DEFAULT false,
  sent_at         TIMESTAMPTZ,

  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A document is either composed (has body) or uploaded (has file_url), not neither
  CONSTRAINT document_has_content CHECK (
    body IS NOT NULL OR file_url IS NOT NULL
  )
);

-- ── Document annotations ──────────────────────────────────────────────────────

CREATE TABLE document_annotations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  annotated_by        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  comment             TEXT NOT NULL,
  is_urgent           BOOLEAN NOT NULL DEFAULT false,
  visible_in_summary  BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Users
CREATE INDEX idx_users_pj_number   ON users (UPPER(pj_number));
CREATE INDEX idx_users_email        ON users (LOWER(email));
CREATE INDEX idx_users_is_active    ON users (is_active);

-- User departments
CREATE INDEX idx_user_departments_user_id   ON user_departments (user_id);
CREATE INDEX idx_user_departments_dept_id   ON user_departments (department_id);

-- Documents
CREATE INDEX idx_documents_created_by    ON documents (created_by);
CREATE INDEX idx_documents_assigned_to   ON documents (assigned_to);
CREATE INDEX idx_documents_department_id ON documents (department_id);
CREATE INDEX idx_documents_status        ON documents (status);
CREATE INDEX idx_documents_type          ON documents (type);
CREATE INDEX idx_documents_is_active     ON documents (is_active);
CREATE INDEX idx_documents_created_at    ON documents (created_at DESC);

-- Annotations
CREATE INDEX idx_annotations_document_id ON document_annotations (document_id);
CREATE INDEX idx_annotations_annotated_by ON document_annotations (annotated_by);

-- ── Seed: departments ─────────────────────────────────────────────────────────

INSERT INTO departments (name, code) VALUES
  ('Dashboard & Overview',  'DASHBOARD'),
  ('Projects & Tasks',      'PROJECTS'),
  ('Document Management',   'DOCUMENTS'),
  ('Reports & Approvals',   'REPORTS'),
  ('Help Desk Portal',      'HELPDESK'),
  ('Special Benches',       'BENCHES'),
  ('Part-Heards',           'PARTHEARDS'),
  ('Judges Requests',       'JUDGES'),
  ('Visa & Travel',         'VISA'),
  ('Protocol Support',      'PROTOCOL');

-- ── Seed: superadmin user (Registrar) ────────────────────────────────────────
-- Password/OTP set on first login; pj_number is placeholder — update before go-live

INSERT INTO users (full_name, email, pj_number, is_superadmin) VALUES
  ('Hon. Clara Otieno-Omondi', 'claraotieno23@gmail.com', '43244', true);