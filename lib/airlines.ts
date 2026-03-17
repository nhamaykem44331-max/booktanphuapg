export type AirlineMeta = { code: string; name: string; logo: string }

export const AIRLINE_META: Record<string, AirlineMeta> = {
  "VN": { "code": "VN", "name": "Vietnam Airlines", "logo": "https://images.kiwi.com/airlines/64/VN.png" },
  "VJ": { "code": "VJ", "name": "VietJet Air", "logo": "https://images.kiwi.com/airlines/64/VJ.png" },
  "QH": { "code": "QH", "name": "Bamboo Airways", "logo": "https://images.kiwi.com/airlines/64/QH.png" },
  "BL": { "code": "BL", "name": "Pacific Airlines", "logo": "https://images.kiwi.com/airlines/64/BL.png" },
  "VU": { "code": "VU", "name": "Vietravel Airlines", "logo": "https://images.kiwi.com/airlines/64/VU.png" },
  "9G": { "code": "9G", "name": "Sun Phu Quoc Airways", "logo": "https://images.kiwi.com/airlines/64/9G.png" },
  "CZ": { "code": "CZ", "name": "China Southern Airlines", "logo": "https://images.kiwi.com/airlines/64/CZ.png" },
  "ZH": { "code": "ZH", "name": "Shenzhen Airlines", "logo": "https://images.kiwi.com/airlines/64/ZH.png" },
  "CA": { "code": "CA", "name": "Air China", "logo": "https://images.kiwi.com/airlines/64/CA.png" },
  "MU": { "code": "MU", "name": "China Eastern Airlines", "logo": "https://images.kiwi.com/airlines/64/MU.png" },
  "FM": { "code": "FM", "name": "Shanghai Airlines", "logo": "https://images.kiwi.com/airlines/64/FM.png" },
  "SQ": { "code": "SQ", "name": "Singapore Airlines", "logo": "https://images.kiwi.com/airlines/64/SQ.png" },
  "TG": { "code": "TG", "name": "Thai Airways", "logo": "https://images.kiwi.com/airlines/64/TG.png" },
  "CX": { "code": "CX", "name": "Cathay Pacific", "logo": "https://images.kiwi.com/airlines/64/CX.png" },
  "JL": { "code": "JL", "name": "Japan Airlines", "logo": "https://images.kiwi.com/airlines/64/JL.png" },
  "NH": { "code": "NH", "name": "ANA", "logo": "https://images.kiwi.com/airlines/64/NH.png" },
  "KE": { "code": "KE", "name": "Korean Air", "logo": "https://images.kiwi.com/airlines/64/KE.png" },
  "OZ": { "code": "OZ", "name": "Asiana Airlines", "logo": "https://images.kiwi.com/airlines/64/OZ.png" },
  "EK": { "code": "EK", "name": "Emirates", "logo": "https://images.kiwi.com/airlines/64/EK.png" },
  "QR": { "code": "QR", "name": "Qatar Airways", "logo": "https://images.kiwi.com/airlines/64/QR.png" },
  "LH": { "code": "LH", "name": "Lufthansa", "logo": "https://images.kiwi.com/airlines/64/LH.png" },
  "AF": { "code": "AF", "name": "Air France", "logo": "https://images.kiwi.com/airlines/64/AF.png" },
  "KL": { "code": "KL", "name": "KLM", "logo": "https://images.kiwi.com/airlines/64/KL.png" },
  "BA": { "code": "BA", "name": "British Airways", "logo": "https://images.kiwi.com/airlines/64/BA.png" },
  "TK": { "code": "TK", "name": "Turkish Airlines", "logo": "https://images.kiwi.com/airlines/64/TK.png" },
  "QF": { "code": "QF", "name": "Qantas", "logo": "https://images.kiwi.com/airlines/64/QF.png" },
  "UA": { "code": "UA", "name": "United Airlines", "logo": "https://images.kiwi.com/airlines/64/UA.png" },
  "AA": { "code": "AA", "name": "American Airlines", "logo": "https://images.kiwi.com/airlines/64/AA.png" },
  "DL": { "code": "DL", "name": "Delta Air Lines", "logo": "https://images.kiwi.com/airlines/64/DL.png" },
  "AK": { "code": "AK", "name": "AirAsia", "logo": "https://images.kiwi.com/airlines/64/AK.png" },
  "FD": { "code": "FD", "name": "Thai AirAsia", "logo": "https://images.kiwi.com/airlines/64/FD.png" },
  "D7": { "code": "D7", "name": "AirAsia X", "logo": "https://images.kiwi.com/airlines/64/D7.png" },
  "3U": { "code": "3U", "name": "Sichuan Airlines", "logo": "https://images.kiwi.com/airlines/64/3U.png" },
  "GJ": { "code": "GJ", "name": "Loong Air", "logo": "https://images.kiwi.com/airlines/64/GJ.png" },
  "GS": { "code": "GS", "name": "Tianjin Airlines", "logo": "https://images.kiwi.com/airlines/64/GS.png" },
  "HO": { "code": "HO", "name": "Juneyao Airlines", "logo": "https://images.kiwi.com/airlines/64/HO.png" },
  "MF": { "code": "MF", "name": "Xiamen Airlines", "logo": "https://images.kiwi.com/airlines/64/MF.png" },
  "ZH_SZ": { "code": "ZH", "name": "Shenzhen Airlines", "logo": "https://images.kiwi.com/airlines/64/ZH.png" },
};

export function getAirlineMeta(code?: string, airline?: string): AirlineMeta {
  const key = (code || '').toUpperCase();
  if (AIRLINE_META[key]) return AIRLINE_META[key];
  // fallback: search by airline name
  if (airline) {
    const found = Object.values(AIRLINE_META).find(m =>
      m.name.toLowerCase().includes(airline.toLowerCase()) ||
      airline.toLowerCase().includes(m.name.toLowerCase())
    );
    if (found) return found;
  }
  return { code: key, name: airline || key, logo: '' };
}
