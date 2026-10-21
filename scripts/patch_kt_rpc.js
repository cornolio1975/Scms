const { Client } = require('pg');

async function patch() {
  const client = new Client({
    host: 'db.wbwnnjfmfcpzjfbsyrvq.supabase.co',
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: 'Bundar@3575',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const sql = `
  CREATE OR REPLACE FUNCTION scms_upsert_participant(
    p_scms_id VARCHAR,
    p_full_name VARCHAR,
    p_gender VARCHAR,
    p_dob DATE,
    p_passport_ic VARCHAR,
    p_email VARCHAR,
    p_phone VARCHAR,
    p_weight DECIMAL,
    p_height DECIMAL,
    p_club_id UUID DEFAULT NULL,
    p_emergency_contact_name VARCHAR DEFAULT NULL,
    p_emergency_contact_phone VARCHAR DEFAULT NULL,
    p_nationality_code VARCHAR DEFAULT NULL
  ) RETURNS UUID AS $$
  DECLARE
    v_karate_id UUID;
    v_reg_no VARCHAR;
    v_clean_id VARCHAR;
  BEGIN
    -- 1. Try to find existing mapping
    SELECT karate_participant_id INTO v_karate_id
    FROM scms_participant_mappings
    WHERE source_system = 'SCMS' AND scms_participant_id = p_scms_id;

    IF v_karate_id IS NOT NULL THEN
      -- Update existing participant (only SCMS-owned fields; preserves all categories, bouts, etc.)
      UPDATE participants SET
        full_name = p_full_name,
        gender = p_gender,
        dob = p_dob,
        passport_ic = p_passport_ic,
        email = p_email,
        phone = p_phone,
        weight = p_weight,
        height = p_height,
        club_id = COALESCE(p_club_id, club_id),
        emergency_contact_name = COALESCE(p_emergency_contact_name, emergency_contact_name),
        emergency_contact_phone = COALESCE(p_emergency_contact_phone, emergency_contact_phone),
        nationality_code = COALESCE(p_nationality_code, nationality_code)
      WHERE id = v_karate_id;
      
      UPDATE scms_participant_mappings SET
        last_synced_at = NOW(),
        sync_status = 'synced'
      WHERE source_system = 'SCMS' AND scms_participant_id = p_scms_id;
      
      RETURN v_karate_id;
    END IF;

    -- 2. Create new participant
    -- Compact ID to guarantee registration_no fits within VARCHAR(50)
    v_clean_id := replace(p_scms_id, '-', '');
    IF length(v_clean_id) > 16 THEN
      v_clean_id := substr(v_clean_id, 1, 16);
    END IF;
    v_reg_no := 'SCMS-' || v_clean_id || '-' || (floor(extract(epoch from now()))::bigint % 100000000);

    INSERT INTO participants (
      registration_no,
      full_name,
      gender,
      dob,
      passport_ic,
      email,
      phone,
      weight,
      height,
      club_id,
      emergency_contact_name,
      emergency_contact_phone,
      nationality_code,
      status
    ) VALUES (
      v_reg_no,
      p_full_name,
      p_gender,
      p_dob,
      p_passport_ic,
      p_email,
      p_phone,
      p_weight,
      p_height,
      p_club_id,
      p_emergency_contact_name,
      p_emergency_contact_phone,
      p_nationality_code,
      'Confirmed'
    ) RETURNING id INTO v_karate_id;

    -- 3. Create mapping
    INSERT INTO scms_participant_mappings (
      scms_participant_id,
      karate_participant_id,
      source_system,
      sync_status
    ) VALUES (
      p_scms_id,
      v_karate_id,
      'SCMS',
      'synced'
    );

    RETURN v_karate_id;
  EXCEPTION
    WHEN unique_violation THEN
      -- If concurrent request created mapping, catch and return existing
      SELECT karate_participant_id INTO v_karate_id
      FROM scms_participant_mappings
      WHERE source_system = 'SCMS' AND scms_participant_id = p_scms_id;
      
      IF v_karate_id IS NOT NULL THEN
        RETURN v_karate_id;
      ELSE
        RAISE EXCEPTION 'Unique violation occurred but mapping not found';
      END IF;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  await client.query(sql);
  console.log('Successfully updated scms_upsert_participant function in KarateTech DB!');
  await client.end();
}

patch().catch(console.error);
