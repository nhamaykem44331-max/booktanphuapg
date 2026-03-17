export type Airport = { code: string; city: string; name: string; tags: string[]; label: string };

export const AIRPORTS: Airport[] = [
  // VN priority
  ['HAN','Hà Nội','Nội Bài'],['SGN','TP.HCM','Tân Sơn Nhất'],['DAD','Đà Nẵng','Đà Nẵng'],['CXR','Nha Trang','Cam Ranh'],
  ['PQC','Phú Quốc','Phú Quốc'],['VDO','Quảng Ninh','Vân Đồn'],['HPH','Hải Phòng','Cát Bi'],['HUI','Huế','Phú Bài'],
  ['VII','Vinh','Vinh'],['VCA','Cần Thơ','Cần Thơ'],['DLI','Đà Lạt','Liên Khương'],['BMV','Buôn Ma Thuột','Buôn Ma Thuột'],
  ['PXU','Pleiku','Pleiku'],['UIH','Quy Nhơn','Phù Cát'],['TBB','Tuy Hòa','Tuy Hòa'],['VCL','Chu Lai','Chu Lai'],
  ['VCS','Côn Đảo','Côn Đảo'],['THD','Thanh Hóa','Thọ Xuân'],['DIN','Điện Biên','Điện Biên'],
  // INT
  ['BKK','Bangkok','Suvarnabhumi'],['SIN','Singapore','Changi'],['ICN','Seoul','Incheon'],['NRT','Tokyo','Narita'],
  ['KIX','Osaka','Kansai'],['TPE','Taipei','Taoyuan'],['HKG','Hong Kong','Hong Kong Intl'],['PEK','Bắc Kinh','Capital'],
  ['PVG','Thượng Hải','Pudong'],['KUL','Kuala Lumpur','Kuala Lumpur Intl'],['CAN','Quảng Châu','Baiyun'],['MEL','Melbourne','Tullamarine'],
  ['SZX','Shenzhen','Bao\'an'],['SYD','Sydney','Kingsford Smith'],['LAX','Los Angeles','LAX'],['CDG','Paris','Charles de Gaulle'],
].map(([code,city,name]) => ({
  code: code as string,
  city: city as string,
  name: name as string,
  label: `${String(city)} (${String(code)}) — ${String(name)}`,
  tags:[String(code), String(city), String(name), `${String(city)} ${String(code)}`, `${String(city)} ${String(name)}`]
}));

export const POPULAR_ROUTES = [
  { from: 'HAN', to: 'SGN' },
  { from: 'HAN', to: 'DAD' },
  { from: 'SGN', to: 'HAN' },
  { from: 'HAN', to: 'PQC' }
];

export function searchAirport(q: string): Airport[] {
  const t = q.trim().toLowerCase();
  if (!t) return AIRPORTS.slice(0, 20);
  return AIRPORTS.filter(a => a.tags.some(x => x.toLowerCase().includes(t))).slice(0, 20);
}

export function resolveAirportCode(input: string): string {
  const raw = input.trim();
  if (!raw) return '';
  if (/^[A-Za-z]{3}$/.test(raw)) return raw.toUpperCase();
  const upper = raw.toUpperCase();
  const byLabel = AIRPORTS.find(a => a.label.toUpperCase() === upper);
  if (byLabel) return byLabel.code;
  const byCodeInParens = raw.match(/\(([A-Za-z]{3})\)/)?.[1];
  if (byCodeInParens) return byCodeInParens.toUpperCase();
  const byCity = AIRPORTS.find(a => a.city.toLowerCase() === raw.toLowerCase());
  if (byCity) return byCity.code;
  const byName = AIRPORTS.find(a => a.name.toLowerCase() === raw.toLowerCase());
  if (byName) return byName.code;
  const fuzzy = AIRPORTS.find(a => a.tags.some(tag => tag.toLowerCase().includes(raw.toLowerCase())));
  return fuzzy?.code || upper.slice(0, 3);
}

export const AIRPORT_NAME_MAP = Object.fromEntries(
  AIRPORTS.map(a => [a.code, { city: a.city, airportName: a.name }])
);
