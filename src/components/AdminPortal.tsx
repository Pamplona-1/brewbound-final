import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { CoffeeShop, NavigationLogEntry } from '../types';
import { BARANGAYS_LIST } from '../data/calambaLandmarks';
import { parseOperatingDays } from '../utils/operatingDays';
import { DEFAULT_ADMIN_PASSWORD } from '../utils/adminAuth';
import { PanoramaViewer } from './PanoramaViewer';
import {
  Database,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  Zap,
  Snowflake,
  MapPin,
  Save,
  Download,
  RotateCcw,
  ShieldCheck,
  LocateFixed,
  BarChart3,
  Layers,
  ArrowLeft,
  Search,
  Filter,
  Check,
  Building2,
  Clock,
  PhilippinePeso,
  FileSpreadsheet,
  AlertCircle,
  Lock,
  KeyRound,
  ShieldAlert,
  LogOut,
  Upload,
  Compass,
  Navigation,
  Image as ImageIcon,
  Activity
} from 'lucide-react';

interface AdminPortalProps {
  coffeeShops: CoffeeShop[];
  catalogueError?: string | null;
  navigationLogs?: NavigationLogEntry[];
  onSaveShop: (shop: CoffeeShop) => Promise<boolean>;
  onDeleteShop: (shopId: string) => Promise<boolean>;
  onResetDefaultData: () => Promise<boolean>;
  onChangeAdminPassword: (password: string) => boolean;
  onSwitchToUserPortal: () => void;
  onLogout: () => void;
}

const POBLACION_PRESETS = [
  { name: 'Brgy 1 (Plaza Rizal / Church)', lat: 14.2139, lng: 121.1662 },
  { name: 'Brgy 2 (Burgos / JP Rizal St)', lat: 14.2125, lng: 121.1645 },
  { name: 'Brgy 3 (Poblacion Market Area)', lat: 14.2152, lng: 121.1678 },
  { name: 'Brgy 4 (Chipeco Ave / National Hwy)', lat: 14.2088, lng: 121.1576 },
  { name: 'Brgy 5 (Real / Crossing Edge)', lat: 14.2115, lng: 121.1608 },
  { name: 'Brgy 6 (Poblacion Residential)', lat: 14.2168, lng: 121.1632 },
  { name: 'Brgy 7 (Lecheria Boundary)', lat: 14.2185, lng: 121.1595 },
];

const WEEKDAYS = [
  { name: 'Monday', shortName: 'Mon' },
  { name: 'Tuesday', shortName: 'Tue' },
  { name: 'Wednesday', shortName: 'Wed' },
  { name: 'Thursday', shortName: 'Thu' },
  { name: 'Friday', shortName: 'Fri' },
  { name: 'Saturday', shortName: 'Sat' },
  { name: 'Sunday', shortName: 'Sun' },
];

const getSelectedOperatingDays = (daysOpen: string) => {
  return parseOperatingDays(daysOpen).map((day) => WEEKDAYS[day].name);
};

const formatOperatingTime = (time: string) => {
  const [hourText, minuteText] = time.split(':');
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return '';
  const period = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${minuteText || '00'} ${period}`;
};

export const AdminPortal: React.FC<AdminPortalProps> = ({
  coffeeShops,
  catalogueError,
  onSaveShop,
  onDeleteShop,
  onResetDefaultData,
  onChangeAdminPassword,
  onSwitchToUserPortal,
  onLogout,
}) => {
  const [activeAdminTab, setActiveAdminTab] = useState<'repository' | 'analytics' | 'settings'>('repository');
  const [editingShop, setEditingShop] = useState<CoffeeShop | null>(null);
  const [operatingDaysMode, setOperatingDaysMode] = useState<'daily' | 'specific'>('daily');
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBarangayFilter, setSelectedBarangayFilter] = useState<number | 'all'>('all');
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [isSavingShop, setIsSavingShop] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<CoffeeShop | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isDeletingShop, setIsDeletingShop] = useState(false);
  const [isResettingData, setIsResettingData] = useState(false);
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);

  // 360 Photo File Upload state
  const [isUploading360, setIsUploading360] = useState(false);
  const [upload360Error, setUpload360Error] = useState<string | null>(null);
  const [isDragging360, setIsDragging360] = useState(false);
  const [uploaded360FileName, setUploaded360FileName] = useState<string | null>(null);
  const [showUrlFallback, setShowUrlFallback] = useState(false);
  const fileInput360Ref = useRef<HTMLInputElement>(null);
  const [isUploadingShopPhoto, setIsUploadingShopPhoto] = useState(false);
  const [shopPhotoUploadError, setShopPhotoUploadError] = useState<string | null>(null);
  const shopPhotoInputRef = useRef<HTMLInputElement>(null);

  // Mini Leaflet Map Ref for GIS Pinning
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [isLocatingAdmin, setIsLocatingAdmin] = useState(false);

  // Filtered list for admin management
  const filteredAdminShops = coffeeShops.filter((shop) => {
    if (selectedBarangayFilter !== 'all' && shop.barangayId !== selectedBarangayFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        shop.name.toLowerCase().includes(q) ||
        shop.barangayName.toLowerCase().includes(q) ||
        shop.landmark.toLowerCase().includes(q) ||
        shop.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Calculate quick analytics
  const totalCafes = coffeeShops.length;
  const verifiedCafes = coffeeShops.filter((s) => s.verified).length;
  const totalOutlets = coffeeShops.reduce((acc, s) => acc + (s.amenities.outletCount || 0), 0);

  const startCreateNew = () => {
    const newShop: CoffeeShop = {
      id: `cafe-${Date.now()}`,
      name: '',
      barangayId: 1,
      barangayName: 'Barangay 1',
      address: '',
      landmark: '',
      priceRange: '₱120 - ₱220',
      minPrice: 120,
      maxPrice: 220,
      openingTime: '08:00',
      closingTime: '22:00',
      operatingHoursText: '8:00 AM - 10:00 PM',
      daysOpen: 'Monday to Sunday',
      lat: 14.2135,
      lng: 121.1642,
      rating: 4.5,
      reviewCount: 1,
      verified: true,
      bannerImage: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&w=800&q=80',
      galleryImages: [],
      description: '',
      amenities: {
        wifiAvailable: true,
        wifiSpeedMbps: 45,
        wifiType: 'High Speed (Fiber)',
        wifiPasswordProvided: true,
        outletCount: 12,
        outletCoveragePercent: '80% of Tables',
        acAvailable: true,
        noiseLevel: 'Quiet / Study-Friendly',
        seatingCapacity: 30,
        parkingInfo: 'Street Parking',
        paymentMethods: ['Cash', 'GCash'],
        studyFriendlyScore: 5,
        verifiedDate: 'March 2026',
        verifiedBy: 'CCC BSIT Field Researcher',
      },
      menu: [
        { name: 'Signature Iced Coffee', price: 120, category: 'Coffee', popular: true }
      ],
      reviews: [],
    };
    setEditingShop(newShop);
    setOperatingDaysMode('daily');
    setIsCreating(true);
  };

  const handleStartEdit = (shop: CoffeeShop) => {
    setEditingShop({ ...shop });
    setOperatingDaysMode(getSelectedOperatingDays(shop.daysOpen).length === WEEKDAYS.length ? 'daily' : 'specific');
    setIsCreating(false);
  };

  // Initialize and Update Leaflet Pinning Map inside Admin Form
  useEffect(() => {
    if (!editingShop || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      if ((mapContainerRef.current as any)._leaflet_id) {
        delete (mapContainerRef.current as any)._leaflet_id;
      }

      const initialLat = Number.isFinite(editingShop.lat) ? editingShop.lat : 14.2135;
      const initialLng = Number.isFinite(editingShop.lng) ? editingShop.lng : 121.1642;

      try {
        const map = L.map(mapContainerRef.current, {
          center: [initialLat, initialLng],
          zoom: 16,
          zoomControl: true,
          attributionControl: false,
        });

        L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          subdomains: 'abc',
          crossOrigin: true,
        }).addTo(map);

        const pinIcon = L.divIcon({
          className: 'custom-admin-pin',
          html: `
            <div class="relative flex flex-col items-center cursor-grab active:cursor-grabbing">
              <div class="px-2.5 py-1 rounded-full bg-amber-600 text-white font-extrabold text-[11px] shadow-2xl border-2 border-white ring-2 ring-amber-400 whitespace-nowrap flex items-center gap-1">
                <span>📍</span>
                <span>DRAG TO PIN CAFE LOCATION</span>
              </div>
              <div class="w-3 h-3 bg-amber-600 rotate-45 -mt-1.5 border-r-2 border-b-2 border-white"></div>
            </div>
          `,
          iconSize: [180, 42],
          iconAnchor: [90, 38],
        });

        const marker = L.marker([initialLat, initialLng], {
          draggable: true,
          icon: pinIcon,
        }).addTo(map);

        marker.on('dragend', (event) => {
          const position = event.target.getLatLng();
          const roundedLat = parseFloat(position.lat.toFixed(6));
          const roundedLng = parseFloat(position.lng.toFixed(6));
          setEditingShop((prev) => (prev ? { ...prev, lat: roundedLat, lng: roundedLng } : null));
        });

        map.on('click', (e: L.LeafletMouseEvent) => {
          const clickedLat = parseFloat(e.latlng.lat.toFixed(6));
          const clickedLng = parseFloat(e.latlng.lng.toFixed(6));
          marker.setLatLng([clickedLat, clickedLng]);
          setEditingShop((prev) => (prev ? { ...prev, lat: clickedLat, lng: clickedLng } : null));
        });

        mapInstanceRef.current = map;
        markerRef.current = marker;

        setTimeout(() => map.invalidateSize(), 50);
        setTimeout(() => map.invalidateSize(), 200);
        setTimeout(() => map.invalidateSize(), 500);
      } catch (err) {
        console.warn('Leaflet admin map init error:', err);
      }
    } else {
      if (markerRef.current && Number.isFinite(editingShop.lat) && Number.isFinite(editingShop.lng)) {
        try {
          markerRef.current.setLatLng([editingShop.lat, editingShop.lng]);
          mapInstanceRef.current.panTo([editingShop.lat, editingShop.lng]);
        } catch (e) { }
      }
    }
  }, [editingShop?.id]);

  useEffect(() => {
    if (!editingShop && mapInstanceRef.current) {
      try {
        mapInstanceRef.current.remove();
      } catch (e) { }
      mapInstanceRef.current = null;
      markerRef.current = null;
    }
  }, [editingShop]);

  const handleCaptureCurrentGps = () => {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
      setSaveToast('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocatingAdmin(true);
    try {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setIsLocatingAdmin(false);
          const lat = parseFloat(pos.coords.latitude.toFixed(6));
          const lng = parseFloat(pos.coords.longitude.toFixed(6));

          setEditingShop((prev) => (prev ? { ...prev, lat, lng } : null));
          if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
          if (mapInstanceRef.current) {
            try {
              mapInstanceRef.current.flyTo([lat, lng], 18, { duration: 0.8 });
            } catch (e) { }
          }
        },
        (err) => {
          setIsLocatingAdmin(false);
          setSaveToast(`Could not capture device location: ${err.message}`);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } catch (e) {
      setIsLocatingAdmin(false);
      setSaveToast('Could not access device location.');
    }
  };

  const handleSnapPreset = (lat: number, lng: number) => {
    setEditingShop((prev) => (prev ? { ...prev, lat, lng } : null));
    if (markerRef.current) markerRef.current.setLatLng([lat, lng]);
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([lat, lng], 17, { duration: 0.6 });
    }
  };

  const handle360FileProcess = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setUpload360Error('Please upload a valid image file (JPG, PNG, WebP).');
      return;
    }
    setUpload360Error(null);
    setIsUploading360(true);
    setUploaded360FileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) {
        setIsUploading360(false);
        setUpload360Error('Failed to read image file.');
        return;
      }

      // Optimize image through offscreen canvas if high-resolution to ensure smooth VR rendering and low memory footprint
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setIsUploading360(false);
          setUpload360Error('Could not process the panorama image.');
          return;
        }

        let compressedDataUrl = '';
        for (const maxWidth of [2560, 2048, 1536, 1024, 768, 512, 384]) {
          const scale = Math.min(1, maxWidth / img.width);
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          for (const quality of [0.85, 0.7, 0.55, 0.4, 0.3]) {
            const candidate = canvas.toDataURL('image/jpeg', quality);
            if (candidate.length <= 45000) {
              compressedDataUrl = candidate;
              break;
            }
          }
          if (compressedDataUrl) break;
        }

        if (!compressedDataUrl) {
          setIsUploading360(false);
          setUpload360Error('This panorama could not be compressed small enough to save. Please choose a smaller image.');
          return;
        }

        setEditingShop((prev) => (prev ? { ...prev, panorama360Url: compressedDataUrl } : null));
        setIsUploading360(false);
      };
      img.onerror = () => {
        setIsUploading360(false);
        setUpload360Error('Could not open the selected panorama image.');
      };
      img.src = result;
    };
    reader.onerror = () => {
      setIsUploading360(false);
      setUpload360Error('Error reading uploaded image file.');
    };
    reader.readAsDataURL(file);
  };

  const handle360Drop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging360(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handle360FileProcess(e.dataTransfer.files[0]);
    }
  };

  const handle360DragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging360(true);
  };

  const handle360DragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging360(false);
  };

  const handleShopPhotoUpload = (file: File) => {
    const targetShopId = editingShop?.id;
    const currentPhotos = editingShop?.galleryImages ?? [];
    if (currentPhotos.length >= 2) {
      setShopPhotoUploadError('A maximum of 2 shop photos is allowed.');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setShopPhotoUploadError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    setShopPhotoUploadError(null);
    setIsUploadingShopPhoto(true);
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setShopPhotoUploadError('Could not read the selected shop photo.');
        setIsUploadingShopPhoto(false);
        return;
      }

      const image = new Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) {
          setShopPhotoUploadError('Could not process the selected shop photo.');
          setIsUploadingShopPhoto(false);
          return;
        }

        let compressedPhoto = '';
        for (const maxDimension of [960, 768, 640, 512]) {
          const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          for (const quality of [0.78, 0.68, 0.58]) {
            const candidate = canvas.toDataURL('image/jpeg', quality);
            if (candidate.length <= 45000) {
              compressedPhoto = candidate;
              break;
            }
          }
          if (compressedPhoto) break;
        }

        if (!compressedPhoto) {
          setShopPhotoUploadError('This photo could not be compressed small enough. Please choose a smaller image.');
          setIsUploadingShopPhoto(false);
          return;
        }

        setEditingShop((previous) => {
          if (!previous || previous.id !== targetShopId) return previous;
          const photos = previous.galleryImages ?? [];
          if (photos.length >= 2) return previous;
          return { ...previous, galleryImages: [...photos, compressedPhoto] };
        });
        setIsUploadingShopPhoto(false);
      };
      image.onerror = () => {
        setShopPhotoUploadError('Could not open the selected shop photo.');
        setIsUploadingShopPhoto(false);
      };
      image.src = reader.result;
    };

    reader.onerror = () => {
      setShopPhotoUploadError('Error reading the selected shop photo.');
      setIsUploadingShopPhoto(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShop || !editingShop.name) return;

    const bgy = BARANGAYS_LIST.find((b) => b.id === editingShop.barangayId);
    const selectedDays = getSelectedOperatingDays(editingShop.daysOpen);
    if (selectedDays.length === 0) {
      setSaveToast('Select at least one operating day, or choose Opens daily.');
      return;
    }
    const daysOpen = selectedDays.length === WEEKDAYS.length
      ? 'Monday to Sunday'
      : selectedDays.join(', ');
    const hasValidOperatingHours = /^\d{2}:\d{2}$/.test(editingShop.openingTime) &&
      /^\d{2}:\d{2}$/.test(editingShop.closingTime);
    const updated: CoffeeShop = {
      ...editingShop,
      daysOpen,
      operatingHoursText: hasValidOperatingHours
        ? `${selectedDays.length === WEEKDAYS.length ? 'Daily' : daysOpen} ${formatOperatingTime(editingShop.openingTime)} - ${formatOperatingTime(editingShop.closingTime)}`
        : editingShop.operatingHoursText,
      galleryImages: (editingShop.galleryImages ?? []).slice(0, 2),
      barangayName: bgy ? bgy.shortName : `Barangay ${editingShop.barangayId}`,
      lat: Number(editingShop.lat) || 14.2135,
      lng: Number(editingShop.lng) || 121.1642,
    };

    setIsSavingShop(true);
    const synced = await onSaveShop(updated);
    setIsSavingShop(false);
    if (!synced) {
      setSaveToast('Saved & pinned on this device.');
    } else {
      setSaveToast(`✓ Cafe "${updated.name}" saved & pinned.`);
    }

    setEditingShop(null);
    setIsCreating(false);

    setTimeout(() => {
      setSaveToast(null);
    }, 3000);
  };

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(coffeeShops, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `brewbound_calamba_dataset_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Top Administration Navigation Bar */}
      <header className="bg-slate-950 border-b border-slate-800 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shadow-lg shadow-amber-900/40 text-white">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Data Administration & GIS Management Portal
              </h1>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Authorized Admin Session
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              City College of Calamba (CCC) • Poblacion Barangays 1–7 Repository
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={startCreateNew}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-bold text-xs shadow-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Establishment</span>
          </button>

          {/* Switch to Public Consumer UI */}
          <button
            onClick={onSwitchToUserPortal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs border border-slate-700 transition-colors"
            title="Return to Public Cafe Discovery UI"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">View User Portal</span>
          </button>

          {/* Lock and Sign Out */}
          <button
            onClick={onLogout}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800/80 rounded-xl font-bold text-xs transition-colors"
            title="Lock Administration Session & Log Out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>
      {catalogueError && (
        <div role="alert" className="px-4 sm:px-6 py-2 bg-rose-950 text-rose-200 text-xs font-semibold border-b border-rose-800">
          {catalogueError}
        </div>
      )}

      {/* Sub Navigation Bar & Quick Metric KPIs */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => {
              setActiveAdminTab('repository');
              setEditingShop(null);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeAdminTab === 'repository'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Establishments ({totalCafes})</span>
          </button>
          <button
            onClick={() => {
              setActiveAdminTab('analytics');
              setEditingShop(null);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeAdminTab === 'analytics'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Poblacion 1–7 Analytics</span>
          </button>
          <button
            onClick={() => {
              setActiveAdminTab('settings');
              setEditingShop(null);
            }}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${activeAdminTab === 'settings'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'text-slate-400 hover:text-white'
              }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security & Backups</span>
          </button>
        </div>

        {/* Metric Pill Badges */}
        <div className="hidden lg:flex items-center gap-3 text-xs text-slate-300">
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified: <strong>{verifiedCafes}</strong></span>
          </span>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            <span>Total Outlets: <strong>{totalOutlets}</strong></span>
          </span>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-950/40">
        {saveToast && (
          <div className={`${saveToast.startsWith('Could not') ? 'bg-red-950/90 text-red-200 border-red-500/60' : 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60'} border p-3 rounded-2xl text-xs font-bold flex items-center justify-between shadow-xl animate-in slide-in-from-top-2`}>
            <span>{saveToast}</span>
            <button onClick={() => setSaveToast(null)} className="hover:text-white">✕</button>
          </div>
        )}

        {/* -------------------- VIEW 1: EDIT / CREATE FORM WITH OPENSTREETMAP PINNING -------------------- */}
        {editingShop ? (
          <form onSubmit={handleSaveForm} className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-7 space-y-6 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-600/20 text-amber-400 border border-amber-500/30">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-white">
                    {isCreating ? 'Add New Coffee Shop Record' : `Edit Establishment: ${editingShop.name}`}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Direct Administrator Field Data Entry & Precise GIS Pinning
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingShop(null)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* INTERACTIVE OPENSTREETMAP GIS PIN PLACEMENT */}
            <div className="bg-slate-950 p-4 sm:p-5 rounded-2xl border border-amber-500/30 shadow-inner space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <label className="font-extrabold text-white text-sm flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-red-500" />
                    <span>Pin Physical Location on OpenStreetMap</span>
                  </label>
                  <p className="text-[11px] text-slate-400">
                    Click anywhere on the map or drag the pin marker directly to the entrance in Calamba Poblacion.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCaptureCurrentGps}
                    disabled={isLocatingAdmin}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 rounded-xl text-xs font-bold transition-colors"
                    title="Use live device GPS coordinates"
                  >
                    <LocateFixed className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isLocatingAdmin ? 'Acquiring GPS...' : 'Use My Current GPS'}</span>
                  </button>
                </div>
              </div>

              {/* Leaflet Pin Map Container */}
              <div className="relative w-full h-72 rounded-2xl overflow-hidden border border-slate-700 shadow-inner bg-slate-900">
                <div ref={mapContainerRef} className="w-full h-full z-0" />

                {/* Real-time Coordinate Monitor */}
                <div className="absolute bottom-3 left-3 z-10 bg-slate-950/90 backdrop-blur-md text-slate-200 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-mono flex items-center gap-2 shadow-xl">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Lat: <strong>{editingShop.lat}</strong></span>
                  <span>•</span>
                  <span>Lng: <strong>{editingShop.lng}</strong></span>
                </div>
              </div>

              {/* Quick-Snap Pills */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-slate-300">Quick-Snap to Barangay Hub:</span>
                <div className="flex flex-wrap gap-1.5">
                  {POBLACION_PRESETS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleSnapPreset(preset.lat, preset.lng)}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-amber-600/30 hover:text-amber-200 border border-slate-800 hover:border-amber-500/50 rounded-lg text-[10px] font-medium text-slate-300 transition-colors"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Numerical coordinate inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingShop.lat}
                    onChange={(e) => {
                      const newLat = parseFloat(e.target.value) || 0;
                      setEditingShop({ ...editingShop, lat: newLat });
                      if (markerRef.current && mapInstanceRef.current) {
                        markerRef.current.setLatLng([newLat, editingShop.lng]);
                        mapInstanceRef.current.panTo([newLat, editingShop.lng]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editingShop.lng}
                    onChange={(e) => {
                      const newLng = parseFloat(e.target.value) || 0;
                      setEditingShop({ ...editingShop, lng: newLng });
                      if (markerRef.current && mapInstanceRef.current) {
                        markerRef.current.setLatLng([editingShop.lat, newLng]);
                        mapInstanceRef.current.panTo([editingShop.lat, newLng]);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>

            {/* ESTABLISHMENT DETAILS & VERIFIED AMENITY METRICS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Establishment Name</label>
                <input
                  type="text"
                  required
                  value={editingShop.name}
                  onChange={(e) => setEditingShop({ ...editingShop, name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Grounded Cafe"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Barangay (Poblacion 1–7)</label>
                <select
                  value={editingShop.barangayId}
                  onChange={(e) => setEditingShop({ ...editingShop, barangayId: Number(e.target.value) })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                >
                  {BARANGAYS_LIST.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.landmark})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Full Street Address</label>
                <input
                  type="text"
                  required
                  value={editingShop.address}
                  onChange={(e) => setEditingShop({ ...editingShop, address: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Burgos St. cor. JP Rizal St., Brgy 2, Calamba City"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Landmark Reference</label>
                <input
                  type="text"
                  value={editingShop.landmark}
                  onChange={(e) => setEditingShop({ ...editingShop, landmark: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. Beside Bureau of Internal Revenue (BIR)"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Price Range Display</label>
                <input
                  type="text"
                  value={editingShop.priceRange}
                  onChange={(e) => setEditingShop({ ...editingShop, priceRange: e.target.value })}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                  placeholder="e.g. ₱120 - ₱250"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Operating Days</label>
                <select
                  value={operatingDaysMode}
                  onChange={(event) => {
                    const nextMode = event.target.value as 'daily' | 'specific';
                    setOperatingDaysMode(nextMode);
                    if (nextMode === 'daily') {
                      setEditingShop({ ...editingShop, daysOpen: 'Monday to Sunday' });
                    }
                  }}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                >
                  <option value="daily">Opens daily</option>
                  <option value="specific">Specific days</option>
                </select>
                {operatingDaysMode === 'specific' && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {WEEKDAYS.map(({ name, shortName }) => {
                      const selectedDays = getSelectedOperatingDays(editingShop.daysOpen);
                      return (
                        <label key={name} className="flex items-center gap-2 text-[11px] text-slate-300">
                          <input
                            type="checkbox"
                            checked={selectedDays.includes(name)}
                            onChange={(event) => {
                              const nextDays = event.target.checked
                                ? [...selectedDays, name]
                                : selectedDays.filter((day) => day !== name);
                              if (nextDays.length === 0) return;
                              const orderedDays = WEEKDAYS
                                .map(({ name: weekday }) => weekday)
                                .filter((weekday) => nextDays.includes(weekday));
                              setEditingShop({
                                ...editingShop,
                                daysOpen: orderedDays.join(', '),
                              });
                            }}
                            className="rounded accent-amber-500 w-3.5 h-3.5"
                          />
                          <span>{shortName}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Operating Hours</label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-slate-400">
                    Opens
                    <input
                      type="time"
                      value={editingShop.openingTime}
                      onChange={(e) => setEditingShop({ ...editingShop, openingTime: e.target.value })}
                      className="mt-1 w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                  <label className="text-[11px] text-slate-400">
                    Closes
                    <input
                      type="time"
                      value={editingShop.closingTime}
                      onChange={(e) => setEditingShop({ ...editingShop, closingTime: e.target.value })}
                      className="mt-1 w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-300 text-xs mb-1.5">Noise Level Classification</label>
                <select
                  value={editingShop.amenities.noiseLevel}
                  onChange={(e) =>
                    setEditingShop({
                      ...editingShop,
                      amenities: {
                        ...editingShop.amenities,
                        noiseLevel: e.target.value as any,
                      },
                    })
                  }
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                >
                  <option value="Quiet / Study-Friendly">Quiet / Study-Friendly</option>
                  <option value="Moderate Background Music">Moderate Background Music</option>
                  <option value="Lively / Social">Lively / Social</option>
                </select>
              </div>

              <div className="flex items-center gap-6 pt-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingShop.amenities.acAvailable}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        amenities: {
                          ...editingShop.amenities,
                          acAvailable: e.target.checked,
                        },
                      })
                    }
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>Air Conditioned Space</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingShop.amenities.wifiAvailable}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        amenities: {
                          ...editingShop.amenities,
                          wifiAvailable: e.target.checked,
                        },
                      })
                    }
                    className="rounded accent-blue-500 w-4 h-4"
                  />
                  <span>Wi-Fi Available</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingShop.amenities.outletCount > 0}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        amenities: {
                          ...editingShop.amenities,
                          outletCount: e.target.checked ? 1 : 0,
                        },
                      })
                    }
                    className="rounded accent-amber-500 w-4 h-4"
                  />
                  <span>Power Outlets</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingShop.amenities.paymentMethods.includes('GCash')}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        amenities: {
                          ...editingShop.amenities,
                          paymentMethods: e.target.checked
                            ? Array.from(new Set([...editingShop.amenities.paymentMethods, 'GCash']))
                            : editingShop.amenities.paymentMethods.filter((method) => method !== 'GCash'),
                        },
                      })
                    }
                    className="rounded accent-emerald-500 w-4 h-4"
                  />
                  <span>Accept GCash</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={editingShop.verified}
                    onChange={(e) =>
                      setEditingShop({
                        ...editingShop,
                        verified: e.target.checked,
                      })
                    }
                    className="rounded accent-blue-500 w-4 h-4"
                  />
                  <span>Verified Research Record</span>
                </label>
              </div>

              {/* FRONT-OF-SHOP PHOTO GALLERY */}
              <div className="sm:col-span-2 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="block font-bold text-sky-300 text-xs flex items-center gap-1.5">
                    <ImageIcon className="w-4 h-4 text-sky-300" />
                    <span>Shop Photos (Front of Shop)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {(editingShop.galleryImages ?? []).length}/2 photos
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  Upload up to 2 regular shop photos. These appear in the photo gallery and are separate from the 360° interior photo.
                </p>

                <input
                  type="file"
                  ref={shopPhotoInputRef}
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) handleShopPhotoUpload(file);
                    event.target.value = '';
                  }}
                />

                {shopPhotoUploadError && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{shopPhotoUploadError}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(editingShop.galleryImages ?? []).slice(0, 2).map((photo, index) => (
                    <div key={`${index}-${photo.slice(0, 32)}`} className="relative overflow-hidden rounded-xl border border-slate-700">
                      <img src={photo} alt={`${editingShop.name || 'Shop'} photo ${index + 1}`} className="h-36 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setEditingShop((previous) => previous
                          ? { ...previous, galleryImages: (previous.galleryImages ?? []).filter((_, photoIndex) => photoIndex !== index) }
                          : null)}
                        className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-rose-950/90 px-2 py-1 text-[11px] font-bold text-rose-200 hover:bg-rose-900"
                      >
                        <Trash2 className="h-3 w-3" />
                        Remove
                      </button>
                    </div>
                  ))}
                </div>

                {(editingShop.galleryImages ?? []).length < 2 && (
                  <button
                    type="button"
                    onClick={() => shopPhotoInputRef.current?.click()}
                    disabled={isUploadingShopPhoto}
                    className="flex min-h-28 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-700 bg-slate-950/60 p-5 text-center transition-colors hover:border-sky-500/60 hover:bg-slate-950 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isUploadingShopPhoto ? (
                      <>
                        <div className="h-7 w-7 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
                        <span className="text-xs font-bold text-sky-300">Processing shop photo...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-sky-300" />
                        <span className="text-xs font-bold text-white">Upload Shop Photo</span>
                        <span className="text-[10px] text-slate-400">JPG, PNG, or WebP</span>
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* 360-DEGREE INTERIOR PHOTO FILE UPLOAD */}
              <div className="sm:col-span-2 pt-4 border-t border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-amber-400 text-xs flex items-center gap-1.5">
                    <Compass className="w-4 h-4 text-amber-400" />
                    <span>360° Interior Panorama Photo Upload (Virtual Tour)</span>
                  </label>
                  <span className="text-[10px] text-slate-400 font-mono">
                    Drag & Drop / File Selector
                  </span>
                </div>

                {/* Hidden File Input */}
                <input
                  type="file"
                  ref={fileInput360Ref}
                  accept="image/jpeg,image/png,image/webp,image/jpg"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handle360FileProcess(e.target.files[0]);
                      e.target.value = ''; // reset so same file can be re-uploaded if desired
                    }
                  }}
                  className="hidden"
                />

                {/* Upload Error Banner */}
                {upload360Error && (
                  <div className="p-2.5 bg-rose-950/80 border border-rose-800 text-rose-200 text-xs rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{upload360Error}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUpload360Error(null)}
                      className="text-rose-400 hover:text-white text-xs font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* State A: Photo is Attached */}
                {editingShop.panorama360Url ? (
                  <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-950 text-emerald-400 border border-emerald-800 flex items-center justify-center">
                          <Check className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white flex items-center gap-1.5">
                            <span>360° Panoramic Photo Loaded</span>
                            <span className="text-[10px] text-emerald-400 font-normal">
                              ({uploaded360FileName || 'Equirectangular Panorama Attached'})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">
                            Patrons can freely look around inside this cafe in full 360° on mobile and desktop.
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => fileInput360Ref.current?.click()}
                          disabled={isUploading360}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          <span>{isUploading360 ? 'Processing...' : 'Upload New Photo'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingShop({ ...editingShop, panorama360Url: '' });
                            setUploaded360FileName(null);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded-xl text-xs font-bold transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                      </div>
                    </div>

                    {/* Interactive 360 Live Preview */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300 flex items-center gap-1">
                          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
                          <span>Live 360° Virtual Look-Around Test</span>
                        </span>
                        <span>Drag with mouse / finger to pan in 360°</span>
                      </div>
                      <PanoramaViewer
                        imageUrl={editingShop.panorama360Url}
                        cafeName={editingShop.name || 'Sample Cafe'}
                        height="220px"
                      />
                    </div>
                  </div>
                ) : (
                  /* State B: No Photo Attached -> Drag & Drop / Click to Upload Box */
                  <div
                    onDrop={handle360Drop}
                    onDragOver={handle360DragOver}
                    onDragLeave={handle360DragLeave}
                    onClick={() => fileInput360Ref.current?.click()}
                    className={`relative cursor-pointer p-6 sm:p-8 rounded-2xl border-2 border-dashed transition-all text-center flex flex-col items-center justify-center gap-2.5 ${isDragging360
                      ? 'border-amber-400 bg-amber-950/30 scale-[1.01]'
                      : 'border-slate-800 hover:border-amber-500/60 bg-slate-950/60 hover:bg-slate-950'
                      }`}
                  >
                    {isUploading360 ? (
                      <div className="py-4 space-y-2">
                        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="text-xs font-bold text-amber-300">
                          Reading & Optimizing 360° Photo...
                        </div>
                        <p className="text-[11px] text-slate-400">Formatting for high-performance equirectangular VR</p>
                      </div>
                    ) : (
                      <>
                        <div className="w-12 h-12 rounded-2xl bg-amber-600/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
                          <Upload className="w-6 h-6" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                            <span>Click to Browse or Drag & Drop 360° Photo</span>
                          </div>
                          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                            Upload an equirectangular or panoramic interior photo of this coffee shop (.JPG, .PNG, .WebP)
                          </p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-amber-400 font-bold">
                            Supports Local Files
                          </span>
                          <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-400">
                            Automatic High-Res Optimization
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Optional Collapsible URL fallback for advanced researchers */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-400">
                  <button
                    type="button"
                    onClick={() => setShowUrlFallback(!showUrlFallback)}
                    className="text-slate-400 hover:text-amber-300 transition-colors underline"
                  >
                    {showUrlFallback ? 'Hide URL link option' : 'Or paste an image web URL instead'}
                  </button>
                  {showUrlFallback && (
                    <span className="text-[10px] text-slate-400">Equirectangular link</span>
                  )}
                </div>

                {showUrlFallback && (
                  <div className="flex gap-2 animate-in fade-in pt-1">
                    <input
                      type="url"
                      value={editingShop.panorama360Url || ''}
                      onChange={(e) =>
                        setEditingShop({ ...editingShop, panorama360Url: e.target.value })
                      }
                      className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 focus:outline-none"
                      placeholder="https://images.unsplash.com/... (optional fallback URL)"
                    />
                    {editingShop.panorama360Url && (
                      <button
                        type="button"
                        onClick={() => setEditingShop({ ...editingShop, panorama360Url: '' })}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 whitespace-nowrap"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingShop(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingShop || isUploadingShopPhoto || isUploading360}
                className="flex items-center gap-1.5 px-6 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 rounded-xl shadow-lg transition-colors"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingShop ? 'Saving on this device...' : isUploadingShopPhoto || isUploading360 ? 'Processing photos...' : 'Save Record & Update GIS Map'}</span>
              </button>
            </div>
          </form>
        ) : activeAdminTab === 'analytics' ? (
          /* -------------------- VIEW 2: BARANGAY COVERAGE & USER NAVIGATION ANALYTICS -------------------- */
          <div className="space-y-6">
            {/* Top KPI Cards including Navigations Metric */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-slate-400 text-xs font-medium">Total Registered Cafes</div>
                <div className="text-2xl font-black text-white mt-1">{totalCafes} Establishments</div>
                <div className="text-[11px] text-emerald-400 mt-1">Across Poblacion Barangays 1 to 7</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-slate-400 text-xs font-medium flex items-center justify-between">
                  <span>Total User Navigations</span>
                  <Activity className="w-3.5 h-3.5 text-blue-400" />
                </div>
                <div className="text-2xl font-black text-blue-400 mt-1">
                  {coffeeShops.reduce((acc, s) => acc + (s.navigationCount || 0), 0)} Route Inquiries
                </div>
                <div className="text-[11px] text-blue-300/80 mt-1">Real-time user GIS routing volume</div>
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="text-slate-400 text-xs font-medium">Total Power Outlets</div>
                <div className="text-2xl font-black text-amber-400 mt-1">{totalOutlets} Sockets</div>
                <div className="text-[11px] text-slate-400 mt-1">For student & remote worker devices</div>
              </div>
            </div>

            {/* User Navigation Leaderboard by Coffee Shop */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-white flex items-center gap-2">
                  <Navigation className="w-4 h-4 text-blue-400" />
                  <span>Coffee Shop Patron Navigation Traffic (GIS Routing Analytics)</span>
                </h3>
                <span className="text-[11px] text-slate-400">Ranked by user turn-by-turn routing volume</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Establishment</th>
                      <th className="py-2.5 px-3">Barangay</th>
                      <th className="py-2.5 px-3">360° Interior Tour</th>
                      <th className="py-2.5 px-3 text-right">User Navigations</th>
                      <th className="py-2.5 px-3 text-right">Share of Traffic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {[...coffeeShops]
                      .sort((a, b) => (b.navigationCount || 0) - (a.navigationCount || 0))
                      .map((shop, idx) => {
                        const totalNav = coffeeShops.reduce((acc, s) => acc + (s.navigationCount || 0), 0) || 1;
                        const count = shop.navigationCount || 0;
                        const pct = Math.round((count / totalNav) * 100);

                        return (
                          <tr key={shop.id} className="hover:bg-slate-800/50">
                            <td className="py-3 px-3 font-mono font-bold text-slate-400">
                              #{idx + 1}
                            </td>
                            <td className="py-3 px-3">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{shop.name}</span>
                                {shop.verified && (
                                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                )}
                              </div>
                              <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                                {shop.landmark || shop.address}
                              </div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-amber-300">
                              {shop.barangayName}
                            </td>
                            <td className="py-3 px-3">
                              {shop.panorama360Url ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-full">
                                  <Compass className="w-3 h-3" />
                                  360° Virtual Tour
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-500">Standard Photos</span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-blue-400 text-sm">
                              {count}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-20 bg-slate-800 h-2 rounded-full overflow-hidden">
                                  <div
                                    className="bg-blue-500 h-full rounded-full"
                                    style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                                  />
                                </div>
                                <span className="text-[11px] font-mono text-slate-300 w-8 text-right">
                                  {pct}%
                                </span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Barangay Breakdown Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
              <h3 className="font-bold text-sm text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <span>Barangay Distribution & Total Navigations</span>
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-bold">
                      <th className="py-2.5 px-3">Barangay</th>
                      <th className="py-2.5 px-3">Key Landmark</th>
                      <th className="py-2.5 px-3">Cafes</th>
                      <th className="py-2.5 px-3">Outlets</th>
                      <th className="py-2.5 px-3 text-right">Total Navigations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {BARANGAYS_LIST.map((bgy) => {
                      const bgyShops = coffeeShops.filter((s) => s.barangayId === bgy.id);
                      const bgyOutlets = bgyShops.reduce((acc, s) => acc + (s.amenities.outletCount || 0), 0);
                      const bgyNavs = bgyShops.reduce((acc, s) => acc + (s.navigationCount || 0), 0);

                      return (
                        <tr key={bgy.id} className="hover:bg-slate-800/50">
                          <td className="py-3 px-3 font-bold text-amber-300">{bgy.name}</td>
                          <td className="py-3 px-3 text-slate-400">{bgy.landmark}</td>
                          <td className="py-3 px-3 font-semibold">{bgyShops.length}</td>
                          <td className="py-3 px-3">{bgyOutlets}</td>
                          <td className="py-3 px-3 text-right font-black text-blue-400">{bgyNavs}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeAdminTab === 'repository' ? (
          /* -------------------- VIEW 3: REPOSITORY LIST TABLE -------------------- */
          <div className="space-y-4">
            {/* Filter & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search cafe name, address, landmark..."
                    className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={selectedBarangayFilter}
                  onChange={(e) => setSelectedBarangayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-500"
                >
                  <option value="all">All Barangays (1–7)</option>
                  {BARANGAYS_LIST.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>

                <button
                  onClick={handleExportJSON}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
                  title="Download raw dataset"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Export Dataset</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm('Reset all coffee shops back to initial verified CCC research dataset?')) {
                      onResetDefaultData();
                    }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-rose-400 hover:bg-rose-950/40 rounded-xl text-xs font-semibold border border-rose-800/40 transition-colors"
                  title="Reset to initial data"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 text-[11px]">
                      <th className="p-3.5">Establishment</th>
                      <th className="p-3.5">Barangay</th>
                      <th className="p-3.5">GIS Map Coordinates</th>
                      <th className="p-3.5">Verified Amenities</th>
                      <th className="p-3.5">360° Interior</th>
                      <th className="p-3.5 text-center">Navigations</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-200">
                    {filteredAdminShops.map((shop) => (
                      <tr key={shop.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3.5">
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{shop.name}</span>
                            {shop.verified && (
                              <CheckCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {shop.landmark || shop.address}
                          </div>
                        </td>
                        <td className="p-3.5 font-medium text-amber-300">
                          {shop.barangayName}
                        </td>
                        <td className="p-3.5 font-mono text-[11px] text-slate-400">
                          📍 {shop.lat?.toFixed(5)}, {shop.lng?.toFixed(5)}
                        </td>
                        <td className="p-3.5">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-950 border border-amber-800/60 px-2 py-0.5 rounded">
                              <Zap className="w-3 h-3" /> {shop.amenities.outletCount}
                            </span>
                          </div>
                        </td>
                        <td className="p-3.5">
                          {shop.panorama360Url ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                              <Compass className="w-3 h-3" />
                              Active 360°
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">None</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-bold text-blue-400 font-mono">
                          {shop.navigationCount || 0}
                        </td>
                        <td className="p-3.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleStartEdit(shop)}
                              className="p-1.5 text-slate-300 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors"
                              title="Edit Record & Re-Pin on Map"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setShopToDelete(shop)}
                              className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
                              title="Delete Establishment"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* -------------------- VIEW 4: SECURITY & DATA SETTINGS -------------------- */
          <div className="max-w-3xl space-y-6">
            <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 p-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-amber-200">
                <AlertCircle className="h-4 w-4" />
                Local-only storage
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-amber-100/80">
                Shop information and photos are saved in this browser only. They are not shared with other devices, browsers, or Vercel deployments. Export your dataset regularly as a backup.
              </p>
            </div>

            {/* Local admin password */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-amber-600/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Local admin password</h3>
                  <p className="text-xs text-slate-400">Password is stored in this browser only.</p>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                If you have not changed it yet, the first-time password is <code className="rounded bg-slate-950 px-1.5 py-0.5 text-amber-300">{DEFAULT_ADMIN_PASSWORD}</code>. Set a new password below (at least 8 characters).
              </p>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (newAdminPassword.length < 8) {
                    setPasswordMessage('Use at least 8 characters for the password.');
                    return;
                  }
                  const changed = onChangeAdminPassword(newAdminPassword);
                  setPasswordMessage(changed ? 'Password saved in this browser.' : 'Could not save the password. Check browser storage and try again.');
                  if (changed) setNewAdminPassword('');
                }}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newAdminPassword}
                  onChange={(event) => {
                    setNewAdminPassword(event.target.value);
                    setPasswordMessage(null);
                  }}
                  placeholder="New password"
                  className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-amber-500"
                />
                <button type="submit" className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500">
                  Update password
                </button>
              </form>
              {passwordMessage && <p role="status" className="text-xs text-slate-300">{passwordMessage}</p>}
              <p className="text-[11px] leading-relaxed text-slate-500">
                This client-side password only hides the admin screen; it is not secure authentication and should not protect sensitive data.
              </p>
            </div>

            {/* Database & Spatial Backup Controls */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
              <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-white">Database Backup & Recovery</h3>
                  <p className="text-xs text-slate-400">Export or import the verified coffee shop records and spatial GIS coordinates</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-white flex items-center gap-2">
                    <Download className="w-4 h-4 text-amber-400" />
                    <span>Export JSON Dataset</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Download a full snapshot of all {coffeeShops.length} coffee shop records including menus, reviews, and GIS coordinates.
                  </p>
                  <button
                    onClick={handleExportJSON}
                    className="w-full mt-2 py-2 px-3 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON Backup</span>
                  </button>
                </div>

                <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
                  <div className="font-bold text-xs text-white flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-rose-400" />
                    <span>Reset Initial Research Dataset</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Revert all database entries back to the baseline City College of Calamba verified dataset for Poblacion 1–7.
                  </p>
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="w-full mt-2 py-2 px-3 bg-rose-950 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Factory Reset Dataset</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal: Delete Establishment */}
      {shopToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-base text-white">Delete Establishment?</h4>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to remove <strong>"{shopToDelete.name}"</strong> from the Poblacion database?
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                disabled={isDeletingShop}
                onClick={() => setShopToDelete(null)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={isDeletingShop}
                onClick={async () => {
                  setIsDeletingShop(true);
                  const deleted = await onDeleteShop(shopToDelete.id);
                  setIsDeletingShop(false);
                  if (deleted) {
                    setShopToDelete(null);
                    setSaveToast(`✓ Cafe "${shopToDelete.name}" deleted.`);
                  } else {
                    setSaveToast('Shop deleted on this device.');
                  }
                }}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isDeletingShop ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Reset Initial Dataset */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl animate-in zoom-in-95">
            <div className="w-12 h-12 rounded-2xl bg-rose-600/20 text-rose-400 border border-rose-500/30 flex items-center justify-center mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div className="text-center">
              <h4 className="font-bold text-base text-white">Reset Database?</h4>
              <p className="text-xs text-slate-400 mt-1">
                This will reset all coffee shop records to the default CCC Research verified dataset. Any custom additions will be restored to defaults.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                disabled={isResettingData}
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl"
              >
                Cancel
              </button>
              <button
                disabled={isResettingData}
                onClick={async () => {
                  setIsResettingData(true);
                  const reset = await onResetDefaultData();
                  setIsResettingData(false);
                  if (reset) {
                    setShowResetConfirm(false);
                    setSaveToast('✓ Catalogue reset to the verified initial dataset.');
                  } else {
                    setSaveToast('Catalogue reset on this device.');
                  }
                }}
                className="flex-1 py-2 px-4 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl"
              >
                {isResettingData ? 'Resetting...' : 'Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 px-6 py-2.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 shrink-0">
        <span>Non-Client Information Management System • City College of Calamba</span>
        <span className="text-slate-400">Poblacion Barangays 1–7 Spatial GIS Registry</span>
      </footer>
    </div>
  );
};
