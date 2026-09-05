-- ============================================================
-- FIX: Allow ACADEMIC to UPDATE school_settings (signatures)
-- ============================================================
-- Chanzo cha tatizo:
--   Ukurasa wa Student Reports sasa huruhusu kuhifadhi saini za
--   Mkuu wa Shule, Mhuri, Makamu na Ofisi ya Taaluma moja kwa moja.
--   Lakini policy ya awali ya school_settings iliruhusu UPDATE tu
--   kwa 'admin' na 'headmaster'. Hivyo akaunti ya 'academic'
--   ilifeli kuhifadhi na kuona hitilafu ya RLS policy.
--
-- Suluhu: ongeza 'academic' kwenye policy zote mbili zinazosimamia
--   uandishi kwenye school_settings (kufuata mfumo wa majina wa repo).
--   Hii inalingana na convention ya repo ambapo 'academic' ana ruhusa
--   FULL (ALL) kwenye curricula, combinations, n.k.
-- ============================================================

DROP POLICY IF EXISTS "admin_all_school_settings" ON school_settings;
CREATE POLICY "admin_all_school_settings" ON school_settings
  FOR ALL USING ((SELECT get_my_role()) IN ('admin', 'headmaster', 'academic'))
  WITH CHECK ((SELECT get_my_role()) IN ('admin', 'headmaster', 'academic'));

DROP POLICY IF EXISTS "admin_headmaster_all_school_settings" ON school_settings;
CREATE POLICY "admin_headmaster_all_school_settings" ON school_settings
  FOR ALL USING ((SELECT get_my_role()) IN ('admin', 'headmaster', 'academic'))
  WITH CHECK ((SELECT get_my_role()) IN ('admin', 'headmaster', 'academic'));

-- ============================================================
-- Verify: kila policy ya school_settings isiwe na academic
-- ============================================================
SELECT policyname, cmd, roles::text AS roles
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'school_settings'
ORDER BY policyname;