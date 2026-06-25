-- Course system schema. Adapted from storyflow-canvas-enhanced:
-- collapses 20260124/0125/0126/0127/0214/0219 + a rewritten
-- product_course_assignments into one migration. The original
-- subscription_plans FK and the StoryFlow seed inserts are dropped.

-- ============================================
-- COURSES
-- ============================================
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  short_description TEXT,
  thumbnail_url TEXT,
  preview_video_url TEXT,
  instructor_name TEXT DEFAULT 'Course Team',
  instructor_avatar TEXT,
  lesson_count INTEGER DEFAULT 0,
  total_duration_minutes INTEGER DEFAULT 0,
  price_cents INTEGER DEFAULT 0,
  stripe_price_id TEXT,
  is_free BOOLEAN DEFAULT false,
  requires_subscription BOOLEAN DEFAULT false,
  required_plan_id TEXT,
  sort_order INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  badge_text TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LESSONS
-- ============================================
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_duration_seconds INTEGER DEFAULT 0,
  content_markdown TEXT,
  resources JSONB DEFAULT '[]'::jsonb,
  chapter_number INTEGER DEFAULT 1,
  lesson_number INTEGER NOT NULL,
  is_preview BOOLEAN DEFAULT false,
  thumbnail_url TEXT,
  status TEXT DEFAULT 'published' CHECK (status IN ('draft', 'published', 'private')),
  ctas JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN lessons.thumbnail_url IS 'URL to lesson thumbnail image, used as video poster and in lesson lists';
COMMENT ON COLUMN lessons.status IS 'draft (admin only), published (visible), private (hidden but accessible via direct link)';
COMMENT ON COLUMN lessons.ctas IS 'Array of CTA overlay configs shown during video playback (see types/courses.ts)';

-- ============================================
-- USER COURSE ACCESS
-- ============================================
CREATE TABLE IF NOT EXISTS user_course_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE NOT NULL,
  access_type TEXT NOT NULL DEFAULT 'purchase' CHECK (access_type IN ('purchase', 'subscription', 'license', 'gift', 'admin')),
  stripe_payment_id TEXT,
  amount_cents INTEGER,
  license_key TEXT,
  granted_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, course_id)
);

-- ============================================
-- USER LESSON PROGRESS
-- ============================================
CREATE TABLE IF NOT EXISTS user_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  progress_seconds INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  last_watched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

-- ============================================
-- COURSE LICENSE KEYS
-- ============================================
CREATE TABLE IF NOT EXISTS course_license_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  license_key TEXT UNIQUE NOT NULL,
  course_id TEXT REFERENCES courses(id) ON DELETE CASCADE,
  is_all_access BOOLEAN DEFAULT false,
  max_activations INTEGER DEFAULT 1,
  current_activations INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LESSON TRANSCRIPTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_transcriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_text TEXT NOT NULL,
  segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  language TEXT DEFAULT 'en',
  duration_seconds FLOAT,
  word_count INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  transcription_model TEXT DEFAULT 'whisper-1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- LESSON GENERATED CONTENT (AI outputs)
-- ============================================
CREATE TABLE IF NOT EXISTS lesson_generated_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('description', 'sop', 'key_points', 'quiz', 'summary', 'longform', 'custom', 'course_lesson')),
  content TEXT NOT NULL,
  prompt_used TEXT,
  model_used TEXT DEFAULT 'gemini-2.5-flash',
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(lesson_id, content_type, version)
);

-- ============================================
-- PRODUCT -> COURSE ASSIGNMENTS (Stripe bridge)
-- Adapted: clean FK to this app's products table.
-- ============================================
CREATE TABLE IF NOT EXISTS product_course_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id, course_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_order ON lessons(course_id, chapter_number, lesson_number);
CREATE INDEX IF NOT EXISTS idx_lessons_status ON lessons(status);
CREATE INDEX IF NOT EXISTS idx_user_course_access_user ON user_course_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_course_access_course ON user_course_access(course_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_user ON user_lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_user_lesson_progress_lesson ON user_lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_course_license_keys_key ON course_license_keys(license_key);
CREATE INDEX IF NOT EXISTS idx_lesson_transcriptions_lesson ON lesson_transcriptions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_transcriptions_status ON lesson_transcriptions(status);
CREATE INDEX IF NOT EXISTS idx_lesson_generated_content_lesson ON lesson_generated_content(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_generated_content_type ON lesson_generated_content(lesson_id, content_type);
CREATE INDEX IF NOT EXISTS idx_lesson_transcriptions_fulltext ON lesson_transcriptions USING gin(to_tsvector('english', full_text));
CREATE INDEX IF NOT EXISTS idx_product_course_assignments_product ON product_course_assignments(product_id);
CREATE INDEX IF NOT EXISTS idx_product_course_assignments_course ON product_course_assignments(course_id);

-- ============================================
-- RLS
-- ============================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_course_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_transcriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_generated_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_course_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read published courses" ON courses FOR SELECT USING (is_published = true);
CREATE POLICY "Public read published lessons of published courses" ON lessons FOR SELECT
  USING (status = 'published' AND EXISTS (
    SELECT 1 FROM courses WHERE courses.id = lessons.course_id AND courses.is_published = true
  ));
CREATE POLICY "Users read own course access" ON user_course_access FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users read own lesson progress" ON user_lesson_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users upsert own lesson progress" ON user_lesson_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own lesson progress" ON user_lesson_progress FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Public read lesson transcriptions" ON lesson_transcriptions FOR SELECT USING (true);
CREATE POLICY "Public read lesson generated content" ON lesson_generated_content FOR SELECT USING (true);
CREATE POLICY "Authenticated read product_course_assignments" ON product_course_assignments FOR SELECT USING (true);

-- Service role bypasses RLS but explicit policies kept for clarity
CREATE POLICY "Service role full access courses" ON courses FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access lessons" ON lessons FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access user_course_access" ON user_course_access FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access user_lesson_progress" ON user_lesson_progress FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access course_license_keys" ON course_license_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access lesson_transcriptions" ON lesson_transcriptions FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access lesson_generated_content" ON lesson_generated_content FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access product_course_assignments" ON product_course_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);
