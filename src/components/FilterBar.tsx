import React from 'react';
import { FilterState } from '../types';
import { BARANGAYS_LIST } from '../data/calambaLandmarks';
import { Search, Zap, Wifi, Snowflake, MapPin, Clock, X, ChevronDown } from 'lucide-react';

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (newFilters: Partial<FilterState>) => void;
  onResetFilters: () => void;
  resultCount: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  onResetFilters,
  resultCount,
}) => {
  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.barangay !== 'all' ||
    filters.requireOutlets ||
    filters.requireWifi ||
    filters.requireAC ||
    filters.openNowOnly;

  return (
    <div className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 py-3 sticky top-0 z-20 shadow-xs">
      {/* Search Input Box */}
      <div className="relative flex items-center mb-2.5">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={filters.searchQuery}
          onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
          placeholder="Search coffee shop, menu item, or barangay..."
          className="w-full pl-10 pr-10 py-2.5 bg-slate-100/90 border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
        />
        {filters.searchQuery && (
          <button
            onClick={() => onFilterChange({ searchQuery: '' })}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Filter Horizontal Scrollable Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {/* Outlets Filter Pill */}
        <button
          onClick={() => onFilterChange({ requireOutlets: !filters.requireOutlets })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all border ${filters.requireOutlets
            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
        >
          <Zap className={`w-3.5 h-3.5 ${filters.requireOutlets ? 'text-amber-200 fill-amber-200' : 'text-amber-500'}`} />
          <span>Outlets</span>
        </button>

        {/* Wi-Fi Filter Pill */}
        <button
          onClick={() => onFilterChange({ requireWifi: !filters.requireWifi })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all border ${filters.requireWifi
            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
        >
          <Wifi className={`w-3.5 h-3.5 ${filters.requireWifi ? 'text-amber-200' : 'text-blue-500'}`} />
          <span>Wi-Fi</span>
        </button>

        {/* AC Space Filter Pill */}
        <button
          onClick={() => onFilterChange({ requireAC: !filters.requireAC })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all border ${filters.requireAC
            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
        >
          <Snowflake className={`w-3.5 h-3.5 ${filters.requireAC ? 'text-amber-200' : 'text-sky-500'}`} />
          <span>AC Space</span>
        </button>

        {/* Barangay Filter Selector */}
        <div className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all ${filters.barangay !== 'all'
          ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
          : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
          <MapPin className={`w-3.5 h-3.5 shrink-0 ${filters.barangay !== 'all' ? 'text-amber-200' : 'text-rose-500'}`} />
          <select
            value={filters.barangay}
            onChange={(e) => onFilterChange({ barangay: e.target.value === 'all' ? 'all' : Number(e.target.value) })}
            aria-label="Choose a barangay"
            className="appearance-none bg-transparent pr-5 text-xs font-medium outline-none cursor-pointer"
          >
            <option value="all" className="bg-white text-slate-900">All Barangays</option>
            {BARANGAYS_LIST.map((barangay) => (
              <option key={barangay.id} value={barangay.id} className="bg-white text-slate-900">
                {barangay.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 w-3.5 h-3.5" />
        </div>

        {/* Open Now Pill */}
        <button
          onClick={() => onFilterChange({ openNowOnly: !filters.openNowOnly })}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-all border ${filters.openNowOnly
            ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
        >
          <Clock className={`w-3.5 h-3.5 ${filters.openNowOnly ? 'text-amber-200' : 'text-emerald-600'}`} />
          <span>Open Now</span>
        </button>

        {/* Reset Filter Button */}
        {hasActiveFilters && (
          <button
            onClick={onResetFilters}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Result Counter Status */}
      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
        <span>
          Showing <strong className="text-slate-800 font-semibold">{resultCount}</strong> verified coffee shops
        </span>
        {filters.barangay !== 'all' && (
          <span className="text-amber-700 font-medium bg-amber-50 px-2 py-0.5 rounded">
            {BARANGAYS_LIST.find((barangay) => barangay.id === filters.barangay)?.name ?? `Barangay ${filters.barangay}`}
          </span>
        )}
      </div>

    </div>
  );
};
