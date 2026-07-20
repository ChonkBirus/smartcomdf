
REVOKE ALL ON FUNCTION public.can_view_employee_costs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_project_team() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_manage_employees() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.can_view_employee_costs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_project_team() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_employees() TO authenticated;
