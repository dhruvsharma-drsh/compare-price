import { useState, useCallback } from "react";
import { HistoryChart } from "./HistoryChart";

// Types
type Platform = "amazon" | "ebay" | "walmart" | "flipkart" | "brand_store" | "noon" | "coupang" | "ozon";
type CountryCode = "US" | "UK" | "DE" | "IN" | "JP" | "AU" | "CA" | "AE" | "KR" | "RU";
type CurrencyCode = "USD" | "EUR" | "GBP" | "INR" | "JPY" | "AUD" | "CAD" | "AED" | "KRW" | "RUB";

interface SearchContext {
  query: string;
  queryType: "name" | "url" | "barcode";
  countries: CountryCode[];
  platforms: Platform[];
  baseCurrency: CurrencyCode;
  category?: string;
  subcategory?: string;
}

interface Listing {
  listingId: string | null;
  productId: string | null;
  product?: { title: string; imageUrl?: string; brand?: string };
  platform: Platform;
  country: CountryCode;
  url: string;
  local: { amount: number; currency: string } | null;
  converted: { amount: number; currency: string } | null;
  inStock?: boolean;
  rating?: number;
  reviews?: number;
}

interface SearchResponse {
  product?: { title: string; imageUrl?: string; brand?: string };
  listings: Listing[];
  errors: any[];
  warnings: string[];
  stats: {
    lowest: { amount: number; currency: string; platform: string; country: string } | null;
    highest: { amount: number; currency: string } | null;
    count: number;
    maxSavingVsAverage: { amount: number; currency: string } | null;
  };
}

const COUNTRIES: { code: CountryCode; name: string; flag: string }[] = [
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UK", name: "United Kingdom", flag: "🇬🇧" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "AE", name: "UAE", flag: "🇦🇪" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
];

const PLATFORMS: { id: Platform; name: string }[] = [
  { id: "amazon", name: "Amazon" },
  { id: "ebay", name: "eBay" },
  { id: "walmart", name: "Walmart" },
  { id: "flipkart", name: "Flipkart" },
  { id: "noon", name: "Noon" },
  { id: "coupang", name: "Coupang" },
  { id: "ozon", name: "Ozon" },
  { id: "brand_store", name: "Brand Store" },
];

const CURRENCIES: CurrencyCode[] = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "AED", "KRW", "RUB"];

const CATEGORY_DATA: Record<string, { name: string, subcategories: { id: string, name: string }[] }> = {
  electronics: {
    name: "Electronics",
    subcategories: [
      { id: "smartphones", name: "Smartphones" },
      { id: "laptops", name: "Laptops" },
      { id: "headphones", name: "Headphones & Earbuds" },
      { id: "tablets", name: "Tablets" },
      { id: "smartwatches", name: "Smartwatches" },
      { id: "cameras", name: "Cameras" },
      { id: "speakers", name: "Speakers" },
      { id: "monitors", name: "Monitors" },
      { id: "storage", name: "Storage (SSD/HDD)" },
      { id: "tvs", name: "Televisions" },
      { id: "printers", name: "Printers" },
      { id: "routers", name: "Routers & Networking" },
    ]
  },
  gaming: {
    name: "Gaming",
    subcategories: [
      { id: "consoles", name: "Gaming Consoles" },
      { id: "controllers", name: "Controllers & Gamepads" },
      { id: "gaming_laptops", name: "Gaming Laptops" },
      { id: "gaming_monitors", name: "Gaming Monitors" },
      { id: "gaming_chairs", name: "Gaming Chairs" },
      { id: "vr_headsets", name: "VR Headsets" },
      { id: "graphics_cards", name: "Graphics Cards (GPU)" },
    ]
  },
  fashion: {
    name: "Fashion",
    subcategories: [
      { id: "sneakers", name: "Sneakers & Shoes" },
      { id: "sunglasses", name: "Sunglasses" },
      { id: "watches", name: "Watches" },
      { id: "handbags", name: "Handbags & Wallets" },
      { id: "jackets", name: "Jackets & Coats" },
      { id: "perfumes", name: "Perfumes & Fragrances" },
      { id: "backpacks", name: "Backpacks & Bags" },
    ]
  },
  home: {
    name: "Home & Kitchen",
    subcategories: [
      { id: "vacuum_cleaners", name: "Vacuum Cleaners" },
      { id: "air_purifiers", name: "Air Purifiers" },
      { id: "coffee_machines", name: "Coffee Machines" },
      { id: "blenders", name: "Blenders & Mixers" },
      { id: "air_fryers", name: "Air Fryers" },
      { id: "washing_machines", name: "Washing Machines" },
      { id: "refrigerators", name: "Refrigerators" },
      { id: "microwaves", name: "Microwaves & Ovens" },
    ]
  },
  sports: {
    name: "Sports & Fitness",
    subcategories: [
      { id: "fitness_trackers", name: "Fitness Trackers" },
      { id: "treadmills", name: "Treadmills" },
      { id: "dumbbells", name: "Dumbbells & Weights" },
      { id: "yoga_mats", name: "Yoga Mats & Equipment" },
      { id: "cycles", name: "Cycles & Bicycles" },
      { id: "sports_shoes", name: "Sports Shoes" },
    ]
  },
  beauty: {
    name: "Beauty & Health",
    subcategories: [
      { id: "trimmers", name: "Trimmers & Shavers" },
      { id: "hair_dryers", name: "Hair Dryers & Stylers" },
      { id: "skincare", name: "Skincare Devices" },
      { id: "electric_toothbrush", name: "Electric Toothbrushes" },
      { id: "massagers", name: "Massagers" },
    ]
  },
  books: {
    name: "Books & Media",
    subcategories: [
      { id: "textbooks", name: "Textbooks" },
      { id: "novels", name: "Novels & Fiction" },
      { id: "ereaders", name: "E-Readers" },
    ]
  },
  automotive: {
    name: "Automotive",
    subcategories: [
      { id: "dash_cams", name: "Dash Cameras" },
      { id: "car_accessories", name: "Car Accessories" },
      { id: "car_chargers", name: "Car Chargers & Electronics" },
      { id: "tires", name: "Tires" },
    ]
  },
  toys: {
    name: "Toys & Kids",
    subcategories: [
      { id: "action_figures", name: "Action Figures & Collectibles" },
      { id: "lego", name: "LEGO & Building Sets" },
      { id: "drones", name: "Drones" },
      { id: "board_games", name: "Board Games & Puzzles" },
    ]
  },
  office: {
    name: "Office & Stationery",
    subcategories: [
      { id: "office_chairs", name: "Office Chairs" },
      { id: "desks", name: "Desks & Standing Desks" },
      { id: "keyboards", name: "Keyboards" },
      { id: "mice", name: "Mice & Trackpads" },
    ]
  },
  grocery: {
    name: "Groceries & Food",
    subcategories: [
      { id: "protein_supplements", name: "Protein & Supplements" },
      { id: "snacks", name: "Snacks & Chocolates" },
      { id: "beverages", name: "Beverages & Drinks" },
    ]
  },
};

export default function App() {
  const [query, setQuery] = useState("");
  const [selectedCountries, setSelectedCountries] = useState<CountryCode[]>(["US", "IN", "UK"]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(["amazon", "walmart", "flipkart", "ebay"]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("USD");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);
  const [error, setError] = useState("");
  const [engine, setEngine] = useState<"node" | "python">("python");
  const [category, setCategory] = useState<string>("electronics");
  const [subcategory, setSubcategory] = useState<string>("smartphones");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    if (selectedCountries.length === 0) {
      setError("Please select at least one country");
      return;
    }
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    setLoading(true);
    setError("");
    setResults(null);
    setHistoryData(null);

    try {
      const isUrl = /^https?:\/\//i.test(query.trim());
      const payload: SearchContext = {
        query: query.trim(),
        queryType: isUrl ? "url" : "name",
        countries: selectedCountries,
        platforms: selectedPlatforms,
        baseCurrency,
        category,
        subcategory,
      };

      const endpoint = engine === "python" ? "/python-search" : "/search";
      const res = await fetch(import.meta.env.VITE_API_BASE_URL + endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Search failed: " + res.statusText);
      }

      const data: SearchResponse = await res.json();
      
      // Sort listings by converted amount (lowest first)
      if (data.listings && data.listings.length > 0) {
        data.listings.sort((a, b) => {
          if (!a.converted) return 1;
          if (!b.converted) return -1;
          return a.converted.amount - b.converted.amount;
        });
      }
      
      setResults(data);

      // Fetch history if we have a primary productId
      const firstProductId = data.listings.find(l => l.productId)?.productId;
      if (firstProductId) {
        fetchHistory(firstProductId);
      }

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred during search");
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async (productId: string) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/product/${productId}/history?baseCurrency=${baseCurrency}&days=30`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data);
      }
    } catch(err) {
      console.error('Failed to fetch history', err);
    }
  };

  const toggleCountry = (code: CountryCode) => {
    setSelectedCountries(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const toggleAllCountries = () => {
    if (selectedCountries.length === COUNTRIES.length) {
      setSelectedCountries(["US"]); // Reset to default
    } else {
      setSelectedCountries(COUNTRIES.map(c => c.code));
    }
  };

  const togglePlatform = (id: Platform) => {
    setSelectedPlatforms(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))] selection:bg-blue-500/30">
      
      {/* Header */}
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-500/20">
              G
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-300">
              Global Price Compare
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 mr-4 border-r border-white/10 pr-4">
               <label className="text-sm text-slate-400 hidden sm:block">Engine:</label>
               <select 
                 value={engine}
                 onChange={(e) => setEngine(e.target.value as "node" | "python")}
                 className="glass-input py-1 px-3 text-sm font-medium border-emerald-500/30 text-emerald-400"
               >
                 <option value="node" className="bg-slate-900">Node (Fast)</option>
                 <option value="python" className="bg-slate-900">Python (Deep)</option>
               </select>
            </div>
            <label className="text-sm text-slate-400 hidden sm:block">Display Currency:</label>
            <select 
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value as CurrencyCode)}
              className="glass-input py-1 px-3 text-sm font-medium"
            >
              {CURRENCIES.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
            </select>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Search Section */}
        <section className="glass-panel p-6 sm:p-8 relative overflow-hidden transition-all duration-300">
          <div className="absolute top-0 right-0 -m-32 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>
          
          <div className="max-w-3xl mx-auto relative z-10">
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-2 tracking-tight">Find the lowest price, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">globally.</span></h2>
            <p className="text-center text-slate-400 mb-8">Search across multiple countries and platforms to save money on your next purchase.</p>
            
            <form onSubmit={handleSearch} className="space-y-6">
              <div className="relative">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Paste a product URL or enter a product name (e.g., iPhone 15 Pro)"
                  className="w-full glass-input text-lg py-4 pl-5 pr-32 shadow-inner"
                  required
                />
                <button 
                  type="submit" 
                  disabled={loading}
                  className="absolute right-2 top-2 bottom-2 btn-primary px-6 flex items-center gap-2"
                >
                  {loading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>Search</>
                  )}
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/50">
                {/* Country Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-slate-300">Target Countries</h3>
                    <button 
                      type="button" 
                      onClick={toggleAllCountries}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      {selectedCountries.length === COUNTRIES.length ? "Clear All" : "Select All"}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {COUNTRIES.map(c => (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => toggleCountry(c.code)}
                        className={`px-3 py-1.5 rounded-lg text-sm border flex items-center gap-1.5 transition-all ${
                          selectedCountries.includes(c.code) 
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-200" 
                            : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                        }`}
                      >
                        <span className="text-base">{c.flag}</span> {c.code}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Platform Selection */}
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Target Platforms</h3>
                  <div className="flex flex-wrap gap-2">
                    {PLATFORMS.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => togglePlatform(p.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          selectedPlatforms.includes(p.id) 
                            ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-200" 
                            : "bg-slate-800/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                        }`}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/50">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Category</h3>
                  <select 
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      if (CATEGORY_DATA[e.target.value]?.subcategories.length > 0) {
                        setSubcategory(CATEGORY_DATA[e.target.value].subcategories[0].id);
                      }
                    }}
                    className="w-full glass-input py-2 px-3 text-sm font-medium border border-white/10"
                  >
                    {Object.entries(CATEGORY_DATA).map(([id, cat]) => (
                      <option key={id} value={id} className="bg-slate-900">{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-3">Sub-category</h3>
                  <select 
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    className="w-full glass-input py-2 px-3 text-sm font-medium border border-white/10"
                  >
                    {CATEGORY_DATA[category]?.subcategories.map(sub => (
                      <option key={sub.id} value={sub.id} className="bg-slate-900">{sub.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              
              {error && (
                <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p>{error}</p>
                </div>
              )}
            </form>
          </div>
        </section>

        {/* Loading State */}
        {loading && (
          <div className="space-y-4">
            <div className="h-24 glass-panel animate-pulse-slow"></div>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-24 glass-panel animate-pulse-slow" style={{ animationDelay: `${i * 150}ms` }}></div>
                ))}
              </div>
              <div className="h-64 glass-panel animate-pulse-slow"></div>
            </div>
          </div>
        )}

        {/* Results Section */}
        {results && !loading && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Primary Product / Stats summary */}
            <div className="grid md:grid-cols-4 gap-4">
              <div className="md:col-span-1 glass-panel p-5 flex flex-col items-center justify-center text-center">
                {results.product?.imageUrl ? (
                  <div className="w-32 h-32 rounded-lg bg-white p-2 mb-4">
                    <img src={results.product.imageUrl} alt={results.product.title} className="w-full h-full object-contain mix-blend-multiply" />
                  </div>
                ) : (
                  <div className="w-32 h-32 rounded-lg bg-slate-800/80 mb-4 flex items-center justify-center text-slate-500">No Image</div>
                )}
                <h3 className="font-medium text-sm line-clamp-2" title={results.product?.title || query}>
                  {results.product?.title || query}
                </h3>
              </div>
              
              <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-panel p-5 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Lowest Price</p>
                  <p className="text-3xl font-bold text-emerald-400">
                    {results.stats.lowest ? `${results.stats.lowest.amount.toFixed(2)} ${results.stats.lowest.currency}` : "N/A"}
                  </p>
                  {results.stats.lowest && (
                    <p className="text-xs text-slate-500 mt-2 truncate">
                      At {PLATFORMS.find(p => p.id === results.stats.lowest?.platform)?.name} ({results.stats.lowest.country})
                    </p>
                  )}
                </div>
                
                <div className="glass-panel p-5 flex flex-col justify-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Average Price</p>
                  <p className="text-xl font-medium text-slate-300">
                    {results.stats.lowest && results.stats.maxSavingVsAverage ? 
                      `${(results.stats.lowest.amount + results.stats.maxSavingVsAverage.amount).toFixed(2)} ${baseCurrency}` 
                      : "N/A"}
                  </p>
                </div>
                
                <div className="glass-panel p-5 flex flex-col justify-center border-emerald-500/30">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Potential Savings</p>
                  <p className="text-xl font-bold text-emerald-400">
                     {results.stats.maxSavingVsAverage ? `${results.stats.maxSavingVsAverage.amount.toFixed(2)} ${baseCurrency}` : "0.00"}
                  </p>
                  <p className="text-xs text-slate-500 mt-2">vs average market price</p>
                </div>

                <div className="glass-panel p-5 flex flex-col justify-center">
                  <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">Listings Found</p>
                  <p className="text-2xl font-bold text-blue-400">{results.stats.count}</p>
                </div>
              </div>
            </div>

            {/* Warnings */}
            {results.warnings && results.warnings.length > 0 && (
              <div className="glass-panel p-4 bg-amber-500/5 border-amber-500/20">
                <ul className="list-disc pl-5 text-sm text-amber-200/80 space-y-1">
                  {results.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <div className="grid lg:grid-cols-3 gap-6">
              {/* Listings Table */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold px-1">Detailed Comparison</h3>
                
                {results.listings.length > 0 ? (
                  <div className="space-y-2">
                    {results.listings.map((listing, idx) => {
                      const isCheapest = idx === 0 && listing.converted?.amount.toFixed(2) === results.stats.lowest?.amount.toFixed(2);
                      const country = COUNTRIES.find(c => c.code === listing.country);
                      const platform = PLATFORMS.find(p => p.id === listing.platform);
                      
                      return (
                        <div 
                          key={`${listing.platform}-${listing.country}-${idx}`} 
                          className={`glass-panel p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-transform hover:scale-[1.01] ${
                            isCheapest ? "border-emerald-500/50 bg-emerald-500/5" : ""
                          }`}
                        >
                          <div className="flex items-center gap-4 flex-1 overflow-hidden">
                            <div className="w-10 h-10 shrink-0 bg-slate-800 rounded-lg flex items-center justify-center text-lg shadow-inner">
                              {country?.flag}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold">{platform?.name || listing.platform}</span>
                                <span className="text-xs text-slate-400 px-2 py-0.5 rounded-md bg-slate-800/80 border border-slate-700/50">
                                  {country?.name || listing.country}
                                </span>
                                {isCheapest && <span className="badge-cheapest ml-2">Cheapest</span>}
                              </div>
                              <p className="text-sm text-slate-400 truncate" title={listing.product?.title || "Product Listing"}>
                                {listing.product?.title || "Product Listing"}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between sm:justify-end gap-6 sm:w-64 shrink-0">
                            <div className="text-right">
                              <div className="font-bold text-lg text-slate-200">
                                {listing.converted 
                                  ? `${listing.converted.amount.toFixed(2)} ${listing.converted.currency}`
                                  : "Unknown"}
                              </div>
                              {listing.local && listing.local.currency !== baseCurrency && (
                                <div className="text-xs text-slate-500">
                                  {listing.local.amount.toFixed(2)} {listing.local.currency}
                                </div>
                              )}
                            </div>
                            
                            <a 
                              href={listing.url} 
                              target="_blank" 
                              rel="noreferrer"
                              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                              title="View on store"
                            >
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-panel p-12 text-center text-slate-400">
                    <p className="mb-2 text-lg">No listings found</p>
                    <p className="text-sm">Try broadening your search or selecting more platforms/countries.</p>
                  </div>
                )}
              </div>
              
              {/* Sidebar: History Chart & Errors */}
              <div className="space-y-6">
                <div className="glass-panel p-5">
                  <h3 className="text-sm font-semibold mb-4 text-slate-300">Price History (30 Days)</h3>
                  {historyData?.series?.length > 0 ? (
                    <div className="h-64">
                      <HistoryChart series={historyData.series} />
                    </div>
                  ) : (
                    <div className="h-64 flex items-center justify-center border border-dashed border-slate-700/50 rounded-lg text-slate-500 text-sm p-6 text-center">
                      Not enough historical data collected for this product yet.
                    </div>
                  )}
                </div>
                
                {results.errors && results.errors.length > 0 && (
                  <div className="glass-panel p-5 bg-red-500/5 border-red-500/10">
                    <h3 className="text-sm font-semibold mb-3 text-red-400">Failed Sources ({results.errors.length})</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                      {results.errors.map((e, i) => (
                        <div key={i} className="text-xs bg-black/20 p-2 rounded border border-white/5">
                          <span className="font-semibold text-slate-300">{e.platform} ({e.country}):</span> 
                          <span className="text-slate-400 ml-1 block mt-1">{e.error}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
          </div>
        )}

      </main>
    </div>
  );
}
