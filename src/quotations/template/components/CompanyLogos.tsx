import React from 'react';

interface LogoProps {
  customLogoUrl?: string;
  className?: string;
}

/**
 * High-fidelity Watersun Solar Energy Logo
 * Matches exact font styling, water droplet in A, solar grid in U, and sun in SOLAR
 * Scaled up by an additional 25% (total 75px)
 */
export const WatersunLogo: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-[75px]' }) => {
  if (customLogoUrl) {
    return <img src={customLogoUrl} alt="Watersun Solar Energy" className={`object-contain ${className}`} referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`flex flex-col select-none ${className}`}>
      {/* Primary Brand Name: WATERSUN (scaled additional 25% to 75px) */}
      <svg viewBox="0 0 380 75" className="h-[65px] md:h-[75px] w-auto overflow-visible">
        {/* W */}
        <text x="0" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          W
        </text>

        {/* A with Water Droplet inside */}
        <text x="64" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          A
        </text>
        {/* Droplet in A */}
        <path
          d="M93 30 C90 38 84 44 84 49 C84 54 88 58 93 58 C98 58 102 54 102 49 C102 44 96 38 93 30 Z"
          fill="#1d75d8"
        />
        <circle cx="91" cy="48" r="1.5" fill="#ffffff" opacity="0.8" />

        {/* T */}
        <text x="116" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          T
        </text>

        {/* E */}
        <text x="156" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          E
        </text>
        {/* Middle stylized bar of E */}
        <rect x="166" y="32" width="24" height="6.5" fill="#0c3882" rx="1" />

        {/* R */}
        <text x="204" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          R
        </text>

        {/* S */}
        <text x="250" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          S
        </text>

        {/* U with Solar Grid in base */}
        <text x="290" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          U
        </text>
        {/* Solar panel grid clipping inside U's curve */}
        <g transform="translate(298, 38)">
          <path d="M0,0 Q18,22 36,0 L36,4 Q18,25 0,4 Z" fill="#2563eb" opacity="0.3" />
          <rect x="1" y="2" width="34" height="17" rx="3" fill="#1e40af" />
          {/* Grid lines */}
          <line x1="1" y1="7" x2="35" y2="7" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <line x1="1" y1="12" x2="35" y2="12" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <line x1="10" y1="2" x2="10" y2="19" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <line x1="18" y1="2" x2="18" y2="19" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
          <line x1="26" y1="2" x2="26" y2="19" stroke="#ffffff" strokeWidth="0.8" opacity="0.9" />
        </g>

        {/* N */}
        <text x="340" y="58" fontFamily="system-ui, -apple-system, sans-serif" fontWeight="900" fontSize="62" fill="#0c3882" letterSpacing="-1">
          N
        </text>
      </svg>

      {/* Sub-text: S ☀️ L A R   E N E R G Y (scaled additional 25%) */}
      <div className="flex items-center justify-end gap-2 text-[17px] font-extrabold tracking-[0.28em] text-gray-950 -mt-1.5 pr-1">
        <span>S</span>
        {/* Sun Icon replacing O */}
        <span className="inline-flex items-center justify-center relative -top-px mx-0.5">
          <svg className="w-[21px] h-[21px]" viewBox="0 0 24 24">
            {/* Rays */}
            <circle cx="12" cy="12" r="5" fill="#f59e0b" />
            <path
              d="M12 1.5v3m0 15v3M1.5 12h3m15 0h3m-3.9-6.6l-2.1 2.1m-8.8 8.8l-2.1 2.1m0-13l2.1 2.1m8.8 8.8l2.1 2.1"
              stroke="#f59e0b"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <span>L</span>
        <span>A</span>
        <span>R</span>
        <span className="ml-2">E</span>
        <span>N</span>
        <span>E</span>
        <span>R</span>
        <span>G</span>
        <span>Y</span>
      </div>
    </div>
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
      <div className="w-full my-2.5 rounded-sm overflow-hidden border border-sky-300 shadow-xs">
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
 * Scaled up by an additional 50% (total 81px)
 */
export const TataPowerSolaroofLogo: React.FC<LogoProps> = ({ customLogoUrl, className = 'h-[81px]' }) => {
  if (customLogoUrl) {
    return <img src={customLogoUrl} alt="Tata Power Solaroof" className={`object-contain ${className}`} referrerPolicy="no-referrer" />;
  }

  return (
    <div className={`flex items-center gap-4 select-none ${className}`}>
      {/* Blue Oval Tata Emblem (scaled additional 50%) */}
      <div className="w-[78px] h-[58px] rounded-[50%] bg-[#00529b] flex items-center justify-center text-white flex-shrink-0 shadow-xs">
        <svg viewBox="0 0 24 24" className="w-10 h-9 fill-current">
          {/* Distinctive Tata T */}
          <path d="M5 5 L19 5 L14 18 L10 18 Z" />
          <path d="M8 8 L16 8 L12 16 Z" fill="#00529b" />
          <path d="M10 6 L14 6 L13 14 L11 14 Z" fill="#ffffff" />
        </svg>
      </div>

      {/* TATA POWER / SOLAROOF (scaled additional 50%) */}
      <div className="flex flex-col leading-none">
        <div className="text-[28px] font-black text-[#00529b] tracking-wider font-sans">
          TATA POWER
        </div>
        {/* Orange dividing line */}
        <div className="w-full h-[3.5px] bg-[#f59e0b] my-1.5" />
        {/* SOLAROOF with sun in first O */}
        <div className="flex items-center text-[27px] font-black tracking-wide text-[#ea580c]">
          <span>S</span>
          {/* Radiant Sun in O */}
          <span className="inline-flex items-center justify-center relative mx-1">
            <svg className="w-[25px] h-[25px]" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="6" fill="#0284c7" stroke="#ea580c" strokeWidth="1.5" />
              {/* Solar cell lines inside */}
              <line x1="12" y1="6" x2="12" y2="18" stroke="#ffffff" strokeWidth="0.8" />
              <line x1="6" y1="12" x2="18" y2="12" stroke="#ffffff" strokeWidth="0.8" />
              {/* Sun rays outside */}
              <path
                d="M12 1v3m0 16v3M1 12h3m16 0h3m-4.2-7.8l-2.1 2.1m-9.4 9.4l-2.1 2.1m0-13.6l2.1 2.1m9.4 9.4l2.1 2.1"
                stroke="#f97316"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
            </svg>
          </span>
          <span>LAROOF</span>
        </div>
      </div>
    </div>
  );
};
