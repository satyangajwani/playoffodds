-- Reference-data seed: 10 teams + remaining IPL 2026 league fixtures + 4 playoff stubs.
-- Forward-only. Idempotent via INSERT OR REPLACE so re-running on an existing DB is safe.

-- Teams
INSERT OR REPLACE INTO teams (code, full_name, short_name, primary_color_hex, kalshi_code, poly_short_codes) VALUES
  ('MI',   'Mumbai Indians',              'Mumbai',     '#004BA0', 'MI',   '["mum","mi"]'),
  ('CSK',  'Chennai Super Kings',         'Chennai',    '#FBBF24', 'CSK',  '["che","csk"]'),
  ('RCB',  'Royal Challengers Bengaluru', 'Bengaluru',  '#DA1818', 'RCB',  '["ben","rcb","blr"]'),
  ('KKR',  'Kolkata Knight Riders',       'Kolkata',    '#3A225D', 'KKR',  '["kol","kkr"]'),
  ('DC',   'Delhi Capitals',              'Delhi',      '#17449B', 'DC',   '["del","dc"]'),
  ('PBKS', 'Punjab Kings',                'Punjab',     '#DD1F2D', 'PBKS', '["pun","pbks","pk"]'),
  ('RR',   'Rajasthan Royals',            'Rajasthan',  '#EA1A85', 'RR',   '["raj","rr"]'),
  ('SRH',  'Sunrisers Hyderabad',         'Hyderabad',  '#FF822A', 'SRH',  '["hyd","sun","srh"]'),
  ('GT',   'Gujarat Titans',              'Gujarat',    '#1C2C4D', 'GT',   '["guj","gt"]'),
  ('LSG',  'Lucknow Super Giants',        'Lucknow',    '#00B5D8', 'LSG',  '["luc","lsg"]');

-- Fixtures: 8 remaining league games (per Kalshi KXIPLGAME on 2026-05-18) + 4 playoff stubs.
INSERT OR REPLACE INTO fixtures (match_number, date_utc, venue, team_a_code, team_b_code, status, stage) VALUES
  (63, '2026-05-18T14:00:00Z', 'Chepauk, Chennai',          'CSK',  'SRH',  'scheduled', 'league'),
  (64, '2026-05-19T14:00:00Z', 'Sawai Mansingh, Jaipur',    'RR',   'LSG',  'scheduled', 'league'),
  (65, '2026-05-20T14:00:00Z', 'Eden Gardens, Kolkata',     'KKR',  'MI',   'scheduled', 'league'),
  (66, '2026-05-21T14:00:00Z', 'Chepauk, Chennai',          'CSK',  'GT',   'scheduled', 'league'),
  (67, '2026-05-22T14:00:00Z', 'Chinnaswamy, Bengaluru',    'RCB',  'SRH',  'scheduled', 'league'),
  (68, '2026-05-23T14:00:00Z', 'Mullanpur, Mohali',         'PBKS', 'LSG',  'scheduled', 'league'),
  (69, '2026-05-24T10:00:00Z', 'Kotla, Delhi',              'DC',   'KKR',  'scheduled', 'league'),
  (70, '2026-05-24T14:00:00Z', 'Wankhede, Mumbai',          'MI',   'RR',   'scheduled', 'league'),
  (71, '2026-05-26T14:00:00Z', 'TBD',                        NULL,   NULL,   'scheduled', 'qualifier_1'),
  (72, '2026-05-27T14:00:00Z', 'TBD',                        NULL,   NULL,   'scheduled', 'eliminator'),
  (73, '2026-05-29T14:00:00Z', 'TBD',                        NULL,   NULL,   'scheduled', 'qualifier_2'),
  (74, '2026-05-31T14:00:00Z', 'Narendra Modi Stadium, Ahmedabad', NULL, NULL, 'scheduled', 'final');
