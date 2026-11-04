export interface AmenityData {
  wifiAvailable: boolean;
  wifiSpeedMbps: number;
  wifiType: string;
  wifiPasswordProvided: boolean;
  outletCount: number;
  outletCoveragePercent: string;
  acAvailable: boolean;
  noiseLevel: 'Quiet / Study-Friendly' | 'Moderate Social' | 'Energetic & Busy';
  seatingCapacity: number;
  parkingInfo: string;
  paymentMethods: string[];
  studyFriendlyScore: number; // 1-5
  verifiedDate: string;
  verifiedBy: string;
}

export interface MenuItem {
  name: string;
  price: number;
  category: 'Coffee' | 'Non-Coffee' | 'Food / Pastry' | 'Signature';
  popular?: boolean;
}

export interface CoffeeShop {
  id: string;
  name: string;
  barangayId: number; // 1 to 7
  barangayName: string;
  address: string;
  landmark: string;
  priceRange: string;
  minPrice: number;
  maxPrice: number;
  openingTime: string; // "08:00"
  closingTime: string; // "22:00"
  operatingHoursText: string; // "8:00 AM - 10:00 PM"
  daysOpen: string;
  lat: number;
  lng: number;
  rating: number;
  reviewCount: number;
  verified: boolean;
  bannerImage: string;
  galleryImages: string[];
  panorama360Url?: string; // 360-degree spherical/cylindrical interior view photo URL
  navigationCount?: number; // Total number of users who navigated to this cafe
  description: string;
  phone?: string;
  socials?: {
    facebook?: string;
    instagram?: string;
  };
  amenities: AmenityData;
  menu: MenuItem[];
  reviews: {
    id: string;
    userName: string;
    userType: 'Student' | 'Remote Worker' | 'Tourist' | 'Resident';
    rating: number;
    comment: string;
    date: string;
  }[];
}

export interface NavigationLogEntry {
  id: string;
  shopId: string;
  shopName: string;
  barangayId: number;
  barangayName: string;
  timestamp: string;
  travelMode: 'walking' | 'tricycle' | 'driving';
  originName: string;
}

export interface LocationPoint {
  lat: number;
  lng: number;
  name: string;
  accuracy?: number;
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  distanceText: string;
  streetName: string;
  iconType: 'straight' | 'turn-left' | 'turn-right' | 'arrive' | 'start';
}

export interface NavigationState {
  isActive: boolean;
  destinationShop: CoffeeShop | null;
  originLocation: LocationPoint;
  travelMode: 'walking' | 'tricycle' | 'driving';
  routePoints: [number, number][];
  totalDistanceKm: number;
  estimatedTimeMins: number;
  steps: RouteStep[];
  currentStepIndex: number;
  simulatedProgress: number; // 0 - 100%
}

export interface FilterState {
  searchQuery: string;
  barangay: number | 'all'; // 1-7 or 'all'
  requireOutlets: boolean;
  minOutlets: number;
  requireWifi: boolean;
  minWifiSpeed: number;
  requireAC: boolean;
  openNowOnly: boolean;
  priceCategory: 'all' | 'budget' | 'mid' | 'premium'; // budget <=98, premium >99
  noiseLevel: 'all' | 'Quiet / Study-Friendly' | 'Moderate Social';
}

export interface IsoEvaluationResponse {
  id: string;
  respondentType: 'Student' | 'Remote Worker' | 'Resident' | 'Tourist' | 'IT Instructor / Expert';
  submittedAt: string;
  functionalSuitability: number; // 1-5
  performanceEfficiency: number; // 1-5
  reliability: number; // 1-5
  usability: number; // 1-5
  feedback: string;
}
