-- ============================================================
-- FIX ALL remaining RLS policies that use EXISTS/subquery on
-- profiles instead of get_my_role() (SECURITY DEFINER).
-- Applies to: admission_applications, application_conversations,
--             class_report_settings, notifications.
-- ============================================================

-- ---- admission_applications --------------------------------
-- Two overlapping policies → merge into one with the widest role set

DROP POLICY IF EXISTS "admin_headmaster_all_admission_applications"          ON admission_applications;
DROP POLICY IF EXISTS "admin_headmaster_academic_all_admission_applications"  ON admission_applications;

CREATE POLICY "admin_headmaster_academic_all_admission_applications"
  ON admission_applications FOR ALL TO authenticated
  USING     (get_my_role() IN ('admin', 'headmaster', 'academic'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster', 'academic'));

-- ---- application_conversations -----------------------------
-- Keep sender = 'academic' check; replace EXISTS with get_my_role()

DROP POLICY IF EXISTS "academic_insert_app_conversations" ON application_conversations;

CREATE POLICY "academic_insert_app_conversations"
  ON application_conversations FOR INSERT TO authenticated
  WITH CHECK (
    sender = 'academic'
    AND get_my_role() IN ('admin', 'headmaster', 'academic')
  );

-- ---- class_report_settings ---------------------------------
-- Used by StudentReports.jsx upsert (auto-saves report headings)

DROP POLICY IF EXISTS "Staff can insert class_report_settings" ON class_report_settings;
DROP POLICY IF EXISTS "Staff can select class_report_settings" ON class_report_settings;
DROP POLICY IF EXISTS "Staff can update class_report_settings" ON class_report_settings;

CREATE POLICY "staff_select_class_report_settings"
  ON class_report_settings FOR SELECT TO authenticated
  USING (get_my_role() IN ('admin', 'headmaster', 'academic', 'teacher'));

CREATE POLICY "staff_insert_class_report_settings"
  ON class_report_settings FOR INSERT TO authenticated
  WITH CHECK(get_my_role() IN ('admin', 'headmaster', 'academic', 'teacher'));

CREATE POLICY "staff_update_class_report_settings"
  ON class_report_settings FOR UPDATE TO authenticated
  USING     (get_my_role() IN ('admin', 'headmaster', 'academic', 'teacher'))
  WITH CHECK(get_my_role() IN ('admin', 'headmaster', 'academic', 'teacher'));

-- ---- notifications -----------------------------------------
-- Scalar subquery (SELECT role FROM profiles WHERE id=auth.uid())
-- is slightly more reliable than EXISTS but still subject to
-- profiles RLS; replace with get_my_role() for consistency.

DROP POLICY IF EXISTS "admin_insert_notifications"      ON notifications;
DROP POLICY IF EXISTS "headmaster_insert_notifications" ON notifications;
DROP POLICY IF EXISTS "academic_insert_notifications"   ON notifications;
DROP POLICY IF EXISTS "users_select_own_notifications"  ON notifications;

CREATE POLICY "staff_insert_notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (
    get_my_role() IN ('admin', 'headmaster', 'academic')
    AND sender_id = auth.uid()
  );

CREATE POLICY "users_select_own_notifications"
  ON notifications FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR recipient_role = get_my_role()
  );

-- ---- Final verification ------------------------------------
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE (qual LIKE '%EXISTS%profiles%' OR with_check LIKE '%EXISTS%profiles%'
       OR qual LIKE '%SELECT profiles.role%' OR with_check LIKE '%SELECT profiles.role%')
ORDER BY schemaname, tablename, policyname;
