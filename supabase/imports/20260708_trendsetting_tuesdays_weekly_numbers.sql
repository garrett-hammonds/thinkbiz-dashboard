-- One-time data import: "Weekly Think.Biz Numbers Report" → success tracking
--
-- Source: Google Form export "Weekly Think.Biz Numbers Report (Responses)",
-- covering the Tuesday 9:30am club meetings of 2026-04-14 through 2026-05-19.
--
-- Target club: Trendsetting Tuesdays / Warr Acres - Tuesday 9:30am
--   (slug chapter-1-okc, id 421e996b-b03e-4820-a898-1566576f62b8).
-- The other Tuesday 9:30am club (Traction Tuesdays, chapter-5-okc) was ruled
-- out: none of the CSV names are on its roster.
--
-- Mapping (mirrors app/actions/submitLog.ts, the app's own write path):
--   * one CSV row -> one weekly_logs row
--       "Number of 1-2-1 Meetings This Week"   -> one_on_ones_had
--       "Number of Visitors Brought This Week" -> visitors_brought
--       "Number of Referrals Passed This Week" -> referrals_given
--       week_ending = the Tuesday meeting date (matches this club's existing
--       convention, where recorded weeks land on DOW=2).
--   * TYFCB ("Total $ Amount of Closed Business This Week"), when > 0, -> one
--       closed_business_thanks row (thanked_member_id NULL, i.e. the form's
--       "External / visitor" option, since the form does not capture whom the
--       revenue is attributed to).
--
-- Name normalization applied against the roster:
--   "Chris hopkins" -> Chris Hopkins;  "Lauren Hill"/"lauren hill" -> the
--   member stored as "Lauren Hlil" (dry spelling in the DB);  "Ben Shrewsbury"
--   -> Benjamin Shrewsbury;  "Mike Mcdaniel" -> Michael McDaniel.
-- Money normalization: "$500", "275", "$5,000.00", "$99" -> numeric; blanks -> 0.
-- Lauren Hill submitted twice for the week of 2026-05-05; per the app's own
-- behavior the first submission's activity counts stand (4 one-on-ones, 1
-- referral) and BOTH closed-business amounts ($231 and $2,100) are recorded.
--
-- SKIPPED (not on the Trendsetting Tuesdays roster; reported back to the owner
-- rather than invented or moved):
--   * Josiah Burns  (5 weeks) — no member record in any club
--   * Heath Reyes   (2 weeks) — no member record in any club
--   * David Yonko / "David y" / "David" (3 weeks) — member exists, but in the
--       Norman club (chapter-2-norman)
--   * Chase Busick  (1 week)  — member exists, but in Winning Wednesdays
--       (chapter-3-warr-acres), inactive
--
-- Idempotent: weekly_logs upserts on the (member_id, week_ending) unique key
-- and does nothing on conflict; closed_business_thanks is guarded by NOT EXISTS
-- on (weekly_log_id, thanking_member_id, revenue_amount). Safe to re-run.

BEGIN;

WITH club AS (
  SELECT '421e996b-b03e-4820-a898-1566576f62b8'::uuid AS id
),
-- (member_id, week_ending, one_on_ones_had, visitors_brought, referrals_given)
rows(member_id, week_ending, ooo, visitors, referrals) AS (
  VALUES
    -- 2026-04-14
    ('948195f5-c34d-4188-96b6-6e85ba2b1e48'::uuid, DATE '2026-04-14', 0, 0, 0), -- Nolan Rogers
    ('75d657c4-9c52-4ea5-902f-9071a039f008'::uuid, DATE '2026-04-14', 1, 0, 1), -- Catherine Hair
    ('cef14d38-0144-4f1b-802c-0b6d8e2fd9b2'::uuid, DATE '2026-04-14', 1, 0, 0), -- Chris Hopkins
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-04-14', 1, 0, 0), -- Bret Woods
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-04-14', 0, 0, 0), -- Jordan Edwards
    ('c4293c2a-d10c-40fc-9ca7-ca3ed0d3574d'::uuid, DATE '2026-04-14', 0, 0, 1), -- Riley Banks
    -- 2026-04-21
    ('948195f5-c34d-4188-96b6-6e85ba2b1e48'::uuid, DATE '2026-04-21', 0, 0, 0), -- Nolan Rogers
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-04-21', 0, 0, 1), -- Jordan Edwards
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-04-21', 0, 0, 1), -- Lauren Hill
    ('cef14d38-0144-4f1b-802c-0b6d8e2fd9b2'::uuid, DATE '2026-04-21', 1, 0, 0), -- Chris Hopkins
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-04-21', 0, 0, 0), -- Bret Woods
    ('815c4b3a-5511-4920-8644-ec91b572ce7f'::uuid, DATE '2026-04-21', 0, 0, 1), -- Ben Shrewsbury
    -- 2026-04-28
    ('736663a0-067f-42e4-b0f1-512f090f0503'::uuid, DATE '2026-04-28', 0, 0, 0), -- Cameron Wooley
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-04-28', 0, 0, 0), -- Jordan Edwards
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-04-28', 1, 0, 1), -- Lauren Hill
    ('948195f5-c34d-4188-96b6-6e85ba2b1e48'::uuid, DATE '2026-04-28', 1, 0, 1), -- Nolan Rogers
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-04-28', 1, 0, 0), -- Bret Woods
    ('ae79b2f5-4061-4f52-96b2-6102b1fbacf1'::uuid, DATE '2026-04-28', 1, 0, 1), -- Michael McDaniel
    ('dc7b7092-7619-4ff3-bfd2-36addcf42737'::uuid, DATE '2026-04-28', 1, 0, 1), -- Mark Lasater
    -- 2026-05-05  (Lauren Hill: two submissions merged; first submission's counts)
    ('736663a0-067f-42e4-b0f1-512f090f0503'::uuid, DATE '2026-05-05', 0, 0, 0), -- Cameron Wooley
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-05-05', 0, 0, 0), -- Jordan Edwards
    ('75d657c4-9c52-4ea5-902f-9071a039f008'::uuid, DATE '2026-05-05', 3, 0, 1), -- Catherine Hair
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-05-05', 4, 0, 1), -- Lauren Hill
    ('cef14d38-0144-4f1b-802c-0b6d8e2fd9b2'::uuid, DATE '2026-05-05', 2, 0, 0), -- Chris Hopkins
    ('c4293c2a-d10c-40fc-9ca7-ca3ed0d3574d'::uuid, DATE '2026-05-05', 0, 0, 4), -- Riley Banks
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-05-05', 3, 0, 0), -- Bret Woods
    -- 2026-05-12
    ('75d657c4-9c52-4ea5-902f-9071a039f008'::uuid, DATE '2026-05-12', 0, 0, 1), -- Catherine Hair
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-05-12', 0, 0, 0), -- Lauren Hill
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-05-12', 1, 0, 1), -- Jordan Edwards
    ('815c4b3a-5511-4920-8644-ec91b572ce7f'::uuid, DATE '2026-05-12', 0, 1, 0), -- Ben Shrewsbury
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-05-12', 2, 0, 0), -- Bret Woods
    ('cef14d38-0144-4f1b-802c-0b6d8e2fd9b2'::uuid, DATE '2026-05-12', 1, 0, 0), -- Chris Hopkins
    ('c4293c2a-d10c-40fc-9ca7-ca3ed0d3574d'::uuid, DATE '2026-05-12', 1, 0, 0), -- Riley Banks
    -- 2026-05-19
    ('75d657c4-9c52-4ea5-902f-9071a039f008'::uuid, DATE '2026-05-19', 0, 0, 0), -- Catherine Hair
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-05-19', 1, 0, 1), -- Jordan Edwards
    ('815c4b3a-5511-4920-8644-ec91b572ce7f'::uuid, DATE '2026-05-19', 0, 0, 0), -- Ben Shrewsbury
    ('c4293c2a-d10c-40fc-9ca7-ca3ed0d3574d'::uuid, DATE '2026-05-19', 1, 0, 1), -- Riley Banks
    ('ae79b2f5-4061-4f52-96b2-6102b1fbacf1'::uuid, DATE '2026-05-19', 1, 0, 1)  -- Mike McDaniel
)
INSERT INTO weekly_logs (member_id, club_id, week_ending, one_on_ones_had, visitors_brought, referrals_given)
SELECT r.member_id, club.id, r.week_ending, r.ooo, r.visitors, r.referrals
FROM rows r CROSS JOIN club
ON CONFLICT (member_id, week_ending) DO NOTHING;

-- Closed business ("thank you for closed business"), amount > 0 only.
-- (member_id, week_ending, revenue_amount) — attached to that week's log.
WITH thanks(member_id, week_ending, amount) AS (
  VALUES
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-04-21', 2583.00), -- Lauren Hill
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-04-28',  500.00), -- Bret Woods
    ('ae79b2f5-4061-4f52-96b2-6102b1fbacf1'::uuid, DATE '2026-04-28',  500.00), -- Michael McDaniel
    ('dc7b7092-7619-4ff3-bfd2-36addcf42737'::uuid, DATE '2026-04-28',  275.00), -- Mark Lasater
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-05-05',  231.00), -- Lauren Hill (submission 1)
    ('cef14d38-0144-4f1b-802c-0b6d8e2fd9b2'::uuid, DATE '2026-05-05', 7200.00), -- Chris Hopkins
    ('c63b3d9e-dc5f-4fee-b602-8b43443a34a4'::uuid, DATE '2026-05-05', 2100.00), -- Lauren Hill (submission 2)
    ('16bb5737-4886-4afb-814a-444b0ba3499b'::uuid, DATE '2026-05-12',   99.00), -- Jordan Edwards
    ('4a138b98-e04c-42d6-b4d0-ca3ff3be431a'::uuid, DATE '2026-05-12', 5000.00), -- Bret Woods
    ('ae79b2f5-4061-4f52-96b2-6102b1fbacf1'::uuid, DATE '2026-05-19',  525.00)  -- Mike McDaniel
)
INSERT INTO closed_business_thanks (weekly_log_id, thanking_member_id, thanked_member_id, revenue_amount)
SELECT wl.id, t.member_id, NULL, t.amount
FROM thanks t
JOIN weekly_logs wl
  ON wl.member_id = t.member_id
 AND wl.week_ending = t.week_ending
 AND wl.club_id = '421e996b-b03e-4820-a898-1566576f62b8'::uuid
WHERE NOT EXISTS (
  SELECT 1 FROM closed_business_thanks x
  WHERE x.weekly_log_id = wl.id
    AND x.thanking_member_id = t.member_id
    AND x.revenue_amount = t.amount
);

COMMIT;
