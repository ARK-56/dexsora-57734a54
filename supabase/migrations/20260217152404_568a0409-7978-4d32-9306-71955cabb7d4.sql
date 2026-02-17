
-- ============================================================
-- 1. Restrict ALL existing policies to "authenticated" role
--    (prevents anonymous user access)
-- ============================================================

-- audit_logs
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- chat_conversations
DROP POLICY IF EXISTS "Authenticated users can create conversations" ON public.chat_conversations;
CREATE POLICY "Authenticated users can create conversations" ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Participants can update conversation timestamp" ON public.chat_conversations;
CREATE POLICY "Participants can update conversation timestamp" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (is_chat_participant(auth.uid(), id));

DROP POLICY IF EXISTS "Users can view own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (is_chat_participant(auth.uid(), id));

-- chat_messages
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can send messages in their conversations" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK ((sender_id = auth.uid()) AND is_chat_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON public.chat_messages;
CREATE POLICY "Users can view messages in their conversations" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

-- chat_participants
DROP POLICY IF EXISTS "Admin users can add participants" ON public.chat_participants;
CREATE POLICY "Admin users can add participants" ON public.chat_participants
  FOR INSERT TO authenticated
  WITH CHECK (has_admin_access(auth.uid()));

DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.chat_participants;
CREATE POLICY "Users can view participants in their conversations" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

-- chat_presence (also restrict visibility to conversation participants or self)
DROP POLICY IF EXISTS "Anyone authenticated can view presence" ON public.chat_presence;
CREATE POLICY "Users can view presence of conversation peers" ON public.chat_presence
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.chat_participants cp1
      JOIN public.chat_participants cp2 ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid() AND cp2.user_id = chat_presence.user_id
    )
  );

DROP POLICY IF EXISTS "Users can update own presence" ON public.chat_presence;
CREATE POLICY "Users can update own presence" ON public.chat_presence
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own presence" ON public.chat_presence;
CREATE POLICY "Users can upsert own presence" ON public.chat_presence
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- chat_typing_status
DROP POLICY IF EXISTS "Users can update own typing status" ON public.chat_typing_status;
CREATE POLICY "Users can update own typing status" ON public.chat_typing_status
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can upsert own typing status" ON public.chat_typing_status;
CREATE POLICY "Users can upsert own typing status" ON public.chat_typing_status
  FOR INSERT TO authenticated
  WITH CHECK ((user_id = auth.uid()) AND is_chat_participant(auth.uid(), conversation_id));

DROP POLICY IF EXISTS "Users can view typing in their conversations" ON public.chat_typing_status;
CREATE POLICY "Users can view typing in their conversations" ON public.chat_typing_status
  FOR SELECT TO authenticated
  USING (is_chat_participant(auth.uid(), conversation_id));

-- lead_documents (FIX: enforce is_admin_only flag)
DROP POLICY IF EXISTS "Users can view documents on accessible leads" ON public.lead_documents;
CREATE POLICY "Users can view documents on accessible leads" ON public.lead_documents
  FOR SELECT TO authenticated
  USING (
    (has_admin_access(auth.uid()))
    OR (owns_lead(auth.uid(), lead_id) AND is_admin_only = false)
  );

DROP POLICY IF EXISTS "Users can insert lead documents" ON public.lead_documents;
CREATE POLICY "Users can insert lead documents" ON public.lead_documents
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Admins can delete lead documents" ON public.lead_documents;
CREATE POLICY "Admins can delete lead documents" ON public.lead_documents
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can delete own lead documents" ON public.lead_documents;
CREATE POLICY "Users can delete own lead documents" ON public.lead_documents
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());

-- lead_notes
DROP POLICY IF EXISTS "Admins can delete notes" ON public.lead_notes;
CREATE POLICY "Admins can delete notes" ON public.lead_notes
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Lead owners can mark notes as read" ON public.lead_notes;
CREATE POLICY "Lead owners can mark notes as read" ON public.lead_notes
  FOR UPDATE TO authenticated
  USING (owns_lead(auth.uid(), lead_id) AND is_internal = false)
  WITH CHECK (owns_lead(auth.uid(), lead_id) AND is_internal = false);

DROP POLICY IF EXISTS "Note authors can update own notes" ON public.lead_notes;
CREATE POLICY "Note authors can update own notes" ON public.lead_notes
  FOR UPDATE TO authenticated
  USING (
    (author = (SELECT profiles.full_name FROM profiles WHERE profiles.user_id = auth.uid()))
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Users can insert notes on accessible leads" ON public.lead_notes;
CREATE POLICY "Users can insert notes on accessible leads" ON public.lead_notes
  FOR INSERT TO authenticated
  WITH CHECK (has_admin_access(auth.uid()) OR owns_lead(auth.uid(), lead_id));

DROP POLICY IF EXISTS "Users can view notes on accessible leads" ON public.lead_notes;
CREATE POLICY "Users can view notes on accessible leads" ON public.lead_notes
  FOR SELECT TO authenticated
  USING (has_admin_access(auth.uid()) OR (owns_lead(auth.uid(), lead_id) AND is_internal = false));

-- leads
DROP POLICY IF EXISTS "Admin access roles can update leads" ON public.leads;
CREATE POLICY "Admin access roles can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'eligibility'::app_role) OR has_role(auth.uid(), 'auth_team'::app_role));

DROP POLICY IF EXISTS "Admins can delete leads" ON public.leads;
CREATE POLICY "Admins can delete leads" ON public.leads
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated users can insert own leads" ON public.leads;
CREATE POLICY "Authenticated users can insert own leads" ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

DROP POLICY IF EXISTS "Billing role can update leads" ON public.leads;
CREATE POLICY "Billing role can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'billing'::app_role));

DROP POLICY IF EXISTS "Shipment role can update leads" ON public.leads;
CREATE POLICY "Shipment role can update leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'shipment'::app_role));

DROP POLICY IF EXISTS "Users can delete own leads" ON public.leads;
CREATE POLICY "Users can delete own leads" ON public.leads
  FOR DELETE TO authenticated
  USING (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
CREATE POLICY "Users can update own leads" ON public.leads
  FOR UPDATE TO authenticated
  USING (auth.uid() = submitted_by)
  WITH CHECK (auth.uid() = submitted_by);

DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads" ON public.leads
  FOR SELECT TO authenticated
  USING ((submitted_by = auth.uid()) OR has_admin_access(auth.uid()));

-- login_verifications (FIX: restrict to own records only, no admin bypass)
DROP POLICY IF EXISTS "Users can insert own verifications" ON public.login_verifications;
CREATE POLICY "Users can insert own verifications" ON public.login_verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own verifications" ON public.login_verifications;
CREATE POLICY "Users can view own verifications" ON public.login_verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- notifications
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- prescriptions
DROP POLICY IF EXISTS "Admin roles can delete prescriptions" ON public.prescriptions;
CREATE POLICY "Admin roles can delete prescriptions" ON public.prescriptions
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'eligibility'::app_role) OR has_role(auth.uid(), 'auth_team'::app_role));

DROP POLICY IF EXISTS "Admin roles can insert prescriptions" ON public.prescriptions;
CREATE POLICY "Admin roles can insert prescriptions" ON public.prescriptions
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'eligibility'::app_role) OR has_role(auth.uid(), 'auth_team'::app_role));

DROP POLICY IF EXISTS "Authorized users can view prescriptions" ON public.prescriptions;
CREATE POLICY "Authorized users can view prescriptions" ON public.prescriptions
  FOR SELECT TO authenticated
  USING (has_admin_access(auth.uid()) OR has_role(auth.uid(), 'doctor'::app_role));

-- profiles
DROP POLICY IF EXISTS "Admins can delete profiles" ON public.profiles;
CREATE POLICY "Admins can delete profiles" ON public.profiles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- user_roles
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;
CREATE POLICY "Admins can delete roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
CREATE POLICY "Admins can insert roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
CREATE POLICY "Admins can update roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
