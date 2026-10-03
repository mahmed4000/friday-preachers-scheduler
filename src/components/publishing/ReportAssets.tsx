import React from 'react';

/**
 * High-definition vector assets matching the reference Islamic heritage design.
 * Using SVG ensures 100% vector sharpness, zero external network calls,
 * no CORS errors in html-to-image/jsPDF, and perfect PDF reproduction.
 */

// 1. Grand Mosque Architectural View with Islamic Arch Frame (Top-Right of Reference)
export function MosqueHeaderArch({ className = '' }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-bl-3xl ${className}`}>
      <svg
        viewBox="0 0 320 200"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#eef4f8" />
            <stop offset="45%" stopColor="#f5f1e8" />
            <stop offset="100%" stopColor="#ede4d4" />
          </linearGradient>

          <linearGradient id="domeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#f3efe8" />
            <stop offset="100%" stopColor="#d9cfbf" />
          </linearGradient>

          <linearGradient id="archBorderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#c5a059" />
            <stop offset="50%" stopColor="#e3cf96" />
            <stop offset="100%" stopColor="#a37c35" />
          </linearGradient>

          <linearGradient id="sunGlow" x1="50%" y1="0%" x2="50%" y2="100%">
            <stop offset="0%" stopColor="#fff9ea" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Soft morning sky background */}
        <rect width="320" height="200" fill="url(#skyGrad)" />
        <circle cx="210" cy="80" r="120" fill="url(#sunGlow)" />

        {/* Background Clouds / Haze */}
        <path
          d="M0 130 Q40 120 90 128 T180 122 T270 126 T320 124 L320 200 L0 200 Z"
          fill="#e4dad0"
          opacity="0.5"
        />

        {/* Date Palm Trees - Far silhouettes */}
        <g opacity="0.35" fill="#586b59">
          {/* Palm 1 */}
          <path d="M50 170 Q52 140 55 120 Q56 140 58 170 Z" />
          <path d="M55 120 Q35 110 20 125 Q40 115 55 120 Z" />
          <path d="M55 120 Q45 100 35 105 Q48 108 55 120 Z" />
          <path d="M55 120 Q65 100 75 105 Q62 108 55 120 Z" />
          <path d="M55 120 Q75 110 88 122 Q70 115 55 120 Z" />

          {/* Palm 2 */}
          <path d="M280 175 Q278 145 275 125 Q276 145 278 175 Z" />
          <path d="M275 125 Q255 115 240 130 Q260 120 275 125 Z" />
          <path d="M275 125 Q265 105 255 110 Q268 113 275 125 Z" />
          <path d="M275 125 Q285 105 295 110 Q282 113 275 125 Z" />
          <path d="M275 125 Q295 115 310 128 Q290 120 275 125 Z" />
        </g>

        {/* Mosque Main Structure */}
        {/* Rear Wall / Arcades */}
        <rect x="70" y="145" width="250" height="55" fill="#eee7db" />
        <rect x="70" y="145" width="250" height="4" fill="#d9cfbf" />

        {/* Arcade Arches on lower wall */}
        <g fill="#4a524a" opacity="0.25">
          <path d="M80 200 L80 165 Q86 158 92 165 L92 200 Z" />
          <path d="M98 200 L98 165 Q104 158 110 165 L110 200 Z" />
          <path d="M116 200 L116 165 Q122 158 128 165 L128 200 Z" />
          <path d="M134 200 L134 165 Q140 158 146 165 L146 200 Z" />
          <path d="M152 200 L152 165 Q158 158 164 165 L164 200 Z" />
          <path d="M170 200 L170 165 Q176 158 182 165 L182 200 Z" />
          <path d="M188 200 L188 165 Q194 158 200 165 L200 200 Z" />
        </g>

        {/* Mosque Large Central Dome */}
        <g>
          {/* Dome Base Drum */}
          <rect x="145" y="132" width="90" height="16" fill="#f8f4ed" rx="2" />
          <rect x="142" y="146" width="96" height="3" fill="#c5a059" />

          {/* Drum Windows */}
          <g fill="#5a4e3c" opacity="0.4">
            <rect x="152" y="136" width="5" height="8" rx="2.5" />
            <rect x="165" y="136" width="5" height="8" rx="2.5" />
            <rect x="178" y="136" width="5" height="8" rx="2.5" />
            <rect x="191" y="136" width="5" height="8" rx="2.5" />
            <rect x="204" y="136" width="5" height="8" rx="2.5" />
            <rect x="217" y="136" width="5" height="8" rx="2.5" />
          </g>

          {/* Majestic White Dome */}
          <path
            d="M145 132 C145 88 170 65 190 52 C210 65 235 88 235 132 Z"
            fill="url(#domeGrad)"
            stroke="#e4dad0"
            strokeWidth="1"
          />

          {/* Dome Shading Accent */}
          <path
            d="M190 52 C210 65 235 88 235 132 L225 132 C225 92 205 70 190 52 Z"
            fill="#cfc4b2"
            opacity="0.4"
          />

          {/* Dome Crescent & Finial */}
          <rect x="189" y="42" width="2" height="12" fill="#c5a059" />
          <circle cx="190" cy="40" r="3" fill="#c5a059" />
          <path
            d="M190 32 A4 4 0 1 1 187 39 A5 5 0 0 0 190 32 Z"
            fill="#c5a059"
          />
        </g>

        {/* Secondary Left Small Dome */}
        <g>
          <rect x="95" y="140" width="46" height="9" fill="#f8f4ed" />
          <path
            d="M95 140 C95 115 108 100 118 92 C128 100 141 115 141 140 Z"
            fill="url(#domeGrad)"
          />
          <rect x="117.5" y="86" width="1.5" height="7" fill="#c5a059" />
          <circle cx="118.2" cy="85" r="2" fill="#c5a059" />
        </g>

        {/* Tall Islamic Minaret on Right */}
        <g>
          {/* Base */}
          <rect x="245" y="110" width="22" height="90" fill="#f2ecdf" />
          <line x1="245" y1="110" x2="245" y2="200" stroke="#d5c8b5" strokeWidth="1" />

          {/* First Balcony */}
          <rect x="242" y="108" width="28" height="5" fill="#c5a059" rx="1" />
          <rect x="244" y="105" width="24" height="3" fill="#ffffff" />

          {/* Middle Shaft */}
          <rect x="247" y="65" width="18" height="42" fill="#fcf9f2" />

          {/* Narrow windows on shaft */}
          <rect x="254" y="75" width="4" height="8" rx="2" fill="#6d604d" opacity="0.5" />
          <rect x="254" y="90" width="4" height="8" rx="2" fill="#6d604d" opacity="0.5" />

          {/* Second Upper Balcony (Muqarnas / Gallery) */}
          <rect x="243" y="62" width="26" height="4" fill="#c5a059" rx="1" />
          <rect x="245" y="59" width="22" height="3" fill="#ffffff" />

          {/* Upper Pavilion / Lantern */}
          <rect x="248" y="42" width="16" height="18" fill="#f5eee2" />
          <rect x="252" y="46" width="8" height="10" rx="3" fill="#4d4436" opacity="0.6" />

          {/* Pointed Minaret Cap & Crescent */}
          <polygon points="248,42 256,20 264,42" fill="#e8dfce" stroke="#c5a059" strokeWidth="1" />
          <rect x="255.5" y="14" width="1.5" height="8" fill="#c5a059" />
          <circle cx="256.2" cy="13" r="2" fill="#c5a059" />
          <path
            d="M256 8 A3 3 0 1 1 254 13 A3.5 3.5 0 0 0 256 8 Z"
            fill="#c5a059"
          />
        </g>

        {/* Foreground Lush Green Date Palms */}
        <g>
          {/* Left foreground palm */}
          <path d="M22 200 Q26 160 30 135 Q28 160 25 200 Z" fill="#4a3b2c" />
          {/* Fronds */}
          <path d="M30 135 Q10 120 -5 135 Q15 125 30 135 Z" fill="#2d4a34" />
          <path d="M30 135 Q18 108 5 115 Q20 115 30 135 Z" fill="#385e42" />
          <path d="M30 135 Q30 95 24 100 Q28 110 30 135 Z" fill="#477353" />
          <path d="M30 135 Q40 98 48 103 Q40 112 30 135 Z" fill="#385e42" />
          <path d="M30 135 Q50 115 65 125 Q45 122 30 135 Z" fill="#2d4a34" />
          <path d="M30 135 Q48 135 60 148 Q42 140 30 135 Z" fill="#263d2b" />

          {/* Right foreground palm */}
          <path d="M300 200 Q296 165 292 140 Q294 165 298 200 Z" fill="#4a3b2c" />
          <path d="M292 140 Q270 125 255 138 Q275 130 292 140 Z" fill="#2d4a34" />
          <path d="M292 140 Q280 112 268 118 Q282 120 292 140 Z" fill="#385e42" />
          <path d="M292 140 Q296 100 292 105 Q294 115 292 140 Z" fill="#477353" />
          <path d="M292 140 Q305 105 315 110 Q304 118 292 140 Z" fill="#385e42" />
          <path d="M292 140 Q315 122 330 132 Q310 128 292 140 Z" fill="#2d4a34" />
        </g>

        {/* Multi-foil / Scalloped Islamic Arch Mask Border (Curves framing the image) */}
        <path
          d="M0 0 L320 0 L320 200 L250 200 C220 200 180 190 140 160 C100 130 70 80 40 40 C20 15 0 0 0 0 Z"
          fill="none"
          stroke="url(#archBorderGrad)"
          strokeWidth="3"
        />
      </svg>
    </div>
  );
}

// 2. Golden 8-Pointed Star Medallion for Friday Index (1, 2, 3, 4, 5)
export function IslamicStarNumber({ number }: { number: number | string }) {
  return (
    <div className="relative w-8 h-8 flex items-center justify-center shrink-0">
      <svg
        viewBox="0 0 40 40"
        className="w-full h-full drop-shadow-2xs"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`starGold-${number}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#d4af37" />
            <stop offset="50%" stopColor="#f3e5ab" />
            <stop offset="100%" stopColor="#aa7c11" />
          </linearGradient>
        </defs>

        {/* 8-pointed star base shape */}
        {/* Square 1 */}
        <rect
          x="7"
          y="7"
          width="26"
          height="26"
          rx="3"
          fill="#faf6ee"
          stroke="url(#starGold-${number})"
          strokeWidth="1.6"
        />
        {/* Square 2 (rotated 45deg) */}
        <rect
          x="7"
          y="7"
          width="26"
          height="26"
          rx="3"
          transform="rotate(45 20 20)"
          fill="#faf6ee"
          stroke="url(#starGold-${number})"
          strokeWidth="1.6"
        />
        {/* Inner subtle circle */}
        <circle cx="20" cy="20" r="11" fill="#fffdfa" stroke="#e0c78a" strokeWidth="0.8" />
      </svg>
      <span className="absolute font-bold text-xs text-[#2b251a] font-heading tabular-nums leading-none">
        {number}
      </span>
    </div>
  );
}

// 3. Subtle Islamic Mosque & Palm Silhouette for Bottom Background
export function MosqueSkylineSilhouette({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 180"
        className="w-full h-full object-cover"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <g fill="#997a44" opacity="0.09">
          {/* Mosque Cluster 1 (Right) */}
          <path d="M1050 180 L1050 135 Q1065 110 1085 110 Q1105 110 1120 135 L1120 180 Z" />
          {/* Minaret 1 */}
          <rect x="1135" y="60" width="12" height="120" />
          <polygon points="1135,60 1141,35 1147,60" />
          <circle cx="1141" cy="30" r="2.5" />
          <rect x="1133" y="90" width="16" height="4" />
          <rect x="1134" y="62" width="14" height="3" />

          {/* Palms Cluster 1 */}
          <path d="M1020 180 Q1024 150 1026 130 Q1025 150 1022 180 Z" />
          <path d="M1026 130 Q1010 118 995 128 Q1012 120 1026 130 Z" />
          <path d="M1026 130 Q1020 110 1010 114 Q1020 116 1026 130 Z" />
          <path d="M1026 130 Q1032 108 1040 112 Q1032 116 1026 130 Z" />
          <path d="M1026 130 Q1042 118 1055 128 Q1038 120 1026 130 Z" />

          {/* Small Dome */}
          <path d="M960 180 L960 148 Q975 132 990 148 L990 180 Z" />

          {/* Central Mosque Cluster (Center-Right) */}
          <path d="M680 180 L680 130 Q715 95 750 130 L750 180 Z" />
          <rect x="670" y="140" width="140" height="40" />
          {/* Finial */}
          <line x1="715" y1="95" x2="715" y2="78" stroke="#997a44" strokeWidth="2" />
          <circle cx="715" cy="76" r="3" />

          {/* Minaret 2 (Center) */}
          <rect x="645" y="45" width="14" height="135" />
          <polygon points="645,45 652,18 659,45" />
          <circle cx="652" cy="14" r="2.5" />
          <rect x="643" y="78" width="18" height="4" />
          <rect x="644" y="47" width="16" height="3" />

          {/* Palm Trees Center */}
          <path d="M570 180 Q573 145 575 120 Q574 145 571 180 Z" />
          <path d="M575 120 Q555 108 540 118 Q558 112 575 120 Z" />
          <path d="M575 120 Q568 98 558 104 Q568 108 575 120 Z" />
          <path d="M575 120 Q582 98 592 104 Q582 108 575 120 Z" />
          <path d="M575 120 Q595 108 610 118 Q592 112 575 120 Z" />

          {/* Mosque Cluster 3 (Left-Center) */}
          <path d="M420 180 L420 142 Q445 118 470 142 L470 180 Z" />
          <rect x="490" y="70" width="10" height="110" />
          <polygon points="490,70 495,48 500,70" />
          <circle cx="495" cy="45" r="2" />

          {/* Mosque Cluster 4 (Left) */}
          <path d="M120 180 L120 138 Q145 112 170 138 L170 180 Z" />
          {/* Minaret 4 */}
          <rect x="85" y="55" width="12" height="125" />
          <polygon points="85,55 91,30 97,55" />
          <circle cx="91" cy="26" r="2.5" />

          {/* Left Palms */}
          <path d="M210 180 Q213 148 215 125 Q214 148 211 180 Z" />
          <path d="M215 125 Q195 112 180 124 Q198 118 215 125 Z" />
          <path d="M215 125 Q208 102 198 108 Q208 112 215 125 Z" />
          <path d="M215 125 Q222 102 232 108 Q222 112 215 125 Z" />
          <path d="M215 125 Q235 112 250 124 Q232 118 215 125 Z" />
        </g>
      </svg>
    </div>
  );
}

// 4. Subtle Islamic Arabesque / Geometric Background Pattern
export function IslamicPatternOverlay({ className = '' }: { className?: string }) {
  return (
    <div
      className={`pointer-events-none select-none absolute inset-0 ${className}`}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        opacity="0.04"
      >
        <defs>
          <pattern
            id="islamic-geo-grid"
            x="0"
            y="0"
            width="60"
            height="60"
            patternUnits="userSpaceOnUse"
          >
            {/* 8-pointed star tessellation */}
            <path
              d="M30 0 L36 12 L48 6 L42 18 L54 24 L42 30 L54 36 L42 42 L48 54 L36 48 L30 60 L24 48 L12 54 L18 42 L6 36 L18 30 L6 24 L18 18 L12 6 L24 12 Z"
              fill="none"
              stroke="#8a6c2f"
              strokeWidth="0.8"
            />
            <circle cx="30" cy="30" r="6" fill="none" stroke="#8a6c2f" strokeWidth="0.6" />
            <circle cx="0" cy="0" r="10" fill="none" stroke="#8a6c2f" strokeWidth="0.6" />
            <circle cx="60" cy="0" r="10" fill="none" stroke="#8a6c2f" strokeWidth="0.6" />
            <circle cx="0" cy="60" r="10" fill="none" stroke="#8a6c2f" strokeWidth="0.6" />
            <circle cx="60" cy="60" r="10" fill="none" stroke="#8a6c2f" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#islamic-geo-grid)" />
      </svg>
    </div>
  );
}

// 5. Golden Center Footer Ornament
export function IslamicFooterOrnament({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`}>
      <svg width="48" height="24" viewBox="0 0 48 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M4 12 L16 12" stroke="#c5a059" strokeWidth="1" strokeLinecap="round" />
        <path d="M32 12 L44 12" stroke="#c5a059" strokeWidth="1" strokeLinecap="round" />
        {/* Central 8-pointed motif */}
        <rect
          x="19"
          y="7"
          width="10"
          height="10"
          fill="#fbf7ee"
          stroke="#c5a059"
          strokeWidth="1.2"
          transform="rotate(45 24 12)"
        />
        <circle cx="24" cy="12" r="2.5" fill="#c5a059" />
      </svg>
    </div>
  );
}
