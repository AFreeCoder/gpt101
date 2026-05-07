\set ON_ERROR_STOP on

\echo '== duplicate upgrade_task groups =='
WITH duplicate_groups AS (
  SELECT redeem_code_id, count(*) AS task_count
  FROM upgrade_task
  GROUP BY redeem_code_id
  HAVING count(*) > 1
),
duplicate_tasks AS (
  SELECT t.*
  FROM upgrade_task t
  JOIN duplicate_groups g USING (redeem_code_id)
)
SELECT
  count(*) AS duplicate_card_count,
  coalesce(sum(task_count), 0) AS duplicate_task_rows
FROM duplicate_groups;

\echo '== duplicate task statuses =='
WITH duplicate_groups AS (
  SELECT redeem_code_id
  FROM upgrade_task
  GROUP BY redeem_code_id
  HAVING count(*) > 1
),
duplicate_tasks AS (
  SELECT t.*
  FROM upgrade_task t
  JOIN duplicate_groups g USING (redeem_code_id)
)
SELECT status, count(*) AS rows
FROM duplicate_tasks
GROUP BY status
ORDER BY rows DESC, status;

\echo '== group risk summary =='
WITH grouped AS (
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
      WHERE t.status NOT IN ('succeeded', 'failed', 'canceled')
    ) AS non_terminal_count,
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
  HAVING count(*) > 1
)
SELECT
  g.redeem_code_plain,
  g.task_count,
  g.succeeded_count,
  g.active_count,
  g.manual_required_count,
  g.non_terminal_count,
  g.non_success_cardkey_count,
  g.locked_cardkey_count,
  rc.status AS redeem_code_status,
  rc.used_by_task_id,
  g.first_created_at,
  g.last_created_at,
  CASE
    WHEN g.active_count <> 0 THEN 'skip: active task exists'
    WHEN g.manual_required_count <> 0 THEN 'skip: manualRequired task exists'
    WHEN g.succeeded_count > 1 THEN 'skip: multiple succeeded tasks'
    WHEN g.non_terminal_count <> 0 THEN 'skip: non terminal status exists'
    WHEN g.non_success_cardkey_count <> 0 THEN 'skip: non-success task has channel cardkey'
    WHEN g.locked_cardkey_count <> 0 THEN 'skip: channel cardkey still locked'
    ELSE 'eligible'
  END AS governance_action
FROM grouped g
LEFT JOIN redeem_code rc ON rc.id = g.redeem_code_id
ORDER BY g.last_created_at DESC;

\echo '== task detail in duplicate groups =='
WITH duplicate_groups AS (
  SELECT redeem_code_id
  FROM upgrade_task
  GROUP BY redeem_code_id
  HAVING count(*) > 1
)
SELECT
  t.redeem_code_plain,
  t.task_no,
  t.id AS task_id,
  t.status,
  t.chatgpt_email,
  t.success_channel_id,
  t.success_channel_cardkey_id,
  coalesce(t.metadata, '') LIKE '%"manualRequired":true%' AS manual_required,
  (
    SELECT count(*)
    FROM upgrade_task_attempt a
    WHERE a.task_id = t.id
  ) AS attempt_count,
  t.created_at,
  t.finished_at,
  t.last_error
FROM upgrade_task t
JOIN duplicate_groups g USING (redeem_code_id)
ORDER BY t.redeem_code_plain, t.created_at;
