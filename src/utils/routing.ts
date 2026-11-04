import { LocationPoint, RouteStep, CoffeeShop } from '../types';
import { parseOperatingDays } from './operatingDays';

const TRAVEL_SPEED_KMH = {
  walking: 4.5,
  tricycle: 18,
  driving: 24,
} as const;

function calculateEstimatedTimeMins(
  distanceKm: number,
  travelMode: 'walking' | 'tricycle' | 'driving'
): number {
  const speedKmH = TRAVEL_SPEED_KMH[travelMode];
  return Math.max(1, Math.round((distanceKm / speedKmH) * 60));
}

// Haversine formula to compute great-circle distance between two points in kilometers
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) *
    Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100;
}

// Generate a fallback route while live routing is loading or unavailable.
export function generateRoute(
  origin: LocationPoint,
  destination: CoffeeShop,
  travelMode: 'walking' | 'tricycle' | 'driving'
): {
  points: [number, number][];
  totalDistanceKm: number;
  estimatedTimeMins: number;
  steps: RouteStep[];
} {
  if (travelMode === 'walking') return generateWalkingFallback(origin, destination);

  const directDist = calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng);

  // Real street road curvature factor (typically 1.25x to 1.35x direct straight distance in Poblacion grid)
  const totalDistanceKm = Math.max(0.2, Math.round(directDist * 1.28 * 10) / 10);

  const estimatedTimeMins = calculateEstimatedTimeMins(totalDistanceKm, travelMode);

  // Generate intermediate waypoint street bends matching Poblacion 1-7 Calamba street grid
  const latDiff = destination.lat - origin.lat;
  const lngDiff = destination.lng - origin.lng;

  // Intermediate corners along JP Rizal St, Burgos St, Pabalan St
  const midPoint1: [number, number] = [
    origin.lat + latDiff * 0.45,
    origin.lng + lngDiff * 0.1,
  ];
  const midPoint2: [number, number] = [
    origin.lat + latDiff * 0.55,
    origin.lng + lngDiff * 0.85,
  ];

  const points: [number, number][] = [
    [origin.lat, origin.lng],
    midPoint1,
    midPoint2,
    [destination.lat, destination.lng],
  ];

  const distanceInMeters = Math.round(totalDistanceKm * 1000);
  const seg1 = Math.round(distanceInMeters * 0.4);
  const seg2 = Math.round(distanceInMeters * 0.4);
  const seg3 = distanceInMeters - seg1 - seg2;

  const steps: RouteStep[] = [
    {
      instruction: `Depart from ${origin.name} heading toward ${destination.barangayName}`,
      distanceMeters: seg1,
      distanceText: `${seg1} m`,
      streetName: 'JP Rizal St / Poblacion Main Rd',
      iconType: 'start',
    },
    {
      instruction: `Turn toward ${destination.landmark || destination.address.split(',')[0]}`,
      distanceMeters: seg2,
      distanceText: `${seg2} m`,
      streetName: 'Burgos St / Pabalan Cor.',
      iconType: lngDiff > 0 ? 'turn-right' : 'turn-left',
    },
    {
      instruction: `Proceed straight ahead. ${destination.name} will be on your ${lngDiff >= 0 ? 'right' : 'left'}.`,
      distanceMeters: seg3,
      distanceText: `${seg3} m`,
      streetName: destination.address.split(',')[0],
      iconType: 'arrive',
    },
  ];

  return {
    points,
    totalDistanceKm,
    estimatedTimeMins,
    steps,
  };
}

// Free OpenStreetMap OSRM (Open Source Routing Machine) Live API Integration
type TravelMode = 'walking' | 'tricycle' | 'driving';

interface RouteResult {
  points: [number, number][];
  totalDistanceKm: number;
  estimatedTimeMins: number;
  steps: RouteStep[];
}

interface ValhallaResponse {
  trip?: {
    legs?: {
      shape?: string;
      summary?: { length?: number; time?: number };
      maneuvers?: {
        instruction?: string;
        length?: number;
        street_names?: string[];
      }[];
    }[];
  };
}

function decodePolyline6(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  const decodeValue = () => {
    let result = 0;
    let shift = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);

    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    latitude += decodeValue();
    longitude += decodeValue();
    points.push([latitude / 1e6, longitude / 1e6]);
  }

  return points;
}

function generateWalkingFallback(origin: LocationPoint, destination: CoffeeShop): RouteResult {
  const totalDistanceKm = Math.max(
    0.05,
    Math.round(calculateDistanceKm(origin.lat, origin.lng, destination.lat, destination.lng) * 100) / 100
  );
  const distanceMeters = Math.round(totalDistanceKm * 1000);

  return {
    points: [[origin.lat, origin.lng], [destination.lat, destination.lng]],
    totalDistanceKm,
    estimatedTimeMins: calculateEstimatedTimeMins(totalDistanceKm, 'walking'),
    steps: [{
      instruction: `Walk toward ${destination.name}`,
      distanceMeters,
      distanceText: `${distanceMeters} m`,
      streetName: 'Direct walking estimate',
      iconType: 'start',
    }],
  };
}

async function fetchValhallaWalkingRoute(
  origin: LocationPoint,
  destination: CoffeeShop
): Promise<RouteResult> {
  const request = {
    locations: [
      { lat: origin.lat, lon: origin.lng },
      { lat: destination.lat, lon: destination.lng },
    ],
    costing: 'pedestrian',
    units: 'kilometers',
    directions_options: { units: 'kilometers' },
  };
  const query = new URLSearchParams({ json: JSON.stringify(request) });
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(`https://valhalla1.openstreetmap.de/route?${query}`, {
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Pedestrian routing request failed');

    const data = await response.json() as ValhallaResponse;
    const leg = data.trip?.legs?.[0];
    const summary = leg?.summary;
    if (!leg?.shape || !summary || !Number.isFinite(summary.length) || !Number.isFinite(summary.time)) {
      throw new Error('Pedestrian routing response was incomplete');
    }

    const points = decodePolyline6(leg.shape);
    if (points.length < 2) throw new Error('Pedestrian route geometry was incomplete');

    const steps = (leg.maneuvers || []).map((maneuver, index): RouteStep => {
      const instruction = maneuver.instruction || 'Continue on the walking route';
      const normalizedInstruction = instruction.toLowerCase();
      const distanceMeters = Math.round((maneuver.length || 0) * 1000);
      let iconType: RouteStep['iconType'] = 'straight';

      if (index === 0) iconType = 'start';
      else if (normalizedInstruction.includes('destination')) iconType = 'arrive';
      else if (normalizedInstruction.includes('left')) iconType = 'turn-left';
      else if (normalizedInstruction.includes('right')) iconType = 'turn-right';

      return {
        instruction,
        distanceMeters,
        distanceText: distanceMeters >= 1000
          ? `${(distanceMeters / 1000).toFixed(1)} km`
          : `${distanceMeters} m`,
        streetName: maneuver.street_names?.[0] || 'Pedestrian path',
        iconType,
      };
    });

    return {
      points,
      totalDistanceKm: Math.round(summary.length * 100) / 100,
      estimatedTimeMins: Math.max(1, Math.round(summary.time / 60)),
      steps,
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchLiveRoute(
  origin: LocationPoint,
  destination: CoffeeShop,
  travelMode: TravelMode
): Promise<RouteResult> {
  if (travelMode === 'walking') {
    try {
      return await fetchValhallaWalkingRoute(origin, destination);
    } catch {
      return generateWalkingFallback(origin, destination);
    }
  }

  const url = `https://router.project-osrm.org/route/v1/car/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM returns coordinates in [lng, lat]
        const points: [number, number][] = route.geometry.coordinates.map(
          (coord: [number, number]) => [coord[1], coord[0]]
        );

        const totalDistKm = parseFloat((route.distance / 1000).toFixed(2));
        const estimatedTimeMins = calculateEstimatedTimeMins(totalDistKm, travelMode);

        const steps: RouteStep[] = route.legs?.[0]?.steps?.map((step: any, idx: number) => {
          let iconType: RouteStep['iconType'] = 'straight';
          const type = step.maneuver?.type;
          const modifier = step.maneuver?.modifier;

          if (idx === 0) iconType = 'start';
          else if (type === 'arrive') iconType = 'arrive';
          else if (modifier?.includes('left')) iconType = 'turn-left';
          else if (modifier?.includes('right')) iconType = 'turn-right';

          const distM = Math.round(step.distance);
          return {
            instruction: step.maneuver?.instruction || (step.name ? `Head along ${step.name}` : `Continue on road`),
            distanceMeters: distM,
            distanceText: distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`,
            streetName: step.name || 'Calamba Poblacion Street',
            iconType,
          };
        }) || [];

        return {
          points: points.length > 0 ? points : generateRoute(origin, destination, travelMode).points,
          totalDistanceKm: totalDistKm || generateRoute(origin, destination, travelMode).totalDistanceKm,
          estimatedTimeMins,
          steps: steps.length > 0 ? steps : generateRoute(origin, destination, travelMode).steps,
        };
      }
    }
  } catch (err) {
    // Graceful fallback to offline calibrated grid
  }

  return generateRoute(origin, destination, travelMode);
}

export function isShopOpen(openingTime: string, closingTime: string, daysOpen = 'Monday to Sunday'): boolean {
  try {
    if (!/^\d{2}:\d{2}$/.test(openingTime) || !/^\d{2}:\d{2}$/.test(closingTime)) {
      return false;
    }

    const operatingDays = parseOperatingDays(daysOpen);
    if (operatingDays.length > 0 && operatingDays.length < 7) {
      const currentDay = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        weekday: 'long',
      }).format(new Date()).toLowerCase();
      const currentDayIndex = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
        .indexOf(currentDay);
      if (!operatingDays.includes(currentDayIndex)) return false;
    }

    const [openH, openM] = openingTime.split(':').map(Number);
    const [closeH, closeM] = closingTime.split(':').map(Number);
    const manilaTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const currentHour = Number(manilaTime.find((part) => part.type === 'hour')?.value);
    const currentMinute = Number(manilaTime.find((part) => part.type === 'minute')?.value);

    const currentMinutes = (currentHour === 24 ? 0 : currentHour) * 60 + currentMinute;
    const openMinutes = openH * 60 + openM;
    const closeMinutes = closeH * 60 + closeM;

    if (closeMinutes <= openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  } catch {
    return true;
  }
}
