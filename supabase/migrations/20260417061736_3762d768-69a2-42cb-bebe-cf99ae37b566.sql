
-- Drivers table
CREATE TABLE public.drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymous read drivers" ON public.drivers FOR SELECT USING (true);
CREATE POLICY "Anonymous insert drivers" ON public.drivers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anonymous update drivers" ON public.drivers FOR UPDATE USING (true);
CREATE POLICY "Anonymous delete drivers" ON public.drivers FOR DELETE USING (true);

-- Month data table
CREATE TABLE public.month_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL,
  month int NOT NULL CHECK (month >= 0 AND month <= 11),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(year, month)
);

ALTER TABLE public.month_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anonymous read month_data" ON public.month_data FOR SELECT USING (true);
CREATE POLICY "Anonymous insert month_data" ON public.month_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Anonymous update month_data" ON public.month_data FOR UPDATE USING (true);
CREATE POLICY "Anonymous delete month_data" ON public.month_data FOR DELETE USING (true);

-- Trigger function for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_month_data_updated_at
BEFORE UPDATE ON public.month_data
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER TABLE public.drivers REPLICA IDENTITY FULL;
ALTER TABLE public.month_data REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.drivers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.month_data;
