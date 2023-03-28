DO
$$
    DECLARE
        previous_version CONSTANT text := 'v1.10.0';
        next_version     CONSTANT text := 'v1.11.0';
    BEGIN
        IF (SELECT openreplay_version()) = previous_version THEN
            raise notice 'valid previous DB version';
        ELSEIF (SELECT openreplay_version()) = next_version THEN
            raise notice 'new version detected, nothing to do';
        ELSE
            RAISE EXCEPTION 'upgrade to % failed, invalid previous version, expected %, got %', next_version,previous_version,(SELECT openreplay_version());
        END IF;
    END ;
$$
LANGUAGE plpgsql;

BEGIN;
CREATE OR REPLACE FUNCTION openreplay_version()
    RETURNS text AS
$$
SELECT 'v1.11.0'
$$ LANGUAGE sql IMMUTABLE;

ALTER TYPE issue_type ADD VALUE IF NOT EXISTS 'mouse_thrashing';

LOCK TABLE ONLY events.inputs IN ACCESS EXCLUSIVE MODE;
ALTER TABLE events.inputs
    ADD COLUMN duration   integer NULL,
    ADD COLUMN hesitation integer NULL;

LOCK TABLE ONLY events.clicks IN ACCESS EXCLUSIVE MODE;
ALTER TABLE events.clicks
    ADD COLUMN hesitation integer NULL;

LOCK TABLE ONLY public.projects IN ACCESS EXCLUSIVE MODE;
ALTER TABLE public.projects
    ALTER COLUMN gdpr SET DEFAULT '{
      "maskEmails": true,
      "sampleRate": 33,
      "maskNumbers": false,
      "defaultInputMode": "obscured"
    }'::jsonb;

COMMIT;