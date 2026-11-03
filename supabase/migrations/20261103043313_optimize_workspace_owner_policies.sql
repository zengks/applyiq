-- Preserve roles, ownership predicates, and WITH CHECK semantics. Cache the
-- caller's uid once per statement instead of evaluating it for every row.
-- Billing/subscription and usage policies remain unchanged under the billing hold.
alter policy applications_all_own on public.applications to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy resumes_all_own on public.resumes to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy profiles_select_own on public.profiles to authenticated
  using ((select auth.uid()) = id);
alter policy profiles_insert_own on public.profiles to authenticated
  with check ((select auth.uid()) = id);
