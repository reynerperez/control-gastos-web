SET local check_function_bodies = off;

CREATE TABLE "public"."budgets" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "category_id" uuid                     NOT NULL,
  "amount"      numeric(12,2)            NOT NULL,
  "month"       date                     NOT NULL,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "budgets_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "budgets_pkey" PRIMARY KEY (id),
  CONSTRAINT "budgets_user_id_category_id_month_key" UNIQUE (user_id, category_id, month)
);

ALTER TABLE "public"."budgets"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."categories" (
  "id"                 uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"            uuid                     NOT NULL,
  "name"               text                     NOT NULL,
  "icon"               text                     NOT NULL DEFAULT 'pricetag'::text,
  "color"              text                     NOT NULL DEFAULT '#4F46E5'::text,
  "type"               text                     NOT NULL,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "requires_breakdown" boolean                  NOT NULL DEFAULT false,
  CONSTRAINT "categories_pkey" PRIMARY KEY (id),
  CONSTRAINT "categories_type_check" CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);

ALTER TABLE "public"."categories"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."payment_methods" (
  "id"          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"     uuid                     NOT NULL,
  "name"        text                     NOT NULL,
  "type"        text                     NOT NULL,
  "closing_day" integer,
  "due_day"     integer,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id),
  CONSTRAINT "payment_methods_type_check" CHECK ((type = ANY (ARRAY['debit'::text, 'credit'::text, 'cash'::text])))
);

ALTER TABLE "public"."payment_methods"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."profiles" (
  "id"         uuid                     NOT NULL,
  "full_name"  text,
  "currency"   text                     NOT NULL DEFAULT 'MXN'::text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."transaction_details" (
  "id"             uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "transaction_id" uuid                     NOT NULL,
  "category_id"    uuid,
  "description"    text,
  "quantity"       numeric(12,2)            NOT NULL DEFAULT 1,
  "unit_price"     numeric(12,2)            NOT NULL,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "transaction_details_pkey" PRIMARY KEY (id),
  CONSTRAINT "transaction_details_quantity_check" CHECK ((quantity > (0)::numeric)),
  CONSTRAINT "transaction_details_unit_price_check" CHECK ((unit_price > (0)::numeric))
);

ALTER TABLE "public"."transaction_details"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."transactions" (
  "id"                uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "user_id"           uuid                     NOT NULL,
  "amount"            numeric(12,2)            NOT NULL,
  "type"              text                     NOT NULL,
  "note"              text,
  "date"              date                     NOT NULL DEFAULT CURRENT_DATE,
  "created_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "breakdown_status"  text                     NOT NULL DEFAULT 'completed'::text,
  "payment_method_id" uuid,
  "merchant"          text,
  "latitude"          double precision,
  "longitude"         double precision,
  CONSTRAINT "transactions_amount_check" CHECK ((amount > (0)::numeric)),
  CONSTRAINT "transactions_breakdown_status_check" CHECK ((breakdown_status = ANY (ARRAY['pending'::text, 'completed'::text]))),
  CONSTRAINT "transactions_pkey" PRIMARY KEY (id),
  CONSTRAINT "transactions_type_check" CHECK ((type = ANY (ARRAY['income'::text, 'expense'::text])))
);

ALTER TABLE "public"."transactions"
  ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  AS $function$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$function$;

ALTER TABLE "public"."budgets"
  ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."budgets"
  ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

ALTER TABLE "public"."categories"
  ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."payment_methods"
  ADD CONSTRAINT "payment_methods_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."transaction_details"
  ADD CONSTRAINT "transaction_details_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_payment_method_id_fkey" FOREIGN KEY (payment_method_id) REFERENCES public.payment_methods(id) ON DELETE SET NULL;

ALTER TABLE "public"."transaction_details"
  ADD CONSTRAINT "transaction_details_transaction_id_fkey" FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE "public"."transactions"
  ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX budgets_user_idx ON public.budgets USING btree (user_id);

CREATE INDEX categories_user_idx ON public.categories USING btree (user_id);

CREATE INDEX payment_methods_user_idx ON public.payment_methods USING btree (user_id);

CREATE INDEX transaction_details_tx_idx ON public.transaction_details USING btree (transaction_id);

CREATE INDEX transactions_date_idx ON public.transactions USING btree (user_id, date);

CREATE INDEX transactions_location_idx ON public.transactions USING btree (latitude, longitude)
  WHERE (latitude IS NOT NULL);

CREATE INDEX transactions_merchant_idx ON public.transactions USING btree (user_id, merchant)
  WHERE (merchant IS NOT NULL);

CREATE INDEX transactions_user_idx ON public.transactions USING btree (user_id);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "budgets_delete_own" ON "public"."budgets"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "budgets_insert_own" ON "public"."budgets"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "budgets_select_own" ON "public"."budgets"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "budgets_update_own" ON "public"."budgets"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "categories_delete_own" ON "public"."categories"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "categories_insert_own" ON "public"."categories"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "categories_select_own" ON "public"."categories"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "categories_update_own" ON "public"."categories"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "payment_methods_delete_own" ON "public"."payment_methods"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "payment_methods_insert_own" ON "public"."payment_methods"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "payment_methods_select_own" ON "public"."payment_methods"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "payment_methods_update_own" ON "public"."payment_methods"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "profiles_insert_own" ON "public"."profiles"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = id));

CREATE POLICY "profiles_select_own" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "profiles_update_own" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "transaction_details_delete_own" ON "public"."transaction_details"
  FOR DELETE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.transactions t
  WHERE ((t.id = transaction_details.transaction_id) AND (t.user_id = auth.uid())))));

CREATE POLICY "transaction_details_insert_own" ON "public"."transaction_details"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.transactions t
  WHERE ((t.id = transaction_details.transaction_id) AND (t.user_id = auth.uid())))));

CREATE POLICY "transaction_details_select_own" ON "public"."transaction_details"
  FOR SELECT
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.transactions t
  WHERE ((t.id = transaction_details.transaction_id) AND (t.user_id = auth.uid())))));

CREATE POLICY "transaction_details_update_own" ON "public"."transaction_details"
  FOR UPDATE
  TO PUBLIC
  USING ((EXISTS ( SELECT 1
   FROM public.transactions t
  WHERE ((t.id = transaction_details.transaction_id) AND (t.user_id = auth.uid())))));

CREATE POLICY "transactions_delete_own" ON "public"."transactions"
  FOR DELETE
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "transactions_insert_own" ON "public"."transactions"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "transactions_select_own" ON "public"."transactions"
  FOR SELECT
  TO PUBLIC
  USING ((auth.uid() = user_id));

CREATE POLICY "transactions_update_own" ON "public"."transactions"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = user_id));

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated";

REVOKE ALL ON FUNCTION "public"."handle_new_user"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budgets" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."budgets" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budgets" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."budgets" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."categories" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."categories" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_methods" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."payment_methods" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_methods" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."payment_methods" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transaction_details" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."transaction_details" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transaction_details" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transaction_details" TO "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "anon", "authenticated";

REVOKE ALL ON TABLE "public"."transactions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."transactions" TO "service_role";

