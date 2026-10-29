import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CoffeeShop, FilterState, LocationPoint, NavigationState, NavigationLogEntry } from './types';
import { INITIAL_COFFEE_SHOPS } from './data/coffeeShops';
import { BARANGAYS_LIST, CALAMBA_LANDMARKS } from './data/calambaLandmarks';
import { MapView } from './components/MapView';
import { FilterBar } from './components/FilterBar';
import { CoffeeCard } from './components/CoffeeCard';
import { CoffeeDetailsModal } from './components/CoffeeDetailsModal';
import { NavigationView } from './components/NavigationView';
import { BottomNav } from './components/BottomNav';
import { AdminPortal } from './components/AdminPortal';
import { AdminLoginModal } from './components/AdminLoginModal';
import { IsoEvaluationModal } from './components/IsoEvaluationModal';
import { ResearchInfoModal } from './components/ResearchInfoModal';
import { generateRoute, fetchLiveRoute, isShopOpen } from './utils/routing';
import { loadCoffeeShopsFromSheet, sendCoffeeShopMutation } from './utils/googleSheets';
import { updateAdminPassword } from './utils/adminAuth';
import {
  Coffee,
  Award,
  GraduationCap,
  MapPin
} from 'lucide-react';

const COFFEE_SHOPS_STORAGE_KEY = 'brewbound_cafes_data_v4';

const getPriceBounds = (priceRange: string, fallbackMin: number, fallbackMax: number) => {
  const prices = priceRange.match(/\d+(?:\.\d+)?/g)?.map(Number) ?? [];

  if (prices.length === 0) {
    return { minPrice: fallbackMin, maxPrice: fallbackMax };
  }

  return {
    minPrice: prices[0],
    maxPrice: prices[1] ?? prices[0],
  };
};

const getOperatingTimeBounds = (hoursText: string, fallbackOpening: string, fallbackClosing: string) => {
  const hasValidTimeFields = /^\d{2}:\d{2}$/.test(fallbackOpening) && /^\d{2}:\d{2}$/.test(fallbackClosing);
  if (hasValidTimeFields) {
    return { openingTime: fallbackOpening, closingTime: fallbackClosing };
  }

  const times = [...hoursText.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/gi)].map((match) => {
    let hour = Number(match[1]);
    const minute = Number(match[2] ?? 0);
    const period = match[3].toUpperCase();

    if (period === 'AM' && hour === 12) hour = 0;
    if (period === 'PM' && hour !== 12) hour += 12;

    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });

  return {
    openingTime: times[0] ?? fallbackOpening,
    closingTime: times[1] ?? fallbackClosing,
  };
};

const formatOperatingTime = (time: string) => {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  const minute = minuteText ?? '00';
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;

  return `${displayHour}:${minute} ${period}`;
};

const mergeSheetShop = (
  sheetShop: Partial<CoffeeShop>,
  localShop: CoffeeShop | undefined,
  fallbackShop: CoffeeShop,
): CoffeeShop => ({
  ...fallbackShop,
  ...localShop,
  ...sheetShop,
  bannerImage: sheetShop.bannerImage || localShop?.bannerImage || fallbackShop.bannerImage,
  galleryImages: sheetShop.galleryImages?.length
    ? sheetShop.galleryImages
    : localShop?.galleryImages ?? fallbackShop.galleryImages ?? [],
  panorama360Url: sheetShop.panorama360Url || localShop?.panorama360Url || fallbackShop.panorama360Url,
  amenities: sheetShop.amenities ?? localShop?.amenities ?? fallbackShop.amenities,
  menu: sheetShop.menu ?? localShop?.menu ?? fallbackShop.menu,
  reviews: sheetShop.reviews ?? localShop?.reviews ?? fallbackShop.reviews,
});

export default function App() {
  const [portalMode, setPortalMode] = useState<'user' | 'admin'>('user');
  const [showAdminLoginModal, setShowAdminLoginModal] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() => {
    try {
      return typeof window !== 'undefined' &&
        sessionStorage.getItem('brewbound_admin_session') === 'authenticated';
    } catch (error) {
      console.warn('Could not restore the local admin session:', error);
      return false;
    }
  });
  const [catalogueError, setCatalogueError] = useState<string | null>(null);

  const [coffeeShops, setCoffeeShops] = useState<CoffeeShop[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(COFFEE_SHOPS_STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const savedShops = parsed.map((shop) => ({
            ...shop,
            galleryImages: Array.isArray(shop.galleryImages) &&
              shop.galleryImages.length === 1 &&
              shop.galleryImages[0] === shop.bannerImage
              ? []
              : shop.galleryImages ?? [],
          }));
          return savedShops;
        }
      }
    } catch (e) {
      console.warn('Failed to load coffee shops from localStorage:', e);
    }
    return INITIAL_COFFEE_SHOPS;
  });
  const coffeeShopsRef = useRef(coffeeShops);
  coffeeShopsRef.current = coffeeShops;

  useEffect(() => {
    let active = true;

    const loadSharedCoffeeShops = async () => {
      const sheetResponse = await loadCoffeeShopsFromSheet();
      if (!active) return;

      if (!sheetResponse?.success) {
        console.warn('Google Sheets returned no catalogue; keeping the browser’s saved shop data.');
        return;
      }

      if (!sheetResponse.initialized) {
        const initialized = await sendCoffeeShopMutation({
          action: 'replaceAll',
          shops: coffeeShopsRef.current,
        });
        if (!active) return;
        if (!initialized) {
          console.warn('Google Sheets did not confirm catalogue initialization.');
          return;
        }

        const initializedResponse = await loadCoffeeShopsFromSheet();
        if (!active) return;
        if (!initializedResponse?.success) {
          console.warn('Google Sheets did not return the initialized catalogue.');
          return;
        }
        sheetResponse.shops = initializedResponse.shops;
      }

      const localShopsById = new Map(
        [...INITIAL_COFFEE_SHOPS, ...coffeeShopsRef.current].map((shop) => [shop.id, shop]),
      );
      const defaultShop = INITIAL_COFFEE_SHOPS[0];
      const shopsFromSheet = sheetResponse.shops.map((shop) =>
        mergeSheetShop(shop, localShopsById.get(shop.id), defaultShop),
      );

      setCoffeeShops(shopsFromSheet);
      setCatalogueError(null);
    };

    void loadSharedCoffeeShops().catch((error: unknown) => {
      console.error('Could not load coffee shops from Google Sheets:', error);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const refreshFromGoogleSheet = async () => {
      try {
        const response = await loadCoffeeShopsFromSheet();
        if (!active || !response?.success || !response.initialized) return;

        const localShopsById = new Map(
          [...INITIAL_COFFEE_SHOPS, ...coffeeShopsRef.current].map((shop) => [shop.id, shop]),
        );
        const defaultShop = INITIAL_COFFEE_SHOPS[0];
        const shopsFromSheet = response.shops.map((shop) =>
          mergeSheetShop(shop, localShopsById.get(shop.id), defaultShop),
        );
        setCoffeeShops(shopsFromSheet);
      } catch (error) {
        console.error('Could not refresh coffee shops from Google Sheets:', error);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshFromGoogleSheet();
    };
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshFromGoogleSheet();
    }, 30000);

    window.addEventListener('focus', handleVisibilityChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('brewbound_saved_favorites') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load favorites from localStorage:', e);
    }
    return [];
  });

  const [selectedShop, setSelectedShop] = useState<CoffeeShop | null>(null);

  const [navigationLogs, setNavigationLogs] = useState<NavigationLogEntry[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('brewbound_navigation_logs') : null;
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to load navigation logs from localStorage:', e);
    }
    return [
      {
        id: 'nav-log-1',
        shopId: 'cafe-1',
        shopName: 'Grounded Cafe',
        barangayId: 2,
        barangayName: 'Barangay 2',
        timestamp: '2026-08-24 14:32',
        travelMode: 'walking',
        originName: 'City College of Calamba (CCC Main)',
      },
      {
        id: 'nav-log-2',
        shopId: 'cafe-3',
        shopName: 'Daily Brew Calamba',
        barangayId: 6,
        barangayName: 'Barangay 6',
        timestamp: '2026-08-24 16:15',
        travelMode: 'walking',
        originName: 'City College of Calamba (CCC Main)',
      },
      {
        id: 'nav-log-3',
        shopId: 'cafe-2',
        shopName: 'Cafe Artisan',
        barangayId: 4,
        barangayName: 'Barangay 4',
        timestamp: '2026-08-25 09:20',
        travelMode: 'tricycle',
        originName: 'Calamba City Hall (Chipeco Ave)',
      },
    ];
  });

  const [userLocation, setUserLocation] = useState<LocationPoint>(CALAMBA_LANDMARKS[0]);
  const [activeTab, setActiveTab] = useState<'home' | 'search' | 'favorites'>('home');
  const [showIsoModal, setShowIsoModal] = useState(false);
  const [showResearchModal, setShowResearchModal] = useState(false);
  const [, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;

    let watchId: number | null = null;

    const updateUserLocation = (position: GeolocationPosition) => {
      setUserLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        name: '📍 My Live GPS Location',
        accuracy: position.coords.accuracy,
      });
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateUserLocation(position);
        watchId = navigator.geolocation.watchPosition(
          updateUserLocation,
          (error) => console.warn('Automatic location tracking failed:', error.message),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
      },
      (error) => {
        console.warn('Automatic location detection failed:', error.message);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      },
    );

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    barangay: 'all',
    requireOutlets: false,
    minOutlets: 0,
    requireWifi: false,
    minWifiSpeed: 0,
    requireAC: false,
    openNowOnly: false,
    priceCategory: 'all',
    noiseLevel: 'all',
  });

  const [navigationState, setNavigationState] = useState<NavigationState>({
    isActive: false,
    destinationShop: null,
    originLocation: CALAMBA_LANDMARKS[0],
    travelMode: 'walking',
    routePoints: [],
    totalDistanceKm: 0,
    estimatedTimeMins: 0,
    steps: [],
    currentStepIndex: 0,
    simulatedProgress: 0,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowAdminLoginModal(true);
      } else if (e.altKey && (e.key === 'A' || e.key === 'a')) {
        e.preventDefault();
        setShowAdminLoginModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const checkAdminRoute = () => {
      const hasAdminHash = window.location.hash === '#admin';
      const hasAdminQuery = new URLSearchParams(window.location.search).get('admin') === 'true';
      if (hasAdminHash || hasAdminQuery) {
        if (isAdminAuthenticated) {
          setPortalMode('admin');
        } else {
          setShowAdminLoginModal(true);
        }
      }
    };

    checkAdminRoute();
    window.addEventListener('hashchange', checkAdminRoute);
    return () => window.removeEventListener('hashchange', checkAdminRoute);
  }, [isAdminAuthenticated]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(COFFEE_SHOPS_STORAGE_KEY, JSON.stringify(coffeeShops));
      }
    } catch (e) {
      console.warn('Could not write coffee shops to localStorage:', e);
      setCatalogueError('Could not save shop changes in this browser. Check available storage and try again.');
    }
  }, [coffeeShops]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('brewbound_saved_favorites', JSON.stringify(favorites));
      }
    } catch (e) {
      console.warn('Could not write favorites to localStorage:', e);
    }
  }, [favorites]);

  useEffect(() => {
    setFavorites((previousFavorites) => {
      const validFavorites = previousFavorites.filter((favoriteId) =>
        coffeeShops.some((shop) => shop.id === favoriteId)
      );

      return validFavorites.length === previousFavorites.length ? previousFavorites : validFavorites;
    });
  }, [coffeeShops]);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('brewbound_navigation_logs', JSON.stringify(navigationLogs));
      }
    } catch (e) {
      console.warn('Could not write navigation logs to localStorage:', e);
    }
  }, [navigationLogs]);

  const filteredShops = useMemo(() => {
    return coffeeShops.filter((shop) => {
      if (activeTab === 'favorites' && !favorites.includes(shop.id)) {
        return false;
      }

      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesName = shop.name.toLowerCase().includes(query);
        const barangay = BARANGAYS_LIST.find((item) => item.id === shop.barangayId);
        const matchesBgy = [shop.barangayName, barangay?.name, barangay?.shortName]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query));
        const matchesLandmark = shop.landmark.toLowerCase().includes(query);
        const matchesMenu = shop.menu.some((m) => m.name.toLowerCase().includes(query));
        if (!matchesName && !matchesBgy && !matchesLandmark && !matchesMenu) {
          return false;
        }
      }

      if (filters.barangay !== 'all' && shop.barangayId !== filters.barangay) {
        return false;
      }

      if (filters.requireOutlets && shop.amenities.outletCount < (filters.minOutlets || 1)) {
        return false;
      }

      if (filters.requireWifi && (!shop.amenities.wifiAvailable || shop.amenities.wifiSpeedMbps < filters.minWifiSpeed)) {
        return false;
      }

      if (filters.requireAC && !shop.amenities.acAvailable) {
        return false;
      }

      if (filters.openNowOnly && !isShopOpen(shop.openingTime, shop.closingTime, shop.daysOpen)) {
        return false;
      }

      if (filters.priceCategory === 'budget' && shop.minPrice > 98) return false;
      if (filters.priceCategory === 'premium' && shop.minPrice <= 99) return false;

      if (filters.noiseLevel !== 'all' && shop.amenities.noiseLevel !== filters.noiseLevel) {
        return false;
      }

      return true;
    });
  }, [coffeeShops, filters, activeTab, favorites]);

  const validFavoritesCount = favorites.filter((favoriteId) =>
    coffeeShops.some((shop) => shop.id === favoriteId)
  ).length;

  const handleToggleFavorite = (e: React.MouseEvent | null, shopId: string) => {
    if (e) e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(shopId) ? prev.filter((id) => id !== shopId) : [...prev, shopId]
    );
  };

  const handleStartNavigation = async (shop: CoffeeShop) => {
    setCoffeeShops((prev) =>
      prev.map((s) =>
        s.id === shop.id
          ? { ...s, navigationCount: (s.navigationCount || 0) + 1 }
          : s
      )
    );

    const newLog: NavigationLogEntry = {
      id: `nav-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      shopId: shop.id,
      shopName: shop.name,
      barangayId: shop.barangayId,
      barangayName: shop.barangayName,
      timestamp: new Date().toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      travelMode: navigationState.travelMode,
      originName: userLocation.name,
    };
    setNavigationLogs((prev) => [newLog, ...prev]);

    const route = generateRoute(userLocation, shop, navigationState.travelMode);
    setNavigationState({
      isActive: true,
      destinationShop: shop,
      originLocation: userLocation,
      travelMode: navigationState.travelMode,
      routePoints: route.points,
      totalDistanceKm: route.totalDistanceKm,
      estimatedTimeMins: route.estimatedTimeMins,
      steps: route.steps,
      currentStepIndex: 0,
      simulatedProgress: 0,
    });
    setSelectedShop(null);

    try {
      const liveRoute = await fetchLiveRoute(userLocation, shop, navigationState.travelMode);
      setNavigationState((prev) => {
        if (!prev.isActive || prev.destinationShop?.id !== shop.id || prev.travelMode !== navigationState.travelMode) {
          return prev;
        }
        return {
          ...prev,
          routePoints: liveRoute.points,
          totalDistanceKm: liveRoute.totalDistanceKm,
          estimatedTimeMins: liveRoute.estimatedTimeMins,
          steps: liveRoute.steps,
        };
      });
    } catch {
      // Keep route
    }
  };

  const handleCancelNavigation = () => {
    setNavigationState((prev) => ({
      ...prev,
      isActive: false,
      destinationShop: null,
      routePoints: [],
    }));
  };

  const handleChangeTravelMode = async (mode: 'walking' | 'tricycle' | 'driving') => {
    if (!navigationState.destinationShop) return;
    const dest = navigationState.destinationShop;
    const origin = navigationState.originLocation;

    const route = generateRoute(origin, dest, mode);
    setNavigationState((prev) => ({
      ...prev,
      travelMode: mode,
      routePoints: route.points,
      totalDistanceKm: route.totalDistanceKm,
      estimatedTimeMins: route.estimatedTimeMins,
      steps: route.steps,
      currentStepIndex: 0,
    }));

    try {
      const liveRoute = await fetchLiveRoute(origin, dest, mode);
      setNavigationState((prev) => {
        if (prev.travelMode !== mode || prev.destinationShop?.id !== dest.id) return prev;
        return {
          ...prev,
          routePoints: liveRoute.points,
          totalDistanceKm: liveRoute.totalDistanceKm,
          estimatedTimeMins: liveRoute.estimatedTimeMins,
          steps: liveRoute.steps,
        };
      });
    } catch {
      // Keep route
    }
  };

  const handleChangeOrigin = async (origin: LocationPoint) => {
    setUserLocation(origin);
    if (navigationState.destinationShop) {
      const dest = navigationState.destinationShop;
      const route = generateRoute(origin, dest, navigationState.travelMode);
      setNavigationState((prev) => ({
        ...prev,
        originLocation: origin,
        routePoints: route.points,
        totalDistanceKm: route.totalDistanceKm,
        estimatedTimeMins: route.estimatedTimeMins,
        steps: route.steps,
      }));

      try {
        const liveRoute = await fetchLiveRoute(origin, dest, navigationState.travelMode);
        setNavigationState((prev) => {
          if (prev.originLocation.lat !== origin.lat || prev.originLocation.lng !== origin.lng) return prev;
          return {
            ...prev,
            originLocation: origin,
            routePoints: liveRoute.points,
            totalDistanceKm: liveRoute.totalDistanceKm,
            estimatedTimeMins: liveRoute.estimatedTimeMins,
            steps: liveRoute.steps,
          };
        });
      } catch {
        // Keep route
      }
    }
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchQuery: '',
      barangay: 'all',
      requireOutlets: false,
      minOutlets: 0,
      requireWifi: false,
      minWifiSpeed: 0,
      requireAC: false,
      openNowOnly: false,
      priceCategory: 'all',
      noiseLevel: 'all',
    });
  };

  const handleSaveShop = async (updatedShop: CoffeeShop): Promise<boolean> => {
    const priceBounds = getPriceBounds(updatedShop.priceRange, updatedShop.minPrice, updatedShop.maxPrice);
    const operatingTimeBounds = getOperatingTimeBounds(
      updatedShop.operatingHoursText,
      updatedShop.openingTime,
      updatedShop.closingTime,
    );
    const normalizedShop = {
      ...updatedShop,
      ...priceBounds,
      ...operatingTimeBounds,
      operatingHoursText: `${formatOperatingTime(operatingTimeBounds.openingTime)} - ${formatOperatingTime(operatingTimeBounds.closingTime)}`,
    };

    try {
      const exists = coffeeShops.some((shop) => shop.id === normalizedShop.id);
      const updatedShops = exists
        ? coffeeShops.map((shop) => shop.id === normalizedShop.id ? normalizedShop : shop)
        : [normalizedShop, ...coffeeShops];
      localStorage.setItem(COFFEE_SHOPS_STORAGE_KEY, JSON.stringify(updatedShops));
      setCoffeeShops(updatedShops);
      const synced = await sendCoffeeShopMutation({ action: 'upsert', shop: normalizedShop });
      if (!synced) {
        console.warn(`Google Sheets did not confirm saving coffee shop ${normalizedShop.id}.`);
      }
      setCatalogueError(null);
      return true;
    } catch (error) {
      console.error(`Could not save coffee shop ${normalizedShop.id} locally:`, error);
      setCatalogueError('Could not save this shop in browser storage. Check available storage and try again.');
      return false;
    }
  };

  const handleDeleteShop = async (shopId: string): Promise<boolean> => {
    try {
      const updatedShops = coffeeShops.filter((shop) => shop.id !== shopId);
      localStorage.setItem(COFFEE_SHOPS_STORAGE_KEY, JSON.stringify(updatedShops));
      setCoffeeShops(updatedShops);
      const synced = await sendCoffeeShopMutation({ action: 'delete', id: shopId });
      if (!synced) {
        console.warn(`Google Sheets did not confirm deleting coffee shop ${shopId}.`);
      }
      setCatalogueError(null);
      return true;
    } catch (error) {
      console.error(`Could not delete coffee shop ${shopId} locally:`, error);
      setCatalogueError('Could not delete this shop from browser storage. Try again.');
      return false;
    }
  };

  const handleResetDefaultData = async (): Promise<boolean> => {
    try {
      const resetShops = [...INITIAL_COFFEE_SHOPS];
      localStorage.setItem(COFFEE_SHOPS_STORAGE_KEY, JSON.stringify(resetShops));
      setCoffeeShops(resetShops);
      const synced = await sendCoffeeShopMutation({ action: 'replaceAll', shops: resetShops });
      if (!synced) {
        console.warn('Google Sheets did not confirm resetting the coffee shop catalogue.');
      }
      setCatalogueError(null);
      return true;
    } catch (error) {
      console.error('Could not reset the local coffee shop catalogue:', error);
      setCatalogueError('Could not reset the catalogue in browser storage. Try again.');
      return false;
    }
  };

  if (portalMode === 'admin') {
    return (
      <div className="w-screen h-screen overflow-hidden flex flex-col bg-slate-950">
        <AdminPortal
          coffeeShops={coffeeShops}
          catalogueError={catalogueError}
          navigationLogs={navigationLogs}
          onSaveShop={handleSaveShop}
          onDeleteShop={handleDeleteShop}
          onResetDefaultData={handleResetDefaultData}
          onSwitchToUserPortal={() => setPortalMode('user')}
          onLogout={() => {
            try {
              sessionStorage.removeItem('brewbound_admin_session');
            } catch (error) {
              console.warn('Could not clear the local admin session:', error);
            }
            setIsAdminAuthenticated(false);
            setPortalMode('user');
          }}
          onChangeAdminPassword={(password) => {
            try {
              updateAdminPassword(password);
              return true;
            } catch (error) {
              console.error('Could not save the local admin password:', error);
              return false;
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-dvh min-h-0 bg-slate-950 text-slate-900 flex flex-col font-sans select-none sm:select-auto overflow-hidden">

      {/* Header */}
      <header className="w-full px-3.5 sm:px-5 py-2.5 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white flex items-center justify-between shadow-lg z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-amber-900/40">
            ☕
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-wider text-base text-amber-400">
                BREWBOUND
              </span>
              <span className="text-[10px] font-semibold text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full hidden sm:inline border border-slate-700">
                Calamba Poblacion 1–7
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowResearchModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            title="View Academic Research Context & Team Details"
          >
            <GraduationCap className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">Research</span>
          </button>

          <button
            onClick={() => setShowIsoModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
            title="ISO/IEC 25010:2011 Software Quality Evaluation Form"
          >
            <Award className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">ISO 25010</span>
          </button>
        </div>
      </header>
      {catalogueError && (
        <div role="alert" className="px-4 py-2 bg-rose-950 text-rose-200 text-xs font-semibold border-b border-rose-800">
          {catalogueError}
        </div>
      )}

      {/* Main App Container */}
      <main className="w-full flex-1 min-h-0 flex flex-col bg-white overflow-hidden relative">

        {!navigationState.isActive && (
          <>
            <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between shrink-0 z-20">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-wider text-amber-400">
                  BREWBOUND
                </span>
                <span className="text-[10px] sm:text-xs text-slate-400 font-medium border-l border-slate-700 pl-2">
                  Cafe Discovery & GIS Navigation
                </span>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-semibold text-[11px] sm:text-xs">
                  {filters.barangay === 'all' ? 'Poblacion 1–7' : `Brgy ${filters.barangay}`}
                </span>
              </div>
            </div>

            <FilterBar
              filters={filters}
              onFilterChange={handleFilterChange}
              onResetFilters={handleResetFilters}
              resultCount={filteredShops.length}
            />
          </>
        )}

        {/* Center Main Stage Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative w-full h-full min-h-0">

          {/* Map Surface */}
          <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
            <MapView
              coffeeShops={filteredShops}
              selectedShop={selectedShop}
              onSelectShop={(shop) => setSelectedShop(shop)}
              userLocation={userLocation}
              navigationState={navigationState}
              onUpdateUserLocation={(newLoc) => {
                setUserLocation(newLoc);
                if (navigationState.isActive && navigationState.originLocation.name.includes('GPS')) {
                  handleChangeOrigin(newLoc);
                }
              }}
            />

            {navigationState.isActive && (
              <NavigationView
                navigationState={navigationState}
                onCancelNavigation={handleCancelNavigation}
                onChangeTravelMode={handleChangeTravelMode}
                onChangeOrigin={handleChangeOrigin}
              />
            )}
          </div>

          {/* Coffee Shop Cards List */}
          {!navigationState.isActive && (
            <div className="w-full md:w-[clamp(20rem,30vw,28rem)] h-[42%] min-h-[12rem] md:h-full bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 flex flex-col z-10 overflow-hidden shrink-0">
              <div className="sticky top-0 bg-slate-50/95 backdrop-blur-md px-4 py-2.5 border-b border-slate-200 flex items-center justify-between z-10 shrink-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                    {activeTab === 'favorites'
                      ? `Saved Favorites (${filteredShops.length})`
                      : `Nearby Verified Cafes (${filteredShops.length})`}
                  </h2>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">
                  Poblacion 1–7
                </span>
              </div>

              <div className="p-3 space-y-2.5 flex-1 overflow-y-auto">
                {filteredShops.length > 0 ? (
                  filteredShops.map((shop) => (
                    <CoffeeCard
                      key={shop.id}
                      shop={shop}
                      isSelected={selectedShop?.id === shop.id}
                      isFavorite={favorites.includes(shop.id)}
                      onSelect={(s) => setSelectedShop(s)}
                      onToggleFavorite={handleToggleFavorite}
                      onDirectNavigate={(e, s) => {
                        e.stopPropagation();
                        handleStartNavigation(s);
                      }}
                    />
                  ))
                ) : (
                  <div className="py-10 text-center text-slate-400 space-y-2">
                    <Coffee className="w-10 h-10 mx-auto text-slate-300 stroke-1" />
                    <p className="text-xs font-bold text-slate-600">
                      No coffee shops found matching criteria
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto">
                      Try resetting filters or expanding barangay search in Calamba.
                    </p>
                    <button
                      onClick={handleResetFilters}
                      className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-amber-700 transition-colors"
                    >
                      Reset All Filters
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {!navigationState.isActive && (
          <BottomNav
            activeTab={activeTab}
            onChangeTab={(tab) => {
              setActiveTab(tab);
              if (tab === 'home') handleResetFilters();
            }}
            favoritesCount={validFavoritesCount}
          />
        )}

        {selectedShop && !navigationState.isActive && (
          <CoffeeDetailsModal
            shop={selectedShop}
            isFavorite={favorites.includes(selectedShop.id)}
            onClose={() => setSelectedShop(null)}
            onToggleFavorite={(shopId) => handleToggleFavorite(null, shopId)}
            onStartNavigation={handleStartNavigation}
          />
        )}

        {showIsoModal && (
          <IsoEvaluationModal onClose={() => setShowIsoModal(false)} />
        )}

        {showResearchModal && (
          <ResearchInfoModal
            onClose={() => setShowResearchModal(false)}
            onOpenAdminLogin={() => setShowAdminLoginModal(true)}
          />
        )}

        {showAdminLoginModal && (
          <AdminLoginModal
            isOpen={showAdminLoginModal}
            onClose={() => setShowAdminLoginModal(false)}
            onSuccess={() => {
              try {
                sessionStorage.setItem('brewbound_admin_session', 'authenticated');
              } catch (error) {
                console.warn('Could not save the local admin session:', error);
              }
              setIsAdminAuthenticated(true);
              setPortalMode('admin');
              setShowAdminLoginModal(false);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="px-2 py-1.5 text-center text-[11px] text-slate-400 flex flex-wrap items-center justify-center gap-1.5 shrink-0 bg-slate-950">
        <span>BREWBOUND © 2026 • City College of Calamba • Poblacion</span>
      </footer>
    </div>
  );
}