# R05 accessibility follow-up

R02 run 45535705365, build job 138941861509: two Playwright failures. Home heading 13px below existing 24px minimum; reduced-motion test queried `.game-tile` on Home after tiles moved to Games. Restore heading minimum without changing geometry test. Exercise actual Home mod cards and simulator choices, then actual Games tiles, checking zero transition and no decorative hover displacement. No security or workflow changes. Validation pending on cumulative R05. Earlier failed runs remain historical failures; do not treat as PASS.
