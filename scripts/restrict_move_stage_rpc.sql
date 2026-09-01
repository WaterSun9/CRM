-- ============================================================================
-- move_stage: enforce the admin-only restriction in the DATABASE.
--
-- PROVEN 2026-09-01 by calling the function as each of the 8 roles with a
-- non-existent customer id: ALL EIGHT reached the function body ("Customer not
-- found"), i.e. every authenticated user may call it.
--
-- The function is SECURITY DEFINER, so it runs as its owner and RLS on `admin`
-- does not apply. Any signed-in user - a Vendor, a Dealer, a Stamp maker - can
-- run this from the browser console:
--
--     supabase.rpc('move_stage', { p_customer_id: '<any id>',
--                                  p_new_stage: 'COMPLETED',
--                                  p_old_stage: 'LEADS', p_remark: '' })
--
-- and move ANY customer to ANY stage, including COMPLETED (which freezes the
-- record) and LOST PROJECT. The anon key ships in the JS bundle.
--
-- The only thing restricting this today is a render guard in the UI:
-- CustomerCard.jsx:111 shows the stage dropdown `{isAdmin && (`. That is the
-- sole caller (Dashboard.jsx:1219 -> handleMoveStage -> this RPC), so limiting
-- the function to admins matches exactly what the app already does.
--
-- Same class as the profiles privilege escalation closed in
-- fix_profiles_privilege_escalation.sql: the UI was the only gate.
--
-- Everything below the guard is the CURRENT function body, unchanged.
-- ============================================================================

create or replace function public.move_stage(
    p_customer_id uuid,
    p_new_stage   text,
    p_old_stage   text,
    p_remark      text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
DECLARE
    v_current_remarks TEXT;
    v_updated_remarks TEXT;
    v_append_text TEXT;
    v_formatted_time TEXT;
    v_result JSONB;
BEGIN
    -- ── ADDED: the function bypasses RLS, so it must check the caller itself.
    -- auth.uid() is null for service_role / SQL editor callers, which stay trusted.
    IF auth.uid() IS NOT NULL AND get_my_user_type() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Not permitted: only an Admin can move a customer between stages.'
            USING ERRCODE = '42501';
    END IF;

    -- Lock the row for update to prevent concurrent modifications
    SELECT internal_remarks INTO v_current_remarks
    FROM admin
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;

    -- Only append a remark if one was actually provided
    IF p_remark IS NOT NULL AND TRIM(p_remark) != '' THEN
        v_formatted_time := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH:MI AM');

        v_append_text := p_old_stage || ' (' || v_formatted_time || '): ' || TRIM(p_remark);

        IF v_current_remarks IS NOT NULL AND TRIM(v_current_remarks) != '' THEN
            v_updated_remarks := v_current_remarks || E'\n' || v_append_text;
        ELSE
            v_updated_remarks := v_append_text;
        END IF;
    ELSE
        v_updated_remarks := v_current_remarks;
    END IF;

    -- Update the record atomically
    UPDATE admin
    SET
        stage = p_new_stage,
        internal_remarks = v_updated_remarks
    WHERE id = p_customer_id
    RETURNING to_jsonb(admin.*) INTO v_result;

    RETURN v_result;
END;
$function$;


-- ── Verify ──────────────────────────────────────────────────────────────────
-- Re-run the probe afterwards: EXPECT admin = "Customer not found" (reached the
-- body), every other role = "Not permitted".
