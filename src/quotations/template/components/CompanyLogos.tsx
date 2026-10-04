import watersunLogoBlue from '../../../assets/watersun-logo-blue.png?inline';

interface LogoProps {
  customLogoUrl?: string;
  className?: string;
}

/**
 * Watersun Solar Energy Logo
 * Uses the crisp official 1500x330 inlined brand asset
 */
export const WatersunLogo: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-[75px]' }) => {
  return (
    <img
      src={customLogoUrl || watersunLogoBlue}
      alt="Watersun Solar Energy"
      className={`object-contain ${className}`}
      referrerPolicy="no-referrer"
    />
  );
};

/**
 * GEDA Logo matching Screenshot 2
 */
export const GedaEmblem: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-12' }) => {
  if (customLogoUrl) {
    return <img src={customLogoUrl} alt="GEDA" className={`object-contain ${className}`} referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Circular GEDA Icon */}
      <div className="w-11 h-11 relative flex-shrink-0">
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Outer Ring with green leafy petals */}
          <circle cx="50" cy="50" r="46" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeDasharray="6 3" />
          {/* Middle Cyan Ring */}
          <circle cx="50" cy="50" r="38" fill="none" stroke="#0ea5e9" strokeWidth="2" strokeDasharray="5 2" />
          {/* Inner Orange Sun Spiral */}
          <circle cx="50" cy="50" r="28" fill="#fff" stroke="#f97316" strokeWidth="2" />
          <circle cx="50" cy="50" r="15" fill="#ea580c" />
          {/* 8 rays */}
          <path
            d="M50 12 L50 22 M50 78 L50 88 M12 50 L22 50 M78 50 L88 50 M23 23 L30 30 M70 70 L77 77 M23 77 L30 70 M70 30 L77 23"
            stroke="#ea580c"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
      </div>

      {/* Orange vertical divider bar */}
      <div className="w-[1.5px] h-9 bg-[#f97316]/70 rounded-full" />

      {/* Text Details */}
      <div className="flex flex-col leading-tight text-left">
        <span className="text-[15px] font-black text-[#ea580c] tracking-wider leading-none">
          G E D A
        </span>
        <span className="text-[8.5px] text-[#c2410c] font-bold mt-0.5">
          ગુજરાત ઊર્જા વિકાસ એજન્સી
        </span>
        <span className="text-[7.5px] text-gray-700 font-extrabold uppercase tracking-tight">
          GUJARAT ENERGY DEVELOPMENT AGENCY
        </span>
      </div>
    </div>
  );
};

/**
 * Ministry of New and Renewable Energy Emblem matching Screenshot 2
 */
export const MnreEmblem: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-12' }) => {
  if (customLogoUrl) {
    return <img src={customLogoUrl} alt="MNRE" className={`object-contain ${className}`} referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {/* Ashoka Lion Capital Emblem representation */}
      <div className="w-10 h-11 relative flex-shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 50 64" className="w-full h-full text-gray-800 fill-current">
          {/* Three lion crowns */}
          <circle cx="25" cy="10" r="7" fill="#1f2937" />
          <circle cx="16" cy="14" r="5.5" fill="#374151" />
          <circle cx="34" cy="14" r="5.5" fill="#374151" />
          {/* Lion bodies */}
          <path d="M14 20 L25 24 L36 20 L38 34 L12 34 Z" fill="#1f2937" />
          {/* Base plate with Ashoka Chakra */}
          <rect x="8" y="36" width="34" height="6" fill="#374151" rx="1" />
          <circle cx="25" cy="39" r="3.5" fill="#fff" stroke="#1f2937" strokeWidth="0.8" />
          {/* Satyameva Jayate Banner */}
          <path d="M6 46 L44 46 L40 54 L10 54 Z" fill="#111827" />
          <text x="25" y="52" fontSize="5.5" fontWeight="bold" textAnchor="middle" fill="#ffffff" letterSpacing="0.5">
            सत्यमेव जयते
          </text>
        </svg>
      </div>

      <div className="flex flex-col leading-[1.1] text-left">
        <span className="text-[9.5px] font-bold text-gray-900">नवीन एवं नवीकरणीय ऊर्जा मंत्रालय</span>
        <span className="text-[9.5px] font-extrabold text-gray-950 tracking-tight">MINISTRY OF</span>
        <span className="text-[9.5px] font-extrabold text-gray-950 tracking-tight">NEW AND</span>
        <span className="text-[9.5px] font-extrabold text-gray-950 tracking-tight">RENEWABLE ENERGY</span>
      </div>
    </div>
  );
};

/**
 * PM Surya Ghar Muft Bijli Yojana Quote Banner matching Screenshot 2
 */
export const SuryaGharQuoteBanner: React.FC<LogoProps> = ({ customLogoUrl }) => {
  if (customLogoUrl) {
    return (
      <div className="quotation-surya-banner w-full my-2.5 rounded-sm overflow-hidden border border-sky-300 shadow-xs">
        <img src={customLogoUrl} alt="PM Surya Ghar Muft Bijli Yojana Banner" className="w-full h-auto object-cover" referrerPolicy="no-referrer" />
      </div>
    );
  }

  return (
    <div className="w-full border border-sky-300 rounded-sm overflow-hidden relative shadow-sm my-2.5 bg-gradient-to-r from-sky-100 via-sky-50 to-blue-100">
      {/* Background Solar array landscape aesthetic */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="w-full h-full bg-[linear-gradient(to_right,#0284c7_1px,transparent_1px),linear-gradient(to_bottom,#0284c7_1px,transparent_1px)] bg-[size:16px_16px]" />
      </div>

      <div className="flex flex-row items-stretch relative z-10">
        {/* Left: Translucent Quote Card */}
        <div className="flex-1 p-3 flex flex-col justify-center text-left">
          <div className="bg-white/90 backdrop-blur-xs border border-sky-200/80 rounded p-2.5 shadow-2xs">
            <p className="text-[10px] leading-relaxed italic text-gray-900 font-medium font-serif">
              &ldquo;In order to further sustainable development and people&apos;s well-being, we are launching the{' '}
              <span className="font-bold text-sky-900 not-italic">PM Surya Ghar: Muft Bijli Yojana</span>. This project, with an
              investment of over <span className="font-bold text-gray-950">Rs. 75,000 crores</span>, aims to light up{' '}
              <span className="font-bold text-gray-950">1 crore households</span> by providing up to{' '}
              <span className="font-bold text-sky-900">300 units of free electricity</span> every month.&rdquo;
            </p>
            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-sky-100">
              <span className="text-[9px] font-extrabold text-[#003487]">Shri Narendra Modi</span>
              <span className="text-[7.5px] font-semibold text-gray-600">Hon&apos;ble Prime Minister of India</span>
            </div>
          </div>
        </div>

        {/* Right: Shri Narendra Modi Portrait & Solar Backdrop */}
        <div className="w-36 sm:w-44 bg-gradient-to-br from-sky-400 via-blue-500 to-sky-700 flex-shrink-0 flex items-center justify-center relative overflow-hidden border-l border-sky-300">
          {/* Solar cell angled panels */}
          <div className="absolute inset-0 opacity-40 bg-[repeating-linear-gradient(45deg,#000,#000_10px,#1e40af_10px,#1e40af_20px)]" />

          {/* Prime minister visual representation */}
          <div className="relative z-10 flex flex-col items-center py-2 px-1 text-center">
            <div className="w-16 h-16 rounded-full bg-white/95 p-0.5 shadow-md border-2 border-amber-300 overflow-hidden">
              <svg viewBox="0 0 80 80" className="w-full h-full">
                <circle cx="40" cy="40" r="38" fill="#e0f2fe" />
                {/* Modi portrait depiction */}
                <ellipse cx="40" cy="34" rx="14" ry="16" fill="#fcd34d" />
                {/* White hair & Beard */}
                <path d="M26 26 C26 14 54 14 54 26 C58 36 58 48 40 56 C22 48 22 36 26 26 Z" fill="#ffffff" />
                {/* Face inner */}
                <ellipse cx="40" cy="35" rx="11" ry="12" fill="#fed7aa" />
                {/* Eyes & Glasses */}
                <circle cx="35" cy="33" r="3.5" fill="none" stroke="#374151" strokeWidth="1.2" />
                <circle cx="45" cy="33" r="3.5" fill="none" stroke="#374151" strokeWidth="1.2" />
                <line x1="38.5" y1="33" x2="41.5" y2="33" stroke="#374151" strokeWidth="1.2" />
                {/* White full beard */}
                <path d="M31 38 C31 52 49 52 49 38 C45 46 35 46 31 38 Z" fill="#ffffff" />
                {/* Kurta & Blue Checkered Modi Jacket */}
                <path d="M24 74 L28 48 L52 48 L56 74 Z" fill="#1e3a8a" />
                <path d="M36 48 L40 54 L44 48 Z" fill="#ffffff" />
                {/* Grid checks on jacket */}
                <path d="M28 56 L52 56 M28 64 L52 64 M34 48 L34 74 M46 48 L46 74" stroke="#60a5fa" strokeWidth="0.7" opacity="0.7" />
              </svg>
            </div>
            <span className="text-[8px] font-extrabold text-white mt-1 uppercase tracking-wider drop-shadow-xs">
              PM Surya Ghar
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Tata Power Solaroof Channel Partner Logo matching Screenshot 3
 * Sized for the compact quotation footer while preserving source proportions.
 */
export const TataPowerSolaroofLogo: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-[57px]' }) => {
  const tataEmblemUrl = `${import.meta.env.BASE_URL}tata-2.png`;
  const tataWordmarkUrl = `${import.meta.env.BASE_URL}tata.jpeg`;

  return (
    <div className={`flex w-[270px] items-center gap-[6px] select-none ${className}`}>
      <img
        src={tataEmblemUrl}
        alt="Tata"
        className="h-[57px] w-[86px] shrink-0 object-contain"
        referrerPolicy="no-referrer"
      />
      {customLogoUrl ? (
        <img
          src={customLogoUrl}
          alt="Tata Power Solaroof"
          className="h-[51px] w-[167px] object-contain"
          referrerPolicy="no-referrer"
        />
      ) : (
        /* Preserve the supplied Tata wordmark's original proportions. */
        <div className="h-[51px] w-[167px] shrink-0 overflow-hidden">
          <img
            src={tataWordmarkUrl}
            alt="Tata Power Solaroof"
            className="block h-auto w-full max-w-none"
            style={{ transform: 'translateY(-55px)' }}
            referrerPolicy="no-referrer"
          />
        </div>
      )}
    </div>
  );
};
