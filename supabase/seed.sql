-- Local-development seed for the course subsystem. Idempotent —
-- safe to re-run after `supabase db reset`. No production secrets.

-- ============================================
-- COURSES
-- ============================================
INSERT INTO courses (
  id, title, short_description, description, instructor_name,
  price_cents, is_free, is_published, is_featured, badge_text, sort_order
) VALUES
  (
    'foundations-mindshift',
    'Foundations of the Millionaire Mindshift',
    'A free primer on the mental shifts behind every high-leverage business.',
    'Walk through the core mindset moves the rest of the catalog builds on. Free to preview, no card required.',
    'The Mindshift Team',
    0, true, true, true, 'Free',
    10
  ),
  (
    'stripe-supabase-mastery',
    'Stripe + Supabase Mastery',
    'A focused deep-dive on production-grade billing wiring.',
    'Webhook fan-out, idempotency, customer record sync — what every SaaS engineer wishes they had documented.',
    'The Mindshift Team',
    9900, false, true, false, NULL,
    20
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- LESSONS (stable UUIDs so re-runs are idempotent)
-- ============================================
INSERT INTO lessons (
  id, course_id, title, description, video_url,
  video_duration_seconds, chapter_number, lesson_number, is_preview,
  content_markdown, resources, ctas, status
) VALUES
  (
    '00000000-0000-4000-a000-000000000001',
    'foundations-mindshift',
    'Welcome + the four shifts',
    'How to use this course and the four mental shifts you will internalize.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    120, 1, 1, true,
    'Watch the welcome, then move on to lesson 2.',
    '[{"name": "Workbook PDF", "url": "https://example.com/workbook.pdf", "type": "pdf"}, {"name": "Companion slides", "url": "https://example.com/slides", "type": "link"}]'::jsonb,
    '[{"id": "cta_seed_offer", "title": "Unlock the full bundle", "subtitle": "Lifetime access + all updates", "buttonText": "See pricing", "link": "/#pricing", "linkTarget": "_self", "type": "offer", "style": "gradient", "position": "bottom-right", "showAfterSeconds": 8, "autoHideSeconds": 25, "dismissable": true, "showOnce": false}]'::jsonb,
    'published'
  ),
  (
    '00000000-0000-4000-a000-000000000002',
    'foundations-mindshift',
    'Shift 1: Owner vs. operator',
    'Why the operator trap stalls every solo founder and how to climb out of it.',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    180, 1, 2, false,
    NULL,
    '[]'::jsonb, '[]'::jsonb, 'published'
  ),
  (
    '00000000-0000-4000-a000-000000000003',
    'foundations-mindshift',
    'Shift 2: Leverage stacks',
    'Compounding leverage across people, capital, code, and brand.',
    NULL,
    240, 2, 1, false,
    'Reflection prompt: list one decision you would make differently if you committed to a 10x lever.',
    '[]'::jsonb, '[]'::jsonb, 'published'
  ),
  (
    '00000000-0000-4000-b000-000000000001',
    'stripe-supabase-mastery',
    'Webhooks without duplicates',
    'Designing an idempotent webhook handler using event ids and a deduped insert.',
    NULL,
    420, 1, 1, false,
    'See `src/app/api/webhooks/route.ts` in this repo for the live reference implementation.',
    '[{"name": "Reference: Stripe webhook handler", "url": "https://stripe.com/docs/webhooks", "type": "link"}]'::jsonb,
    '[]'::jsonb, 'published'
  ),
  (
    '00000000-0000-4000-b000-000000000002',
    'stripe-supabase-mastery',
    'Customer + subscription sync',
    'Mirroring Stripe state into Supabase without race conditions.',
    NULL,
    360, 1, 2, false,
    NULL,
    '[]'::jsonb, '[]'::jsonb, 'published'
  )
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- COURSE LICENSE KEYS (one demo key for the paid course)
-- ============================================
INSERT INTO course_license_keys (
  license_key, course_id, is_all_access, max_activations,
  is_active, notes
) VALUES
  ('DEMO-STRIPE-SUPABASE-2026', 'stripe-supabase-mastery', false, 25, true,
   'Local development demo key. Redeem from the /account license activation flow.')
ON CONFLICT (license_key) DO NOTHING;
