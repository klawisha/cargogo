CREATE TABLE IF NOT EXISTS service_usage_counter (
  service_key text NOT NULL,
  metric_key text NOT NULL,
  period_start date NOT NULL,
  usage_value bigint NOT NULL DEFAULT 0 CHECK (usage_value >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(service_key,metric_key,period_start)
);

CREATE TABLE IF NOT EXISTS operating_cost_plan (
  key text PRIMARY KEY,
  label text NOT NULL,
  category text NOT NULL,
  amount_minor bigint NOT NULL DEFAULT 0 CHECK (amount_minor >= 0),
  currency text NOT NULL CHECK (currency IN ('UAH','USD','EUR')),
  cadence text NOT NULL CHECK (cadence IN ('monthly','annual','one_time','usage')),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','active','paid','disabled')),
  note text,
  source_url text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO operating_cost_plan(key,label,category,amount_minor,currency,cadence,status,note,source_url) VALUES
 ('vps','Production VPS','infrastructure',549,'EUR','monthly','planned','Орієнтир для одного стартового VPS. Перед оплатою замінити на фактичний тариф провайдера.','https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/'),
 ('domain','CargoGo domain','infrastructure',100000,'UAH','annual','planned','Плановий резерв. Фактична ціна залежить від доменної зони та реєстратора.',NULL),
 ('apple_developer','Apple Developer Program','distribution',9900,'USD','annual','planned','$99 на рік за публікацію в App Store.','https://developer.apple.com/programs/'),
 ('google_play','Google Play Console','distribution',2500,'USD','one_time','planned','$25 одноразово.','https://support.google.com/googleplay/android-developer/answer/6112435'),
 ('mapbox_directions','Mapbox Directions','api',0,'USD','usage','active','До 100 000 Directions requests / month — free tier; далі usage-based.','https://www.mapbox.com/pricing'),
 ('google_maps_android','Google Maps SDK for Android','api',0,'USD','usage','active','Відображення Android map SDK відстежується як окремий dependency; фактичний billing дивитися у Google Cloud Console.',NULL),
 ('cloudflare_r2','Cloudflare R2','storage',0,'USD','usage','planned','Free tier: 10 GB-month, 1M Class A, 10M Class B, free egress.','https://developers.cloudflare.com/r2/pricing/'),
 ('sms_otp','SMS OTP','communications',0,'UAH','usage','planned','Провайдер ще не обраний. Після вибору додати фактичний тариф за SMS.',NULL)
ON CONFLICT(key) DO NOTHING;

CREATE INDEX IF NOT EXISTS service_usage_period_idx ON service_usage_counter(period_start, service_key);
