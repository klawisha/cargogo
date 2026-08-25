export type Country = { code: string; name: string };
export type City = { id: string; countryCode: string; name: string; lat: number; lng: number };

// Alpha catalog is intentionally local and deterministic. It keeps development free of
// third-party geocoding dependencies. The service boundary allows replacing this with a
// full worldwide dataset/provider later without changing Cargo/Trip contracts.
export const COUNTRIES: Country[] = [
  { code: 'UA', name: 'Україна' },
];

export const CITIES: City[] = [
  ['kyiv','Київ',50.4501,30.5234],['dnipro','Дніпро',48.4647,35.0462],['kharkiv','Харків',49.9935,36.2304],
  ['odesa','Одеса',46.4825,30.7233],['lviv','Львів',49.8397,24.0297],['zaporizhzhia','Запоріжжя',47.8388,35.1396],
  ['kryvyi-rih','Кривий Ріг',47.9105,33.3918],['mykolaiv','Миколаїв',46.9750,31.9946],['mariupol','Маріуполь',47.0971,37.5434],
  ['vinnytsia','Вінниця',49.2331,28.4682],['kherson','Херсон',46.6354,32.6169],['poltava','Полтава',49.5883,34.5514],
  ['chernihiv','Чернігів',51.4982,31.2893],['cherkasy','Черкаси',49.4444,32.0598],['sumy','Суми',50.9077,34.7981],
  ['zhytomyr','Житомир',50.2547,28.6587],['rivne','Рівне',50.6199,26.2516],['ivano-frankivsk','Івано-Франківськ',48.9226,24.7111],
  ['ternopil','Тернопіль',49.5535,25.5948],['lutsk','Луцьк',50.7472,25.3254],['uzhhorod','Ужгород',48.6208,22.2879],
  ['khmelnytskyi','Хмельницький',49.4229,26.9871],['chernivtsi','Чернівці',48.2915,25.9403],['kropyvnytskyi','Кропивницький',48.5079,32.2623],
  ['pavlohrad','Павлоград',48.5343,35.8705],['kremenchuk','Кременчук',49.0680,33.4204],['kamianske','Кам’янське',48.5113,34.6021],
  ['bila-tserkva','Біла Церква',49.7954,30.1167],['brovary','Бровари',50.5114,30.7903],['irpin','Ірпінь',50.5218,30.2506],
].map(([id,name,lat,lng]) => ({ id: String(id), countryCode: 'UA', name: String(name), lat: Number(lat), lng: Number(lng) }));
