import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import L from 'leaflet';
import { CoffeeShop, LocationPoint, NavigationState } from '../types';
import {
  Compass,
  LocateFixed,
  ZoomIn,
  ZoomOut,
  Layers,
  Check,
  Radio,
  AlertCircle,
  X
} from 'lucide-react';

interface MapViewProps {
  coffeeShops: CoffeeShop[];
  selectedShop: CoffeeShop | null;
  onSelectShop: (shop: CoffeeShop) => void;
  userLocation: LocationPoint;
  navigationState: NavigationState;
  onUpdateUserLocation: (loc: LocationPoint) => void;
}

// Convert route points safely to [lat, lng] array
function normalizeLatLngList(points: [number, number][] | any[]): [number, number][] {
  if (!points || !Array.isArray(points)) return [];
  return points
    .map((pt) => {
      if (!pt) return null;
      let lat: number, lng: number;
      if (Array.isArray(pt)) {
        lat = Number(pt[0]);
        lng = Number(pt[1]);
      } else {
        lat = Number((pt as any).lat);
        lng = Number((pt as any).lng);
      }
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return [lat, lng] as [number, number];
      }
      return null;
    })
    .filter((p): p is [number, number] => p !== null);
}

export const MapView: React.FC<MapViewProps> = ({
  coffeeShops,
  selectedShop,
  onSelectShop,
  userLocation,
  navigationState,
  onUpdateUserLocation,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routePolylineRef = useRef<L.Polyline | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);
  const destinationMarkerRef = useRef<L.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const hasAutoCenteredOnGpsRef = useRef(false);

  // Default Map Layer Style: OpenStreetMap Standard
  const [mapLayerStyle, setMapLayerStyle] = useState<
    'osm-standard' | 'osm-humanitarian' | 'osm-cyclosm' | 'esri-satellite' | 'carto-dark'
  >('osm-standard');

  const [showLayerMenu, setShowLayerMenu] = useState(false);

  // Live GPS Tracking State
  const [isGpsActive, setIsGpsActive] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [liveCoords, setLiveCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [deviceHeading, setDeviceHeading] = useState<number | null>(null);

  // Safe normalized route points
  const safeRoutePoints = useMemo(() => {
    return normalizeLatLngList(navigationState.routePoints);
  }, [navigationState.routePoints]);

  // OpenStreetMap Tile Configuration
  const getTileConfig = (style: typeof mapLayerStyle) => {
    switch (style) {
      case 'osm-standard':
        return {
          url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          maxZoom: 19,
          subdomains: 'abc',
          attribution: '© OpenStreetMap contributors',
          name: 'OpenStreetMap Standard',
        };
      case 'osm-humanitarian':
        return {
          url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
          maxZoom: 19,
          subdomains: 'abc',
          attribution: '© OpenStreetMap contributors, Humanitarian OSM Team',
          name: 'OSM Humanitarian (HOT)',
        };
      case 'osm-cyclosm':
        return {
          url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
          maxZoom: 20,
          subdomains: 'abc',
          attribution: '© OpenStreetMap contributors, CyclOSM',
          name: 'CyclOSM (Walkways & Streets)',
        };
      case 'esri-satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          maxZoom: 19,
          subdomains: '',
          attribution: '© Esri, Maxar, OpenStreetMap contributors',
          name: 'Satellite View (Aerial)',
        };
      case 'carto-dark':
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          maxZoom: 20,
          subdomains: 'abcd',
          attribution: '© OpenStreetMap contributors, CARTO',
          name: 'Dark Night Mode (OSM Data)',
        };
    }
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Destroy existing map instance to prevent duplicate container errors
    if (mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) {
        console.warn('Map cleanup error:', e);
      }
      mapInstanceRef.current = null;
    }

    if ((mapContainerRef.current as any)._leaflet_id) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }

    let resizeObserver: ResizeObserver | null = null;
    const timers: NodeJS.Timeout[] = [];

    try {
      const map = L.map(mapContainerRef.current, {
        center: [userLocation.lat, userLocation.lng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      const config = getTileConfig(mapLayerStyle);
      const tileLayer = L.tileLayer(config.url, {
        maxZoom: config.maxZoom,
        subdomains: config.subdomains || 'abc',
        crossOrigin: true,
      }).addTo(map);

      tileLayerRef.current = tileLayer;
      markersLayerRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Force canvas recalculation across multiple intervals
      timers.push(
        setTimeout(() => map.invalidateSize(), 50),
        setTimeout(() => map.invalidateSize(), 200),
        setTimeout(() => map.invalidateSize(), 500),
        setTimeout(() => map.invalidateSize(), 1000)
      );

      // Attach ResizeObserver to keep canvas sized when containers or panels change
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }

      const handleWindowResize = () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      };
      window.addEventListener('resize', handleWindowResize);

    } catch (err) {
      console.warn('Failed to initialize Leaflet Map:', err);
    }

    return () => {
      timers.forEach((t) => clearTimeout(t));
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.clearWatch(watchIdRef.current);
        } catch (e) { }
        watchIdRef.current = null;
      }
      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
        } catch (e) { }
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Switch Tile Layers
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      tileLayerRef.current.remove();
    }

    const config = getTileConfig(mapLayerStyle);
    const newLayer = L.tileLayer(config.url, {
      maxZoom: config.maxZoom,
      subdomains: config.subdomains || 'abc',
      crossOrigin: true,
    }).addTo(map);

    tileLayerRef.current = newLayer;
  }, [mapLayerStyle]);

  // 3. Handle Responsive Resizing when Navigation state toggles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 120);
    return () => clearTimeout(timer);
  }, [navigationState.isActive]);

  // Center the map when automatic browser geolocation finds the user.
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || hasAutoCenteredOnGpsRef.current || !userLocation.name.includes('GPS')) return;

    hasAutoCenteredOnGpsRef.current = true;
    map.flyTo([userLocation.lat, userLocation.lng], 17, {
      duration: 1,
    });
  }, [userLocation]);

  // Read the device compass so the marker can show which way the user faces.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      const compassHeading = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      const heading = typeof compassHeading === 'number'
        ? compassHeading
        : event.absolute && typeof event.alpha === 'number'
          ? (360 - event.alpha) % 360
          : null;

      if (heading !== null && Number.isFinite(heading)) {
        setDeviceHeading(heading);
      }
    };

    window.addEventListener('deviceorientationabsolute', handleOrientation as EventListener);
    window.addEventListener('deviceorientation', handleOrientation as EventListener);

    return () => {
      window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      window.removeEventListener('deviceorientation', handleOrientation as EventListener);
    };
  }, []);

  // 4. Update User Location Marker & Accuracy Circle
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const activePoint = liveCoords || (navigationState.isActive ? navigationState.originLocation : userLocation);
    if (!activePoint || !Number.isFinite(activePoint.lat) || !Number.isFinite(activePoint.lng)) return;

    const isLiveGps = (isGpsActive && liveCoords !== null) || userLocation.name.includes('GPS');
    const effectiveAccuracy = gpsAccuracy ?? userLocation.accuracy ?? null;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }

    const headingIndicator = deviceHeading !== null
      ? `
          <div class="absolute -top-7 left-1/2 h-8 w-4 -translate-x-1/2 pointer-events-none" style="transform: translateX(-50%) rotate(${deviceHeading}deg); transform-origin: 50% 100%;">
            <div class="mx-auto h-6 w-1 rounded-full bg-amber-400 shadow-md"></div>
            <div class="mx-auto -mt-1 h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent border-b-amber-400"></div>
          </div>
        `
      : '';

    const markerHtml = isLiveGps
      ? `
        <div class="relative flex items-center justify-center pointer-events-auto cursor-pointer group">
          ${headingIndicator}
          <div class="absolute w-12 h-12 bg-blue-500 rounded-full animate-ping opacity-30"></div>
          <div class="absolute w-8 h-8 bg-blue-400 rounded-full animate-pulse opacity-50"></div>
          <div class="relative w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-2xl flex items-center justify-center ring-4 ring-blue-400/40">
            <div class="w-2.5 h-2.5 bg-white rounded-full shadow-inner animate-pulse"></div>
          </div>
          <div class="absolute -top-8 whitespace-nowrap bg-blue-950 text-blue-100 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-lg border border-blue-400 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
            <span>YOU ARE HERE (LIVE GPS)</span>
          </div>
        </div>
      `
      : `
        <div class="relative flex items-center justify-center pointer-events-auto">
          ${headingIndicator}
          <div class="absolute w-8 h-8 bg-blue-500 rounded-full animate-ping opacity-40"></div>
          <div class="relative w-6 h-6 bg-blue-600 rounded-full border-2 border-white shadow-xl flex items-center justify-center">
            <div class="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <div class="absolute -top-7 whitespace-nowrap bg-slate-900 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md border border-slate-700 pointer-events-none">
            ${userLocation.name}
          </div>
        </div>
      `;

    const userIcon = L.divIcon({
      className: 'custom-live-user-marker',
      html: markerHtml,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    userMarkerRef.current = L.marker([activePoint.lat, activePoint.lng], {
      icon: userIcon,
      zIndexOffset: 1200,
    }).addTo(map);

    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.remove();
      accuracyCircleRef.current = null;
    }

    if (isLiveGps && effectiveAccuracy && effectiveAccuracy > 0) {
      accuracyCircleRef.current = L.circle([activePoint.lat, activePoint.lng], {
        radius: Math.min(effectiveAccuracy, 200),
        color: '#3b82f6',
        fillColor: '#60a5fa',
        fillOpacity: 0.15,
        weight: 1.5,
        dashArray: '4, 4',
      }).addTo(map);
    }
  }, [userLocation, liveCoords, isGpsActive, gpsAccuracy, deviceHeading, navigationState.isActive, navigationState.originLocation]);

  // 5. Update Coffee Shop Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    if (!map || !markersLayer) return;

    markersLayer.clearLayers();

    if (destinationMarkerRef.current) {
      destinationMarkerRef.current.remove();
      destinationMarkerRef.current = null;
    }

    if (navigationState.isActive && navigationState.destinationShop) {
      const dest = navigationState.destinationShop;
      if (Number.isFinite(dest.lat) && Number.isFinite(dest.lng)) {
        const destIcon = L.divIcon({
          className: 'custom-shop-marker',
          html: `
            <div class="relative flex flex-col items-center">
              <div class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white shadow-2xl border-2 border-white ring-2 ring-red-400">
                <span class="text-xs">🏁</span>
                <span class="text-xs font-extrabold tracking-tight">${dest.name}</span>
              </div>
              <div class="w-3 h-3 bg-red-600 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white"></div>
            </div>
          `,
          iconSize: [140, 42],
          iconAnchor: [70, 38],
        });

        destinationMarkerRef.current = L.marker([dest.lat, dest.lng], {
          icon: destIcon,
          zIndexOffset: 1100,
        }).addTo(map);
      }
      return;
    }

    coffeeShops.forEach((shop) => {
      if (!Number.isFinite(shop.lat) || !Number.isFinite(shop.lng)) return;
      const isSelected = selectedShop?.id === shop.id;

      const shopIcon = L.divIcon({
        className: 'custom-shop-marker',
        html: `
          <div class="relative group cursor-pointer transition-transform duration-200 hover:scale-110 ${isSelected ? 'scale-125 z-50' : 'z-20'
          }">
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full shadow-lg border ${isSelected
            ? 'bg-amber-600 text-white border-amber-400 ring-2 ring-amber-300'
            : 'bg-white text-slate-800 border-amber-200 hover:border-amber-400'
          }">
              <span class="text-xs">☕</span>
              <span class="text-[11px] font-bold tracking-tight truncate max-w-[85px]">${shop.name}</span>
              ${shop.rating > 0 ? `<span class="text-[10px] ${isSelected ? 'text-amber-100 font-semibold' : 'text-amber-700 font-semibold'}">${shop.rating}★</span>` : ''}
            </div>
            <div class="w-2 h-2 bg-amber-600 rotate-45 mx-auto -mt-1 shadow-sm"></div>
          </div>
        `,
        iconSize: [110, 34],
        iconAnchor: [55, 30],
      });

      const marker = L.marker([shop.lat, shop.lng], { icon: shopIcon });
      marker.on('click', () => {
        onSelectShop(shop);
      });

      markersLayer.addLayer(marker);
    });
  }, [coffeeShops, selectedShop, onSelectShop, navigationState.isActive, navigationState.destinationShop]);

  // 6. Update Route Polyline & Fit Map Bounds
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (routePolylineRef.current) {
      routePolylineRef.current.remove();
      routePolylineRef.current = null;
    }

    if (navigationState.isActive && safeRoutePoints.length > 1) {
      const polyline = L.polyline(safeRoutePoints, {
        color: '#2563eb',
        weight: 6,
        opacity: 0.95,
        dashArray: navigationState.travelMode === 'walking' ? '8, 8' : undefined,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map);

      routePolylineRef.current = polyline;

      try {
        const bounds = L.latLngBounds(safeRoutePoints);
        if (bounds.isValid()) {
          setTimeout(() => {
            map.invalidateSize();
            map.fitBounds(bounds, {
              paddingTopLeft: [40, 90],
              paddingBottomRight: [40, 160],
              maxZoom: 17,
              animate: true,
            });
          }, 80);
        }
      } catch (err) {
        console.warn('Map bounds calculation warning:', err);
      }
    } else if (selectedShop && Number.isFinite(selectedShop.lat) && Number.isFinite(selectedShop.lng)) {
      map.flyTo([selectedShop.lat, selectedShop.lng], 17, {
        duration: 0.8,
      });
    }
  }, [navigationState.isActive, safeRoutePoints, selectedShop, navigationState.travelMode]);

  // Trigger GPS Geolocation
  const handleToggleGPS = useCallback(() => {
    setGpsError(null);
    if (isLocating) return;

    if (!('geolocation' in navigator)) {
      setGpsError('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);

    const orientationEvent = DeviceOrientationEvent as typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (typeof orientationEvent.requestPermission === 'function') {
      orientationEvent.requestPermission().catch(() => {
        // Compass permission is optional; GPS can still work without it.
      });
    }

    const geoOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy || 10);

        const newLoc: LocationPoint = {
          lat,
          lng,
          name: '📍 My Live GPS Location',
          accuracy,
        };

        setLiveCoords({ lat, lng });
        setGpsAccuracy(accuracy);
        setIsGpsActive(true);
        setIsLocating(false);

        onUpdateUserLocation(newLoc);

        mapInstanceRef.current?.flyTo([lat, lng], 17, {
          duration: 1.0,
        });

        if (watchIdRef.current !== null) {
          navigator.geolocation.clearWatch(watchIdRef.current);
        }

        watchIdRef.current = navigator.geolocation.watchPosition(
          (watchPos) => {
            const wLat = watchPos.coords.latitude;
            const wLng = watchPos.coords.longitude;
            const wAcc = Math.round(watchPos.coords.accuracy || 10);

            setLiveCoords({ lat: wLat, lng: wLng });
            setGpsAccuracy(wAcc);

            const updatedLoc: LocationPoint = {
              lat: wLat,
              lng: wLng,
              name: '📍 My Live GPS Location',
              accuracy: wAcc,
            };
            onUpdateUserLocation(updatedLoc);
          },
          (watchErr) => {
            console.warn('WatchPosition error:', watchErr);
          },
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0,
          }
        );
      },
      (err) => {
        setIsLocating(false);
        console.warn('Geolocation error:', err);
        let errorText = 'Unable to retrieve location.';
        if (err.code === err.PERMISSION_DENIED) {
          errorText = 'Location permission denied by browser.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          errorText = 'GPS signal unavailable.';
        } else if (err.code === err.TIMEOUT) {
          errorText = 'Location request timed out.';
        }
        setGpsError(errorText);
        mapInstanceRef.current?.flyTo([userLocation.lat, userLocation.lng], 16);
      },
      geoOptions
    );
  }, [isLocating, onUpdateUserLocation, userLocation]);

  const handleRecenter = () => {
    if (mapInstanceRef.current) {
      if (navigationState.isActive && safeRoutePoints.length > 1) {
        const bounds = L.latLngBounds(safeRoutePoints);
        if (bounds.isValid()) {
          mapInstanceRef.current.fitBounds(bounds, {
            paddingTopLeft: [40, 90],
            paddingBottomRight: [40, 160],
          });
        }
      } else {
        const target = liveCoords || userLocation;
        mapInstanceRef.current.flyTo([target.lat, target.lng], 17, {
          duration: 0.6,
        });
      }
    }
  };

  const currentConfig = getTileConfig(mapLayerStyle);

  return (
    <div className="relative w-full h-full min-h-0 min-w-0 font-sans overflow-hidden bg-slate-100 flex-1">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full z-0" />

      {/* Floating GPS Banner */}
      {isGpsActive && liveCoords && !navigationState.isActive && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-auto">
          <div className="bg-blue-900/90 backdrop-blur-md text-white px-3 py-1.5 rounded-full shadow-xl border border-blue-400/60 flex items-center gap-2 text-xs">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span className="font-bold text-[11px] text-blue-100">
              Live GPS Pin Active {gpsAccuracy ? `(±${gpsAccuracy}m)` : ''}
            </span>
            <button
              onClick={handleRecenter}
              className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-[10px] font-extrabold rounded-full transition-colors ml-1"
            >
              Center
            </button>
          </div>
        </div>
      )}

      {/* GPS Error Notification */}
      {gpsError && (
        <div className="absolute top-3 left-4 right-4 sm:left-auto sm:right-14 z-30 max-w-sm bg-rose-900/95 text-white p-3 rounded-2xl shadow-2xl border border-rose-500/80 backdrop-blur-md">
          <div className="flex items-start gap-2 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-rose-100">Location Notice</div>
              <div className="text-[11px] text-rose-200 mt-0.5 leading-tight">{gpsError}</div>
            </div>
            <button
              onClick={() => setGpsError(null)}
              className="p-1 text-rose-300 hover:text-white rounded-lg"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Map Control Buttons */}
      <div
        className={`absolute ${navigationState.isActive ? 'top-20' : 'top-3'
          } right-3 z-20 flex flex-col gap-1.5 transition-all`}
      >
        <button
          onClick={handleToggleGPS}
          disabled={isLocating}
          title={isGpsActive ? 'GPS Active - Click to Re-center Pin' : 'Find My Live Location'}
          className={`p-2.5 rounded-xl shadow-lg border transition-all relative ${isGpsActive
            ? 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-300 shadow-blue-500/30'
            : isLocating
              ? 'bg-amber-500 text-white border-amber-400 animate-pulse'
              : 'bg-white/95 backdrop-blur-md text-slate-700 hover:text-blue-600 hover:bg-white border-slate-200'
            }`}
        >
          {isLocating ? (
            <Radio className="w-4 h-4 animate-spin text-white" />
          ) : (
            <LocateFixed className={`w-4 h-4 ${isGpsActive ? 'text-white' : ''}`} />
          )}
          {isGpsActive && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border-2 border-white rounded-full"></span>
          )}
        </button>

        <button
          onClick={handleRecenter}
          title="Fit Route / Re-Center"
          className="p-2.5 bg-white/90 backdrop-blur-md text-slate-700 hover:text-amber-600 rounded-xl shadow-md border border-slate-200 hover:bg-white transition-colors"
        >
          <Compass className="w-4 h-4" />
        </button>

        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Switch OpenStreetMap Layer Style"
          className="p-2.5 bg-white/90 backdrop-blur-md text-slate-700 hover:text-emerald-600 rounded-xl shadow-md border border-slate-200 hover:bg-white transition-colors"
        >
          <Layers className="w-4 h-4" />
        </button>

        <div className="flex flex-col rounded-xl overflow-hidden shadow-md border border-slate-200 bg-white/90 backdrop-blur-md">
          <button
            onClick={() => mapInstanceRef.current?.zoomIn()}
            title="Zoom In"
            className="p-2 text-slate-700 hover:bg-white transition-colors border-b border-slate-200"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => mapInstanceRef.current?.zoomOut()}
            title="Zoom Out"
            className="p-2 text-slate-700 hover:bg-white transition-colors"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Layer Style Selector Badge */}
      <div className="absolute bottom-2 left-2 z-20 flex items-center gap-1.5">
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-900/85 hover:bg-slate-900 text-slate-200 text-[10px] font-medium rounded-lg backdrop-blur-md border border-slate-700 shadow-md transition-colors"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${isGpsActive ? 'bg-blue-400 animate-ping' : 'bg-emerald-400'}`}></span>
          <span>{isGpsActive ? '📍 GPS Live' : currentConfig.name}</span>
          <span className="text-[9px] text-amber-300 font-semibold bg-slate-800 px-1 rounded">OSM</span>
        </button>
      </div>

      {/* Map Layer Modal */}
      {showLayerMenu && (
        <div className="absolute bottom-10 left-2 z-40 w-64 bg-white rounded-2xl shadow-2xl border border-slate-300 p-3 text-xs">
          <div className="font-bold text-slate-900 mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Map Layer Style</span>
            </span>
            <button
              onClick={() => setShowLayerMenu(false)}
              className="text-slate-400 hover:text-slate-600 text-sm font-bold"
            >
              ✕
            </button>
          </div>

          <div className="space-y-1.5">
            {[
              { id: 'osm-standard', label: 'OpenStreetMap Standard', icon: '🗺️' },
              { id: 'osm-humanitarian', label: 'OSM Humanitarian', icon: '🏥' },
              { id: 'osm-cyclosm', label: 'CyclOSM Walk & Streets', icon: '🚲' },
              { id: 'esri-satellite', label: 'Esri Satellite', icon: '🛰️' },
              { id: 'carto-dark', label: 'Dark Mode', icon: '🌙' },
            ].map((layer) => {
              const isActive = mapLayerStyle === layer.id;
              return (
                <button
                  key={layer.id}
                  onClick={() => {
                    setMapLayerStyle(layer.id as any);
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left p-2 rounded-xl transition-colors flex items-center justify-between ${isActive
                    ? 'bg-amber-50 border border-amber-300 text-amber-950 font-bold'
                    : 'hover:bg-slate-50 border border-transparent text-slate-700'
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{layer.icon}</span>
                    <span className="text-[11px] font-bold">{layer.label}</span>
                  </div>
                  {isActive && <Check className="w-3.5 h-3.5 text-amber-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};