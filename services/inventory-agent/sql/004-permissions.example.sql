-- EXAMPLE ONLY: a DBA must pre-create inventory_agent_worker with LOGIN,
-- NOSUPERUSER, NOBYPASSRLS and a private password outside this repository.
-- Apply after the source and agent scripts, only for this dedicated identity.
-- No anonymous/authenticated/public role receives a policy or grant.
BEGIN;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='inventory_agent_worker' AND NOT rolsuper AND NOT rolbypassrls) THEN RAISE EXCEPTION 'Create a dedicated nonsuperuser NOBYPASSRLS worker first'; END IF; END $$;
REVOKE ALL ON SCHEMA inventory_agent FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA inventory_agent FROM PUBLIC;
GRANT USAGE ON SCHEMA inventory_agent TO inventory_agent_worker;
GRANT SELECT ON inventory_agent."Medicamentos",inventory_agent."Proveedores",inventory_agent."Lotes",inventory_agent."ModoFuente" TO inventory_agent_worker;
CREATE POLICY "worker_mode_read" ON inventory_agent."ModoFuente" FOR SELECT TO inventory_agent_worker USING(TRUE);
DO $$ DECLARE t TEXT; BEGIN FOREACH t IN ARRAY ARRAY['ConfiguracionReposicion','SolicitudesReposicion','Aprobaciones','WebhookInbox','Outbox','AuditoriaPedidos'] LOOP
 EXECUTE format('GRANT SELECT,INSERT,UPDATE ON inventory_agent.%I TO inventory_agent_worker',t);
 EXECUTE format('CREATE POLICY worker_private_state ON inventory_agent.%I TO inventory_agent_worker USING(TRUE) WITH CHECK(TRUE)',t);
END LOOP; END $$;
DO $$ BEGIN
 IF (SELECT "modo" FROM inventory_agent."ModoFuente")='Integrated' THEN
  GRANT USAGE ON SCHEMA public TO inventory_agent_worker;
  GRANT SELECT("id","nombre","stock","stockMinimo","activo") ON public."Producto" TO inventory_agent_worker;
  GRANT SELECT("id","nombre","email","activo") ON public."Proveedor" TO inventory_agent_worker;
  GRANT SELECT("id","productoId","stock","vencimiento") ON public."Lote" TO inventory_agent_worker;
  CREATE POLICY "inventory_agent_read" ON public."Producto" FOR SELECT TO inventory_agent_worker USING(TRUE);
  CREATE POLICY "inventory_agent_read" ON public."Proveedor" FOR SELECT TO inventory_agent_worker USING(TRUE);
  CREATE POLICY "inventory_agent_read" ON public."Lote" FOR SELECT TO inventory_agent_worker USING(TRUE);
 ELSE
  CREATE POLICY "worker_inventory_read" ON inventory_agent."Medicamentos" FOR SELECT TO inventory_agent_worker USING(TRUE);
  CREATE POLICY "worker_inventory_read" ON inventory_agent."Proveedores" FOR SELECT TO inventory_agent_worker USING(TRUE);
  CREATE POLICY "worker_inventory_read" ON inventory_agent."Lotes" FOR SELECT TO inventory_agent_worker USING(TRUE);
 END IF;
END $$;
COMMIT;
