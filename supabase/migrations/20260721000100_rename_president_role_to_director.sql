-- Rename the "President" member role to "Director".
-- The members.role check constraint allowed 'President' as a value; the product
-- now calls this role "Director" everywhere, so the allowed value list and all
-- existing rows are updated to match.

ALTER TABLE public.members DROP CONSTRAINT members_role_check;

UPDATE public.members SET role = 'Director' WHERE role = 'President';

ALTER TABLE public.members
  ADD CONSTRAINT members_role_check
  CHECK (role = ANY (ARRAY['Director'::text, 'Vice President'::text, 'Secretary'::text, 'Member'::text]));
