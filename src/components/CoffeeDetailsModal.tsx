import React, { useState } from 'react';
import { CoffeeShop } from '../types';
import { isShopOpen } from '../utils/routing';
import { PanoramaViewer } from './PanoramaViewer';
import {
  ArrowLeft,
  Heart,
  Navigation,
  Wifi,
  Zap,
  Snowflake,
  Clock,
  MapPin,
  ShieldCheck,
  CreditCard,
  Volume2,
  Phone,
  Share2,
  CheckCircle2,
  CalendarDays,
  Coffee,
  Sparkles,
  Compass,
  Image as ImageIcon,
  Compass as CompassIcon
} from 'lucide-react';

interface CoffeeDetailsModalProps {
  shop: CoffeeShop;
  isFavorite: boolean;
  onClose: () => void;
  onToggleFavorite: (shopId: string) => void;
  onStartNavigation: (shop: CoffeeShop) => void;
}

const formatOperatingDays = (daysOpen: string) => {
  const normalized = daysOpen.trim();
  if (!normalized) return 'Days not provided';
  if (/^(daily|every day)$/i.test(normalized) ||
    /^(mon(?:day)?)\s*(?:to|[-–])\s*(sun(?:day)?)$/i.test(normalized)) {
    return 'Daily';
  }

  return normalized
    .replace(/\bMonday\b/gi, 'Mon')
    .replace(/\bTuesday\b/gi, 'Tue')
    .replace(/\bWednesday\b/gi, 'Wed')
    .replace(/\bThursday\b/gi, 'Thu')
    .replace(/\bFriday\b/gi, 'Fri')
    .replace(/\bSaturday\b/gi, 'Sat')
    .replace(/\bSunday\b/gi, 'Sun')
    .replace(/\s+to\s+/gi, '–');
};

export const CoffeeDetailsModal: React.FC<CoffeeDetailsModalProps> = ({
  shop,
  isFavorite,
  onClose,
  onToggleFavorite,
  onStartNavigation,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'photos' | '360'>(
    shop.panorama360Url ? '360' : 'photos'
  );
  const [copiedToast, setCopiedToast] = useState(false);
  const hasKnownHours = /^\d{2}:\d{2}$/.test(shop.openingTime) && /^\d{2}:\d{2}$/.test(shop.closingTime);
  const isOpen = isShopOpen(shop.openingTime, shop.closingTime, shop.daysOpen);

  const images = shop.galleryImages && shop.galleryImages.length > 0
    ? shop.galleryImages
    : [shop.bannerImage];

  const handleShare = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        navigator.share({
          title: `${shop.name} - BrewBound Calamba`,
          text: `Check out ${shop.name} in ${shop.barangayName}, Calamba City on BrewBound!`,
          url: typeof window !== 'undefined' ? window.location.href : '',
        }).catch(() => {
          // Ignore cancelled share action
        });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(`${shop.name} (${shop.barangayName}, Calamba City) - Found on BrewBound`)
          .catch(() => { });
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      } else {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 2000);
      }
    } catch (err) {
      console.warn('Share not supported:', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex justify-center items-start sm:items-center p-0 sm:p-4">
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-md min-h-screen sm:min-h-0 sm:rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">

        {/* Top Floating App Bar */}
        <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-3.5 bg-gradient-to-b from-black/60 via-black/20 to-transparent">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/90 backdrop-blur-md text-slate-800 rounded-full text-xs font-bold shadow-md hover:bg-white transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 bg-white/90 backdrop-blur-md text-slate-800 rounded-full shadow-md hover:bg-white transition-all"
              title="Share Cafe"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggleFavorite(shop.id)}
              className={`p-2 backdrop-blur-md rounded-full shadow-md transition-all ${isFavorite
                ? 'bg-rose-50 text-rose-600 ring-2 ring-rose-200'
                : 'bg-white/90 text-slate-700 hover:bg-white'
                }`}
              title={isFavorite ? 'Saved to Favorites' : 'Save Favorite'}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto flex-1 pb-24">
          {/* Visual Header: 360 Interior Panorama or Photo Gallery */}
          <div className="relative w-full bg-slate-900">
            {viewMode === '360' && shop.panorama360Url ? (
              <div className="p-2 sm:p-3 bg-slate-950">
                <PanoramaViewer
                  imageUrl={shop.panorama360Url}
                  cafeName={shop.name}
                  height="280px"
                />
              </div>
            ) : (
              <div className="relative h-64 w-full bg-slate-800">
                <img
                  src={images[activeImageIndex]}
                  alt={shop.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-xs text-white text-[10px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <span>{shop.barangayName}</span>
                  <span>•</span>
                  <span>Calamba City</span>
                </div>

                {/* Photo indicators if multiple */}
                {images.length > 1 && (
                  <div className="absolute bottom-3 right-3 flex gap-1">
                    {images.map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setActiveImageIndex(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === activeImageIndex ? 'bg-white w-4' : 'bg-white/50'
                          }`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Mode Switcher Pills (360 VR vs Gallery Photos) */}
            {shop.panorama360Url && (
              <div className="flex items-center justify-center p-2 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 gap-2">
                <button
                  type="button"
                  onClick={() => setViewMode('360')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === '360'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                >
                  <CompassIcon className="w-3.5 h-3.5" />
                  <span>360° Interior View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('photos')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all ${viewMode === 'photos'
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                    }`}
                >
                  <ImageIcon className="w-3.5 h-3.5" />
                  <span>Photo Gallery ({images.length})</span>
                </button>
              </div>
            )}
          </div>

          {/* Main Title & Overview Header (Wireframe Matched) */}
          <div className="p-4 bg-slate-50/70 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                {shop.name}
              </h1>
              {shop.rating > 0 && (
                <div className="flex items-center gap-1 bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md text-xs font-bold">
                  <span>{shop.rating}</span>
                  <span>★</span>
                </div>
              )}
              {shop.verified && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-md">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600 fill-blue-100" />
                  Verified
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1.5">
              <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span className="font-medium">{shop.barangayName}, Calamba City, Laguna</span>
            </div>

            <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-slate-700 font-medium">
                  Operating Hours: <strong>{shop.operatingHoursText}</strong>
                </span>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isOpen
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-slate-200 text-slate-600'
                  }`}
              >
                {!hasKnownHours ? 'Hours not provided' : isOpen ? 'Open Now' : 'Closed Now'}
              </span>
            </div>

            {/* Shop Availability Days */}
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <CalendarDays className="w-3.5 h-3.5 text-blue-600" />
                <span>Open Days:</span>
              </span>
              <span className="font-bold text-blue-700 bg-blue-50 border border-blue-200/60 px-2 py-0.5 rounded-full text-[11px]">
                {formatOperatingDays(shop.daysOpen)}
              </span>
            </div>
          </div>

          {/* VERIFIED AMENITIES & FEATURES (Exact Wireframe Section) */}
          <div className="p-4 border-b border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Verified Amenities & Features
              </h2>
            </div>

            <div className="space-y-2.5 text-xs">
              {/* Wi-Fi */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Wi-Fi Connectivity</span>
                    <span className="text-[11px] text-slate-500">
                      {shop.amenities.wifiAvailable ? 'Wireless internet available' : 'No Wi-Fi available'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Power Outlets */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                    <Zap className="w-4 h-4 fill-amber-600" />
                  </div>
                  <span className="font-bold text-slate-800">Power Outlets</span>
                </div>
                <span className="font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded-md text-[11px]">
                  {shop.amenities.outletCount > 0
                    ? `${shop.amenities.outletCount} sockets`
                    : 'None available'}
                </span>
              </div>

              {/* Air Conditioning */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-sky-100 text-sky-700 rounded-lg">
                    <Snowflake className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Air Conditioning</span>
                    <span className="text-[11px] text-slate-500">
                      {shop.amenities.acAvailable ? 'Fully Air-Conditioned Space' : 'Open Air / Fan-Cooled'}
                    </span>
                  </div>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>

              {/* Price Range */}
              <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
                    <Coffee className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-slate-800 block">Price Range</span>
                    <span className="text-[11px] text-slate-500">Budget-friendly for students</span>
                  </div>
                </div>
                <span className="font-bold text-slate-900 text-xs">
                  {shop.priceRange}
                </span>
              </div>

              {/* Atmosphere */}
              <div className="pt-1">
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Noise Level</span>
                  </div>
                  <span className="font-bold text-slate-800 text-[11px]">
                    {shop.amenities.noiseLevel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Location & Address Section */}
          <div className="p-4 border-b border-slate-100">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 mb-2">
              Address & Verification
            </h2>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span className="text-slate-800 font-medium">{shop.address}</span>
              </div>
              <div className="text-[11px] text-slate-500 pl-6">
                <strong>Landmark:</strong> {shop.landmark}
              </div>
              <div className="text-[11px] text-slate-500 pl-6 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                <span>Accepted: {shop.amenities.paymentMethods.join(', ')}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Floating Action Bar (Wireframe Matched Buttons) */}
        <div className="absolute bottom-0 inset-x-0 p-3 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-xl space-y-2 z-20">
          <button
            onClick={() => onStartNavigation(shop)}
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2 transition-colors"
          >
            <Navigation className="w-4 h-4" />
            <span>Navigate To This Cafe</span>
          </button>

          <button
            onClick={() => onToggleFavorite(shop.id)}
            className={`w-full py-2 px-4 rounded-xl font-bold text-xs border transition-colors flex items-center justify-center gap-1.5 ${isFavorite
              ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-rose-600 text-rose-600' : 'text-slate-500'}`} />
            <span>{isFavorite ? 'Saved in Favorites' : 'Save Favorite'}</span>
          </button>
        </div>

        {/* Copy toast notification */}
        {copiedToast && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg z-30 animate-in fade-in">
            Link copied to clipboard!
          </div>
        )}
      </div>
    </div>
  );
};
