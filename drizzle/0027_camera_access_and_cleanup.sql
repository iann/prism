-- Camera event ingress/display grants and durable stream cleanup ownership.
-- Raw grant tokens are never persisted; the application stores SHA-256 digests.
CREATE TABLE IF NOT EXISTS camera_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  kind varchar(20) NOT NULL,
  token_hash varchar(64) NOT NULL,
  camera_ids jsonb DEFAULT '[]'::jsonb NOT NULL,
  display_id varchar(100),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  expires_at timestamp NOT NULL,
  revoked_at timestamp,
  last_used_at timestamp,
  created_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT camera_access_grants_kind_check CHECK (kind IN ('event-ingress', 'display'))
);
CREATE UNIQUE INDEX IF NOT EXISTS camera_access_grants_token_hash_idx
  ON camera_access_grants USING btree (token_hash);
CREATE INDEX IF NOT EXISTS camera_access_grants_display_idx
  ON camera_access_grants USING btree (display_id);
CREATE INDEX IF NOT EXISTS camera_access_grants_expires_idx
  ON camera_access_grants USING btree (expires_at);

CREATE TABLE IF NOT EXISTS camera_stream_cleanup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  camera_id varchar(100) NOT NULL,
  generation integer NOT NULL,
  state varchar(20) DEFAULT 'pending' NOT NULL,
  hard_deadline timestamp NOT NULL,
  mapping jsonb NOT NULL,
  last_error varchar(500),
  created_at timestamp DEFAULT now() NOT NULL,
  updated_at timestamp DEFAULT now() NOT NULL,
  CONSTRAINT camera_stream_cleanup_state_check
    CHECK (state IN ('pending', 'active', 'stopping', 'failed', 'released'))
);
CREATE INDEX IF NOT EXISTS camera_stream_cleanup_camera_state_idx
  ON camera_stream_cleanup USING btree (camera_id, state);
CREATE INDEX IF NOT EXISTS camera_stream_cleanup_deadline_idx
  ON camera_stream_cleanup USING btree (hard_deadline);
