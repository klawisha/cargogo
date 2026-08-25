-- Structured locations + editable/delete lifecycle before deal acceptance.
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_country_code CHAR(2);
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_country_name TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_city_id TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_city_name TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS pickup_street_private TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_country_code CHAR(2);
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_country_name TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_city_id TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_city_name TEXT;
ALTER TABLE cargo ADD COLUMN IF NOT EXISTS delivery_street_private TEXT;

ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_country_code CHAR(2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_country_name TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_city_id TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_city_name TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS origin_street_private TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_country_code CHAR(2);
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_country_name TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_city_id TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_city_name TEXT;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS destination_street_private TEXT;

ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_city SMALLINT NOT NULL DEFAULT 0 CHECK (score_city BETWEEN 0 AND 45);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_proximity SMALLINT NOT NULL DEFAULT 0 CHECK (score_proximity BETWEEN 0 AND 20);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_direction SMALLINT NOT NULL DEFAULT 0 CHECK (score_direction BETWEEN 0 AND 10);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_capacity SMALLINT NOT NULL DEFAULT 0 CHECK (score_capacity BETWEEN 0 AND 10);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_time SMALLINT NOT NULL DEFAULT 0 CHECK (score_time BETWEEN 0 AND 10);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS score_reward SMALLINT NOT NULL DEFAULT 0 CHECK (score_reward BETWEEN 0 AND 5);
ALTER TABLE trip_match ADD COLUMN IF NOT EXISTS match_kind TEXT NOT NULL DEFAULT 'corridor' CHECK (match_kind IN ('exact_city_pair','nearby_city_pair','corridor'));

CREATE INDEX IF NOT EXISTS cargo_structured_route_idx ON cargo(pickup_country_code,pickup_city_id,delivery_country_code,delivery_city_id,status);
CREATE INDEX IF NOT EXISTS trip_structured_route_idx ON trip(origin_country_code,origin_city_id,destination_country_code,destination_city_id,status);

-- Best-effort backfill for pre-v0.7 Ukrainian data using the nearest catalog city (<= 80 km).
WITH city(id,name,lat,lng) AS (VALUES
    ('kyiv','Київ',50.4501::double precision,30.5234::double precision),
    ('dnipro','Дніпро',48.4647::double precision,35.0462::double precision),
    ('kharkiv','Харків',49.9935::double precision,36.2304::double precision),
    ('odesa','Одеса',46.4825::double precision,30.7233::double precision),
    ('lviv','Львів',49.8397::double precision,24.0297::double precision),
    ('zaporizhzhia','Запоріжжя',47.8388::double precision,35.1396::double precision),
    ('kryvyi-rih','Кривий Ріг',47.9105::double precision,33.3918::double precision),
    ('mykolaiv','Миколаїв',46.9750::double precision,31.9946::double precision),
    ('mariupol','Маріуполь',47.0971::double precision,37.5434::double precision),
    ('vinnytsia','Вінниця',49.2331::double precision,28.4682::double precision),
    ('kherson','Херсон',46.6354::double precision,32.6169::double precision),
    ('poltava','Полтава',49.5883::double precision,34.5514::double precision),
    ('chernihiv','Чернігів',51.4982::double precision,31.2893::double precision),
    ('cherkasy','Черкаси',49.4444::double precision,32.0598::double precision),
    ('sumy','Суми',50.9077::double precision,34.7981::double precision),
    ('zhytomyr','Житомир',50.2547::double precision,28.6587::double precision),
    ('rivne','Рівне',50.6199::double precision,26.2516::double precision),
    ('ivano-frankivsk','Івано-Франківськ',48.9226::double precision,24.7111::double precision),
    ('ternopil','Тернопіль',49.5535::double precision,25.5948::double precision),
    ('lutsk','Луцьк',50.7472::double precision,25.3254::double precision),
    ('uzhhorod','Ужгород',48.6208::double precision,22.2879::double precision),
    ('khmelnytskyi','Хмельницький',49.4229::double precision,26.9871::double precision),
    ('chernivtsi','Чернівці',48.2915::double precision,25.9403::double precision),
    ('kropyvnytskyi','Кропивницький',48.5079::double precision,32.2623::double precision),
    ('pavlohrad','Павлоград',48.5343::double precision,35.8705::double precision),
    ('kremenchuk','Кременчук',49.0680::double precision,33.4204::double precision),
    ('kamianske','Кам’янське',48.5113::double precision,34.6021::double precision),
    ('bila-tserkva','Біла Церква',49.7954::double precision,30.1167::double precision),
    ('brovary','Бровари',50.5114::double precision,30.7903::double precision),
    ('irpin','Ірпінь',50.5218::double precision,30.2506::double precision)
), nearest AS (
  SELECT c.id cargo_id,x.id city_id,x.name city_name, ROW_NUMBER() OVER(PARTITION BY c.id ORDER BY ST_Distance(c.pickup_point,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography)) rn
  FROM cargo c CROSS JOIN city x WHERE c.pickup_city_id IS NULL AND ST_DWithin(c.pickup_point,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography,80000)
) UPDATE cargo c SET pickup_country_code='UA',pickup_country_name='Україна',pickup_city_id=n.city_id,pickup_city_name=n.city_name,pickup_street_private=COALESCE(c.pickup_address_private,'') FROM nearest n WHERE c.id=n.cargo_id AND n.rn=1;
WITH city(id,name,lat,lng) AS (VALUES
    ('kyiv','Київ',50.4501::double precision,30.5234::double precision),
    ('dnipro','Дніпро',48.4647::double precision,35.0462::double precision),
    ('kharkiv','Харків',49.9935::double precision,36.2304::double precision),
    ('odesa','Одеса',46.4825::double precision,30.7233::double precision),
    ('lviv','Львів',49.8397::double precision,24.0297::double precision),
    ('zaporizhzhia','Запоріжжя',47.8388::double precision,35.1396::double precision),
    ('kryvyi-rih','Кривий Ріг',47.9105::double precision,33.3918::double precision),
    ('mykolaiv','Миколаїв',46.9750::double precision,31.9946::double precision),
    ('mariupol','Маріуполь',47.0971::double precision,37.5434::double precision),
    ('vinnytsia','Вінниця',49.2331::double precision,28.4682::double precision),
    ('kherson','Херсон',46.6354::double precision,32.6169::double precision),
    ('poltava','Полтава',49.5883::double precision,34.5514::double precision),
    ('chernihiv','Чернігів',51.4982::double precision,31.2893::double precision),
    ('cherkasy','Черкаси',49.4444::double precision,32.0598::double precision),
    ('sumy','Суми',50.9077::double precision,34.7981::double precision),
    ('zhytomyr','Житомир',50.2547::double precision,28.6587::double precision),
    ('rivne','Рівне',50.6199::double precision,26.2516::double precision),
    ('ivano-frankivsk','Івано-Франківськ',48.9226::double precision,24.7111::double precision),
    ('ternopil','Тернопіль',49.5535::double precision,25.5948::double precision),
    ('lutsk','Луцьк',50.7472::double precision,25.3254::double precision),
    ('uzhhorod','Ужгород',48.6208::double precision,22.2879::double precision),
    ('khmelnytskyi','Хмельницький',49.4229::double precision,26.9871::double precision),
    ('chernivtsi','Чернівці',48.2915::double precision,25.9403::double precision),
    ('kropyvnytskyi','Кропивницький',48.5079::double precision,32.2623::double precision),
    ('pavlohrad','Павлоград',48.5343::double precision,35.8705::double precision),
    ('kremenchuk','Кременчук',49.0680::double precision,33.4204::double precision),
    ('kamianske','Кам’янське',48.5113::double precision,34.6021::double precision),
    ('bila-tserkva','Біла Церква',49.7954::double precision,30.1167::double precision),
    ('brovary','Бровари',50.5114::double precision,30.7903::double precision),
    ('irpin','Ірпінь',50.5218::double precision,30.2506::double precision)
), nearest AS (
  SELECT c.id cargo_id,x.id city_id,x.name city_name, ROW_NUMBER() OVER(PARTITION BY c.id ORDER BY ST_Distance(c.delivery_point,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography)) rn
  FROM cargo c CROSS JOIN city x WHERE c.delivery_city_id IS NULL AND ST_DWithin(c.delivery_point,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography,80000)
) UPDATE cargo c SET delivery_country_code='UA',delivery_country_name='Україна',delivery_city_id=n.city_id,delivery_city_name=n.city_name,delivery_street_private=COALESCE(c.delivery_address_private,'') FROM nearest n WHERE c.id=n.cargo_id AND n.rn=1;
WITH city(id,name,lat,lng) AS (VALUES
    ('kyiv','Київ',50.4501::double precision,30.5234::double precision),
    ('dnipro','Дніпро',48.4647::double precision,35.0462::double precision),
    ('kharkiv','Харків',49.9935::double precision,36.2304::double precision),
    ('odesa','Одеса',46.4825::double precision,30.7233::double precision),
    ('lviv','Львів',49.8397::double precision,24.0297::double precision),
    ('zaporizhzhia','Запоріжжя',47.8388::double precision,35.1396::double precision),
    ('kryvyi-rih','Кривий Ріг',47.9105::double precision,33.3918::double precision),
    ('mykolaiv','Миколаїв',46.9750::double precision,31.9946::double precision),
    ('mariupol','Маріуполь',47.0971::double precision,37.5434::double precision),
    ('vinnytsia','Вінниця',49.2331::double precision,28.4682::double precision),
    ('kherson','Херсон',46.6354::double precision,32.6169::double precision),
    ('poltava','Полтава',49.5883::double precision,34.5514::double precision),
    ('chernihiv','Чернігів',51.4982::double precision,31.2893::double precision),
    ('cherkasy','Черкаси',49.4444::double precision,32.0598::double precision),
    ('sumy','Суми',50.9077::double precision,34.7981::double precision),
    ('zhytomyr','Житомир',50.2547::double precision,28.6587::double precision),
    ('rivne','Рівне',50.6199::double precision,26.2516::double precision),
    ('ivano-frankivsk','Івано-Франківськ',48.9226::double precision,24.7111::double precision),
    ('ternopil','Тернопіль',49.5535::double precision,25.5948::double precision),
    ('lutsk','Луцьк',50.7472::double precision,25.3254::double precision),
    ('uzhhorod','Ужгород',48.6208::double precision,22.2879::double precision),
    ('khmelnytskyi','Хмельницький',49.4229::double precision,26.9871::double precision),
    ('chernivtsi','Чернівці',48.2915::double precision,25.9403::double precision),
    ('kropyvnytskyi','Кропивницький',48.5079::double precision,32.2623::double precision),
    ('pavlohrad','Павлоград',48.5343::double precision,35.8705::double precision),
    ('kremenchuk','Кременчук',49.0680::double precision,33.4204::double precision),
    ('kamianske','Кам’янське',48.5113::double precision,34.6021::double precision),
    ('bila-tserkva','Біла Церква',49.7954::double precision,30.1167::double precision),
    ('brovary','Бровари',50.5114::double precision,30.7903::double precision),
    ('irpin','Ірпінь',50.5218::double precision,30.2506::double precision)
), nearest AS (
  SELECT t.id trip_id,x.id city_id,x.name city_name, ROW_NUMBER() OVER(PARTITION BY t.id ORDER BY ST_Distance(t.origin,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography)) rn
  FROM trip t CROSS JOIN city x WHERE t.origin_city_id IS NULL AND ST_DWithin(t.origin,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography,80000)
) UPDATE trip t SET origin_country_code='UA',origin_country_name='Україна',origin_city_id=n.city_id,origin_city_name=n.city_name,origin_street_private=COALESCE(t.origin_address_private,'') FROM nearest n WHERE t.id=n.trip_id AND n.rn=1;
WITH city(id,name,lat,lng) AS (VALUES
    ('kyiv','Київ',50.4501::double precision,30.5234::double precision),
    ('dnipro','Дніпро',48.4647::double precision,35.0462::double precision),
    ('kharkiv','Харків',49.9935::double precision,36.2304::double precision),
    ('odesa','Одеса',46.4825::double precision,30.7233::double precision),
    ('lviv','Львів',49.8397::double precision,24.0297::double precision),
    ('zaporizhzhia','Запоріжжя',47.8388::double precision,35.1396::double precision),
    ('kryvyi-rih','Кривий Ріг',47.9105::double precision,33.3918::double precision),
    ('mykolaiv','Миколаїв',46.9750::double precision,31.9946::double precision),
    ('mariupol','Маріуполь',47.0971::double precision,37.5434::double precision),
    ('vinnytsia','Вінниця',49.2331::double precision,28.4682::double precision),
    ('kherson','Херсон',46.6354::double precision,32.6169::double precision),
    ('poltava','Полтава',49.5883::double precision,34.5514::double precision),
    ('chernihiv','Чернігів',51.4982::double precision,31.2893::double precision),
    ('cherkasy','Черкаси',49.4444::double precision,32.0598::double precision),
    ('sumy','Суми',50.9077::double precision,34.7981::double precision),
    ('zhytomyr','Житомир',50.2547::double precision,28.6587::double precision),
    ('rivne','Рівне',50.6199::double precision,26.2516::double precision),
    ('ivano-frankivsk','Івано-Франківськ',48.9226::double precision,24.7111::double precision),
    ('ternopil','Тернопіль',49.5535::double precision,25.5948::double precision),
    ('lutsk','Луцьк',50.7472::double precision,25.3254::double precision),
    ('uzhhorod','Ужгород',48.6208::double precision,22.2879::double precision),
    ('khmelnytskyi','Хмельницький',49.4229::double precision,26.9871::double precision),
    ('chernivtsi','Чернівці',48.2915::double precision,25.9403::double precision),
    ('kropyvnytskyi','Кропивницький',48.5079::double precision,32.2623::double precision),
    ('pavlohrad','Павлоград',48.5343::double precision,35.8705::double precision),
    ('kremenchuk','Кременчук',49.0680::double precision,33.4204::double precision),
    ('kamianske','Кам’янське',48.5113::double precision,34.6021::double precision),
    ('bila-tserkva','Біла Церква',49.7954::double precision,30.1167::double precision),
    ('brovary','Бровари',50.5114::double precision,30.7903::double precision),
    ('irpin','Ірпінь',50.5218::double precision,30.2506::double precision)
), nearest AS (
  SELECT t.id trip_id,x.id city_id,x.name city_name, ROW_NUMBER() OVER(PARTITION BY t.id ORDER BY ST_Distance(t.destination,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography)) rn
  FROM trip t CROSS JOIN city x WHERE t.destination_city_id IS NULL AND ST_DWithin(t.destination,ST_SetSRID(ST_MakePoint(x.lng,x.lat),4326)::geography,80000)
) UPDATE trip t SET destination_country_code='UA',destination_country_name='Україна',destination_city_id=n.city_id,destination_city_name=n.city_name,destination_street_private=COALESCE(t.destination_address_private,'') FROM nearest n WHERE t.id=n.trip_id AND n.rn=1;
ALTER TABLE trip ADD COLUMN IF NOT EXISTS matching_version SMALLINT NOT NULL DEFAULT 1;
UPDATE trip SET matching_version=1;
