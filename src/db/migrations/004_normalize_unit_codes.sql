WITH normalized AS (
    SELECT
        id,
        CASE
            WHEN code ~ '^[0-9]+$' THEN COALESCE(NULLIF(LTRIM(code, '0'), ''), '0')
            ELSE UPPER(TRIM(code))
        END AS normalized_code
    FROM units
),
eligible AS (
    SELECT n.id, n.normalized_code
    FROM normalized n
    JOIN units u ON u.id = n.id
    WHERE u.code <> n.normalized_code
      AND NOT EXISTS (
        SELECT 1
        FROM units u2
        WHERE u2.id <> n.id
          AND u2.code = n.normalized_code
      )
)
UPDATE units u
SET code = e.normalized_code,
    name = CASE
        WHEN u.name ~ '^[0-9]+$' THEN e.normalized_code
        ELSE u.name
    END,
    updated_at = NOW()
FROM eligible e
WHERE u.id = e.id;
