\set ON_ERROR_STOP on

\if :{?apply}
\else
  \set apply false
\endif

\echo '== upgrade_task duplicate governance =='
\echo 'apply=' :apply

BEGIN;

LOCK TABLE upgrade_task IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE upgrade_task_attempt IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE redeem_code IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE channel_cardkey IN SHARE MODE;

CREATE TEMP TABLE _upgrade_task_duplicate_groups ON COMMIT DROP AS
SELECT
  t.redeem_code_id,
  min(t.redeem_code_plain) AS redeem_code_plain,
  count(*) AS task_count,
  count(*) FILTER (WHERE t.status = 'succeeded') AS succeeded_count,
  count(*) FILTER (WHERE t.status IN ('pending', 'running')) AS active_count,
  count(*) FILTER (
    WHERE coalesce(t.metadata, '') LIKE '%"manualRequired":true%'
  ) AS manual_required_count,
  count(*) FILTER (
    WHERE t.status IN ('succeeded', 'failed', 'canceled')
  ) AS terminal_count,
  count(*) FILTER (
    WHERE t.status <> 'succeeded'
      AND t.success_channel_cardkey_id IS NOT NULL
  ) AS non_success_cardkey_count,
  (
    SELECT count(*)
    FROM channel_cardkey ck
    JOIN upgrade_task tt ON tt.id = ck.locked_by_task_id
    WHERE tt.redeem_code_id = t.redeem_code_id
  ) AS locked_cardkey_count,
  min(t.created_at) AS first_created_at,
  max(t.created_at) AS last_created_at
FROM upgrade_task t
GROUP BY t.redeem_code_id
HAVING count(*) > 1;

CREATE TEMP TABLE _upgrade_task_duplicate_eligible_groups ON COMMIT DROP AS
SELECT *
FROM _upgrade_task_duplicate_groups
WHERE active_count = 0
  AND manual_required_count = 0
  AND succeeded_count <= 1
  AND terminal_count = task_count
  AND non_success_cardkey_count = 0
  AND locked_cardkey_count = 0;

CREATE TEMP TABLE _upgrade_task_duplicate_canonical ON COMMIT DROP AS
SELECT
  ranked.redeem_code_id,
  ranked.id AS canonical_task_id,
  ranked.task_no AS canonical_task_no
FROM (
  SELECT
    t.*,
    row_number() OVER (
      PARTITION BY t.redeem_code_id
      ORDER BY
        CASE WHEN t.status = 'succeeded' THEN 0 ELSE 1 END,
        coalesce(t.finished_at, t.updated_at, t.created_at) DESC,
        t.created_at DESC,
        t.id DESC
    ) AS row_no
  FROM upgrade_task t
  JOIN _upgrade_task_duplicate_eligible_groups g
    ON g.redeem_code_id = t.redeem_code_id
) ranked
WHERE ranked.row_no = 1;

CREATE TEMP TABLE _upgrade_task_duplicate_plan ON COMMIT DROP AS
SELECT
  t.redeem_code_id,
  t.redeem_code_plain,
  c.canonical_task_id,
  c.canonical_task_no,
  t.id AS obsolete_task_id,
  t.task_no AS obsolete_task_no,
  t.status AS obsolete_status,
  t.created_at AS obsolete_created_at,
  (
    SELECT count(*)
    FROM upgrade_task_attempt a
    WHERE a.task_id = t.id
  ) AS obsolete_attempt_count
FROM upgrade_task t
JOIN _upgrade_task_duplicate_canonical c
  ON c.redeem_code_id = t.redeem_code_id
WHERE t.id <> c.canonical_task_id;

CREATE TEMP TABLE _upgrade_task_duplicate_attempt_move ON COMMIT DROP AS
WITH canonical_max AS (
  SELECT
    p.canonical_task_id,
    coalesce(max(a.attempt_no), 0) AS max_attempt_no
  FROM _upgrade_task_duplicate_plan p
  LEFT JOIN upgrade_task_attempt a
    ON a.task_id = p.canonical_task_id
  GROUP BY p.canonical_task_id
),
ranked_attempts AS (
  SELECT
    a.id AS attempt_id,
    p.canonical_task_id,
    cm.max_attempt_no + row_number() OVER (
      PARTITION BY p.canonical_task_id
      ORDER BY
        p.obsolete_created_at,
        a.started_at,
        a.created_at,
        a.attempt_no,
        a.id
    ) AS new_attempt_no
  FROM upgrade_task_attempt a
  JOIN _upgrade_task_duplicate_plan p
    ON p.obsolete_task_id = a.task_id
  JOIN canonical_max cm
    ON cm.canonical_task_id = p.canonical_task_id
)
SELECT *
FROM ranked_attempts;

\echo '== planned eligible groups =='
SELECT
  count(DISTINCT redeem_code_id) AS eligible_card_count,
  count(*) AS obsolete_task_rows,
  coalesce(sum(obsolete_attempt_count), 0) AS attempts_to_move
FROM _upgrade_task_duplicate_plan;

\echo '== skipped duplicate groups =='
SELECT
  redeem_code_plain,
  task_count,
  succeeded_count,
  active_count,
  manual_required_count,
  terminal_count,
  non_success_cardkey_count,
  locked_cardkey_count
FROM _upgrade_task_duplicate_groups
WHERE redeem_code_id NOT IN (
  SELECT redeem_code_id FROM _upgrade_task_duplicate_eligible_groups
)
ORDER BY last_created_at DESC;

\echo '== obsolete task plan =='
SELECT
  redeem_code_plain,
  canonical_task_no,
  obsolete_task_no,
  obsolete_status,
  obsolete_attempt_count,
  obsolete_created_at
FROM _upgrade_task_duplicate_plan
ORDER BY redeem_code_plain, obsolete_created_at;

\echo '== moving attempts to canonical tasks =='
UPDATE upgrade_task_attempt AS a
SET
  task_id = m.canonical_task_id,
  attempt_no = m.new_attempt_no
FROM _upgrade_task_duplicate_attempt_move AS m
WHERE a.id = m.attempt_id;

DO $$
DECLARE
  remaining_count integer;
BEGIN
  SELECT count(*)
  INTO remaining_count
  FROM upgrade_task_attempt a
  JOIN _upgrade_task_duplicate_plan p
    ON p.obsolete_task_id = a.task_id;

  IF remaining_count <> 0 THEN
    RAISE EXCEPTION 'attempt rows still point to obsolete tasks: %', remaining_count;
  END IF;
END $$;

\echo '== repointing consumed redeem_code rows =='
UPDATE redeem_code AS rc
SET
  used_by_task_id = c.canonical_task_id,
  updated_at = now()
FROM _upgrade_task_duplicate_canonical AS c
WHERE rc.id = c.redeem_code_id
  AND rc.status = 'consumed'
  AND (
    rc.used_by_task_id IS NULL
    OR rc.used_by_task_id = ''
    OR rc.used_by_task_id IN (
      SELECT p.obsolete_task_id
      FROM _upgrade_task_duplicate_plan p
      WHERE p.redeem_code_id = rc.id
    )
  );

\echo '== deleting obsolete upgrade_task rows =='
DELETE FROM upgrade_task AS t
USING _upgrade_task_duplicate_plan AS p
WHERE t.id = p.obsolete_task_id;

\echo '== post-governance duplicate summary in transaction =='
WITH duplicate_groups AS (
  SELECT redeem_code_id, count(*) AS task_count
  FROM upgrade_task
  GROUP BY redeem_code_id
  HAVING count(*) > 1
)
SELECT
  count(*) AS duplicate_card_count,
  coalesce(sum(task_count), 0) AS duplicate_task_rows
FROM duplicate_groups;

\if :apply
  COMMIT;
  \echo 'APPLIED: duplicate upgrade_task governance committed.'
\else
  ROLLBACK;
  \echo 'DRY RUN: transaction rolled back. Re-run with -v apply=true to commit.'
\endif
