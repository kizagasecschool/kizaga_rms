-- ============================================================
-- KIZAGA RMS: Notifications table + RLS
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. Create notifications table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  recipient_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  recipient_role  TEXT CHECK (recipient_role IN ('admin', 'headmaster', 'academic', 'teacher')),
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error', 'exam_created', 'results_processed')),
  link            TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast user notification queries
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role ON public.notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(recipient_id, is_read);

-- ============================================================
-- 2. Enable RLS
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. Drop existing policies to avoid duplicates
-- ============================================================
DROP POLICY IF EXISTS "users_select_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "users_update_own_notifications" ON public.notifications;
DROP POLICY IF EXISTS "admin_all_notifications" ON public.notifications;
DROP POLICY IF EXISTS "headmaster_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "academic_insert_notifications" ON public.notifications;
DROP POLICY IF EXISTS "admin_insert_notifications" ON public.notifications;

-- ============================================================
-- 4. RLS Policies
-- ============================================================

-- 4a. Users can read notifications addressed to them directly or via role
CREATE POLICY "users_select_own_notifications" ON public.notifications
  FOR SELECT
  USING (
    recipient_id = auth.uid()
    OR recipient_role = (SELECT role FROM public.profiles WHERE id = auth.uid())
    OR recipient_id IS NULL  -- system-wide broadcasts
  );

-- 4b. Users can mark their own notifications as read
CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- 4c. Admin can insert any notification
CREATE POLICY "admin_insert_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    AND sender_id = auth.uid()
  );

-- 4d. Headmaster can insert notifications
CREATE POLICY "headmaster_insert_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'headmaster'
    AND sender_id = auth.uid()
  );

-- 4e. Academic can insert notifications
CREATE POLICY "academic_insert_notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'academic'
    AND sender_id = auth.uid()
  );

-- ============================================================
-- 5. Helper: send_notification RPC for backend/service use
-- ============================================================
CREATE OR REPLACE FUNCTION public.send_notification(
  p_sender_id UUID,
  p_recipient_id UUID DEFAULT NULL,
  p_recipient_role TEXT DEFAULT NULL,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (sender_id, recipient_id, recipient_role, title, message, type, link)
  VALUES (p_sender_id, p_recipient_id, p_recipient_role, p_title, p_message, p_type, p_link)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;

-- ============================================================
-- 6. RPC: notify_exam_teachers
--    Sends notification to all teachers assigned to classes
--    that are included in the given exam.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_exam_teachers(
  p_exam_id UUID,
  p_sender_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'exam_created',
  p_link TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (sender_id, recipient_id, title, message, type, link)
  SELECT
    p_sender_id,
    p.profile_id,
    p_title,
    p_message,
    p_type,
    p_link
  FROM (
    SELECT DISTINCT t.profile_id
    FROM exam_classes ec
    JOIN class_streams cs ON cs.class_id = ec.class_id
    JOIN teacher_subjects ts ON ts.class_stream_id = cs.id
    JOIN teachers t ON t.id = ts.teacher_id
    WHERE ec.exam_id = p_exam_id
  ) p;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 7. RPC: notify_role
--    Sends notification to all users with a given role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_role(
  p_sender_id UUID,
  p_recipient_role TEXT,
  p_title TEXT,
  p_message TEXT,
  p_type TEXT DEFAULT 'info',
  p_link TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.notifications (sender_id, recipient_id, title, message, type, link)
  SELECT
    p_sender_id,
    id,
    p_title,
    p_message,
    p_type,
    p_link
  FROM public.profiles
  WHERE role = p_recipient_role;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================
-- 8. RPC: get_unread_notification_count
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_role TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

  SELECT COUNT(*) INTO v_count
  FROM public.notifications
  WHERE (recipient_id = auth.uid() OR recipient_role = v_role)
    AND is_read = false;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 9. Verify
-- ============================================================
SELECT 'notifications migration complete' AS result;
