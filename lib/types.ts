export type TripType = 'oneway' | 'roundtrip';
export type Cabin = 'economy' | 'premium' | 'business' | 'first';
export type SourceMode = 'auto';

export interface SearchPayload {
  from: string;
  to: string;
  date: string;
  returnDate?: string;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  tripType: TripType;
}

export interface FlightEndpoint {
  airport: string;
  airportName: string;
  city: string;
  time: string;
}

export interface FlightResult {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departure: FlightEndpoint;
  arrival: FlightEndpoint;
  duration: number;
  stops: number;
  price: {
    amount: number;
    currency: 'VND';
    source: string;
  };
  detailUrl?: string | null;
  fareBreakdown?: {
    baseAmount: number;
    taxesFees: number;
    totalAmount: number;
    currency: 'VND';
  };
  priceUSD: number;
  sources: string[];
}

export interface SearchResponse {
  searchId: string;
  results: FlightResult[];
  metadata: {
    totalResults: number;
    searchTime: number;
    cached?: boolean;
    sourceUsed?: string;
    engine?: string;
  };
}

export interface QuotePayload {
  tripType: 'oneway' | 'roundtrip';
  outbound: FlightResult;
  inbound?: FlightResult;
  adults: number;
  children: number;
  infants: number;
  cabin: Cabin;
  search: {
    from: string;
    to: string;
    date: string;
    returnDate?: string;
  };
  createdAt: string;
}
