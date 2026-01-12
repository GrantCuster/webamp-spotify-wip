-- Create skins table
CREATE TABLE IF NOT EXISTS skins (
  -- Primary key (using SERIAL for auto-increment in PostgreSQL)
  id SERIAL PRIMARY KEY,

  -- Existing fields (from manifest.json)
  md5 TEXT UNIQUE NOT NULL,
  filename TEXT NOT NULL,
  filepath TEXT NOT NULL,

  -- User requested fields
  liked BOOLEAN DEFAULT FALSE,
  flagged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Additional metadata from API
  nsfw BOOLEAN DEFAULT FALSE,
  tweeted BOOLEAN DEFAULT FALSE,
  average_color TEXT,
  screenshot_url TEXT,
  museum_url TEXT,

  -- Usage tracking
  downloaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,
  use_count INTEGER DEFAULT 0,

  -- Personal organization
  tags JSONB DEFAULT '[]'::JSONB,
  notes TEXT,
  rating INTEGER CHECK(rating >= 0 AND rating <= 5),

  -- File metadata
  file_size BIGINT,

  -- Future S3 fields (for when you migrate)
  s3_key TEXT,
  s3_uploaded_at TIMESTAMP WITH TIME ZONE,

  -- Audit fields
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_skins_md5 ON skins(md5);
CREATE INDEX IF NOT EXISTS idx_skins_liked ON skins(liked) WHERE liked = TRUE;
CREATE INDEX IF NOT EXISTS idx_skins_flagged ON skins(flagged) WHERE flagged = TRUE;
CREATE INDEX IF NOT EXISTS idx_skins_tweeted ON skins(tweeted);
CREATE INDEX IF NOT EXISTS idx_skins_last_used_at ON skins(last_used_at);
CREATE INDEX IF NOT EXISTS idx_skins_rating ON skins(rating) WHERE rating IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_skins_tags ON skins USING GIN(tags);

-- Trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_skins_updated_at ON skins;
CREATE TRIGGER update_skins_updated_at
  BEFORE UPDATE ON skins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
