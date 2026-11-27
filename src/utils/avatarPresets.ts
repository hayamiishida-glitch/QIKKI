export interface AvatarPreset {
  id: string;
  name: string;
  category: 'animals' | 'magical' | 'minimal';
  url: string;
}

function svgToDataUri(svgString: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

export const AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'mochi-cat',
    name: 'Mochi Cat',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffecd2"/>
            <stop offset="100%" stop-color="#fcb69f"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#bg)"/>
        <!-- Ears -->
        <polygon points="26,44 18,18 42,28" fill="#ffffff" stroke="#f43f5e" stroke-width="2"/>
        <polygon points="28,38 22,24 38,30" fill="#fbcfe8"/>
        <polygon points="74,44 82,18 58,28" fill="#ffffff" stroke="#f43f5e" stroke-width="2"/>
        <polygon points="72,38 78,24 62,30" fill="#fbcfe8"/>
        <!-- Head -->
        <circle cx="50" cy="56" r="32" fill="#ffffff"/>
        <!-- Eyes -->
        <ellipse cx="38" cy="54" rx="4.5" ry="5.5" fill="#1e293b"/>
        <ellipse cx="62" cy="54" rx="4.5" ry="5.5" fill="#1e293b"/>
        <circle cx="40" cy="52" r="1.8" fill="#ffffff"/>
        <circle cx="64" cy="52" r="1.8" fill="#ffffff"/>
        <!-- Blush -->
        <ellipse cx="31" cy="62" rx="4" ry="2.2" fill="#fda4af" opacity="0.8"/>
        <ellipse cx="69" cy="62" rx="4" ry="2.2" fill="#fda4af" opacity="0.8"/>
        <!-- Nose & Mouth -->
        <polygon points="50,60 48,58 52,58" fill="#f43f5e"/>
        <path d="M46,63 Q50,66 50,63 Q50,66 54,63" fill="none" stroke="#1e293b" stroke-width="1.8" stroke-linecap="round"/>
        <!-- Whiskers -->
        <line x1="20" y1="56" x2="30" y2="58" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="20" y1="62" x2="29" y2="62" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="80" y1="56" x2="70" y2="58" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
        <line x1="80" y1="62" x2="71" y2="62" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'shiba-star',
    name: 'Shiba Star',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="shibaBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fed7aa"/>
            <stop offset="100%" stop-color="#fdba74"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#shibaBg)"/>
        <!-- Ears -->
        <polygon points="26,38 20,16 42,26" fill="#ea580c"/>
        <polygon points="28,34 24,22 38,28" fill="#ffedd5"/>
        <polygon points="74,38 80,16 58,26" fill="#ea580c"/>
        <polygon points="72,34 76,22 62,28" fill="#ffedd5"/>
        <!-- Head -->
        <circle cx="50" cy="56" r="32" fill="#ea580c"/>
        <!-- White Mask -->
        <path d="M30,58 Q36,44 50,46 Q64,44 70,58 Q66,74 50,76 Q34,74 30,58 Z" fill="#fff7ed"/>
        <!-- Eyes (Happy Wink) -->
        <ellipse cx="38" cy="54" rx="4" ry="4.5" fill="#1c1917"/>
        <circle cx="39" cy="52" r="1.5" fill="#ffffff"/>
        <!-- Wink eye -->
        <path d="M58,54 Q63,49 68,54" fill="none" stroke="#1c1917" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Eyebrow dots -->
        <ellipse cx="38" cy="46" rx="2.5" ry="1.8" fill="#ffffff"/>
        <ellipse cx="62" cy="46" rx="2.5" ry="1.8" fill="#ffffff"/>
        <!-- Blush -->
        <ellipse cx="32" cy="62" rx="4" ry="2" fill="#fb7185" opacity="0.75"/>
        <ellipse cx="68" cy="62" rx="4" ry="2" fill="#fb7185" opacity="0.75"/>
        <!-- Snout & Nose -->
        <ellipse cx="50" cy="61" rx="4" ry="3" fill="#1c1917"/>
        <path d="M50,64 L50,67 M46,67 Q50,71 54,67" fill="none" stroke="#1c1917" stroke-width="2" stroke-linecap="round"/>
        <!-- Little Star -->
        <polygon points="50,22 52,26 56,26 53,29 54,33 50,30 46,33 47,29 44,26 48,26" fill="#facc15"/>
      </svg>
    `),
  },
  {
    id: 'boba-panda',
    name: 'Boba Panda',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="pandaBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#bbf7d0"/>
            <stop offset="100%" stop-color="#86efac"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#pandaBg)"/>
        <!-- Ears -->
        <circle cx="28" cy="28" r="14" fill="#0f172a"/>
        <circle cx="72" cy="28" r="14" fill="#0f172a"/>
        <!-- Head -->
        <circle cx="50" cy="56" r="32" fill="#ffffff"/>
        <!-- Eye Patches -->
        <ellipse cx="36" cy="52" rx="9" ry="7" transform="rotate(-15 36 52)" fill="#0f172a"/>
        <ellipse cx="64" cy="52" rx="9" ry="7" transform="rotate(15 64 52)" fill="#0f172a"/>
        <!-- Eyes -->
        <circle cx="37" cy="52" r="3.2" fill="#ffffff"/>
        <circle cx="63" cy="52" r="3.2" fill="#ffffff"/>
        <circle cx="38" cy="51" r="1.5" fill="#0f172a"/>
        <circle cx="64" cy="51" r="1.5" fill="#0f172a"/>
        <!-- Blush -->
        <ellipse cx="28" cy="62" rx="4.5" ry="2.5" fill="#f472b6" opacity="0.75"/>
        <ellipse cx="72" cy="62" rx="4.5" ry="2.5" fill="#f472b6" opacity="0.75"/>
        <!-- Nose & Mouth -->
        <ellipse cx="50" cy="61" rx="4.5" ry="3" fill="#0f172a"/>
        <path d="M46,65 Q50,68 54,65" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
        <!-- Mini Boba Cup -->
        <rect x="44" y="70" width="12" height="15" rx="3" fill="#fde68a" stroke="#0f172a" stroke-width="1.5"/>
        <line x1="50" y1="67" x2="50" y2="76" stroke="#f43f5e" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="47" cy="80" r="1.2" fill="#0f172a"/>
        <circle cx="53" cy="80" r="1.2" fill="#0f172a"/>
        <circle cx="50" cy="78" r="1.2" fill="#0f172a"/>
      </svg>
    `),
  },
  {
    id: 'astro-fox',
    name: 'Astro Fox',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="foxBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#312e81"/>
            <stop offset="100%" stop-color="#4c1d95"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#foxBg)"/>
        <!-- Stars -->
        <circle cx="20" cy="25" r="1.5" fill="#fde047" opacity="0.9"/>
        <circle cx="80" cy="30" r="1.2" fill="#fde047" opacity="0.9"/>
        <circle cx="75" cy="75" r="1.5" fill="#38bdf8" opacity="0.9"/>
        <!-- Ears -->
        <polygon points="22,40 16,14 44,24" fill="#f97316"/>
        <polygon points="26,34 22,20 40,26" fill="#1e293b"/>
        <polygon points="78,40 84,14 56,24" fill="#f97316"/>
        <polygon points="74,34 78,20 60,26" fill="#1e293b"/>
        <!-- Head -->
        <path d="M18,52 Q50,42 82,52 Q84,70 50,86 Q16,70 18,52 Z" fill="#f97316"/>
        <!-- White Cheeks -->
        <path d="M22,58 Q34,68 50,84 Q66,68 78,58 Q72,50 50,56 Q28,50 22,58 Z" fill="#ffffff"/>
        <!-- Eyes -->
        <ellipse cx="36" cy="56" rx="4.5" ry="5.5" fill="#0f172a"/>
        <ellipse cx="64" cy="56" rx="4.5" ry="5.5" fill="#0f172a"/>
        <circle cx="38" cy="54" r="1.8" fill="#38bdf8"/>
        <circle cx="66" cy="54" r="1.8" fill="#38bdf8"/>
        <!-- Nose -->
        <circle cx="50" cy="74" r="3.5" fill="#0f172a"/>
      </svg>
    `),
  },
  {
    id: 'cotton-bunny',
    name: 'Cotton Bunny',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bunnyBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#f5d0fe"/>
            <stop offset="100%" stop-color="#e9d5ff"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#bunnyBg)"/>
        <!-- Ears -->
        <ellipse cx="36" cy="24" rx="8" ry="18" fill="#ffffff"/>
        <ellipse cx="36" cy="24" rx="4.5" ry="13" fill="#f472b6" opacity="0.65"/>
        <ellipse cx="64" cy="24" rx="8" ry="18" fill="#ffffff"/>
        <ellipse cx="64" cy="24" rx="4.5" ry="13" fill="#f472b6" opacity="0.65"/>
        <!-- Head -->
        <circle cx="50" cy="58" r="30" fill="#ffffff"/>
        <!-- Eyes -->
        <circle cx="38" cy="54" r="4" fill="#3b0764"/>
        <circle cx="62" cy="54" r="4" fill="#3b0764"/>
        <circle cx="39.5" cy="52.5" r="1.5" fill="#ffffff"/>
        <circle cx="63.5" cy="52.5" r="1.5" fill="#ffffff"/>
        <!-- Blush -->
        <circle cx="30" cy="62" r="4" fill="#f472b6" opacity="0.8"/>
        <circle cx="70" cy="62" r="4" fill="#f472b6" opacity="0.8"/>
        <!-- Nose & Mouth -->
        <ellipse cx="50" cy="60" rx="2.5" ry="2" fill="#ec4899"/>
        <path d="M47,63 Q50,66 53,63" fill="none" stroke="#3b0764" stroke-width="1.8" stroke-linecap="round"/>
        <!-- Clover on ear -->
        <circle cx="32" cy="38" r="3" fill="#4ade80"/>
        <circle cx="36" cy="38" r="3" fill="#4ade80"/>
        <circle cx="34" cy="35" r="3" fill="#4ade80"/>
      </svg>
    `),
  },
  {
    id: 'cozy-pengu',
    name: 'Cozy Pengu',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="penguBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#bae6fd"/>
            <stop offset="100%" stop-color="#7dd3fc"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#penguBg)"/>
        <!-- Body -->
        <ellipse cx="50" cy="54" rx="34" ry="36" fill="#0f172a"/>
        <!-- White Belly -->
        <ellipse cx="50" cy="58" rx="24" ry="27" fill="#ffffff"/>
        <!-- Eyes -->
        <circle cx="41" cy="48" r="4" fill="#0f172a"/>
        <circle cx="59" cy="48" r="4" fill="#0f172a"/>
        <circle cx="42.5" cy="46.5" r="1.5" fill="#ffffff"/>
        <circle cx="60.5" cy="46.5" r="1.5" fill="#ffffff"/>
        <!-- Beak -->
        <polygon points="50,52 44,56 56,56" fill="#f97316"/>
        <!-- Blush -->
        <ellipse cx="34" cy="56" rx="3.5" ry="2" fill="#fda4af" opacity="0.8"/>
        <ellipse cx="66" cy="56" rx="3.5" ry="2" fill="#fda4af" opacity="0.8"/>
        <!-- Red Cozy Scarf -->
        <rect x="28" y="66" width="44" height="10" rx="5" fill="#ef4444"/>
        <rect x="52" y="72" width="10" height="18" rx="4" fill="#dc2626"/>
      </svg>
    `),
  },
  {
    id: 'sprout-froggy',
    name: 'Sprout Froggy',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="frogBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#dcfce7"/>
            <stop offset="100%" stop-color="#bbf7d0"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#frogBg)"/>
        <!-- Eye bumps -->
        <circle cx="32" cy="36" r="13" fill="#22c55e"/>
        <circle cx="68" cy="36" r="13" fill="#22c55e"/>
        <!-- Eyes -->
        <circle cx="32" cy="36" r="8" fill="#ffffff"/>
        <circle cx="68" cy="36" r="8" fill="#ffffff"/>
        <circle cx="33" cy="36" r="4.5" fill="#14532d"/>
        <circle cx="67" cy="36" r="4.5" fill="#14532d"/>
        <circle cx="34.5" cy="34" r="1.8" fill="#ffffff"/>
        <circle cx="68.5" cy="34" r="1.8" fill="#ffffff"/>
        <!-- Body -->
        <ellipse cx="50" cy="60" rx="36" ry="28" fill="#22c55e"/>
        <ellipse cx="50" cy="65" rx="24" ry="18" fill="#86efac"/>
        <!-- Smile -->
        <path d="M40,58 Q50,68 60,58" fill="none" stroke="#14532d" stroke-width="2.5" stroke-linecap="round"/>
        <!-- Blush -->
        <circle cx="28" cy="58" r="4" fill="#f43f5e" opacity="0.6"/>
        <circle cx="72" cy="58" r="4" fill="#f43f5e" opacity="0.6"/>
        <!-- Little Plant Sprout -->
        <path d="M50,34 Q50,22 50,18" fill="none" stroke="#15803d" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M50,22 Q42,16 45,22 Q48,26 50,23" fill="#4ade80"/>
        <path d="M50,20 Q58,14 55,20 Q52,24 50,21" fill="#4ade80"/>
      </svg>
    `),
  },
  {
    id: 'honey-bear',
    name: 'Honey Bear',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="bearBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef3c7"/>
            <stop offset="100%" stop-color="#fde68a"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#bearBg)"/>
        <!-- Ears -->
        <circle cx="26" cy="30" r="12" fill="#b45309"/>
        <circle cx="26" cy="30" r="7" fill="#fcd34d"/>
        <circle cx="74" cy="30" r="12" fill="#b45309"/>
        <circle cx="74" cy="30" r="7" fill="#fcd34d"/>
        <!-- Head -->
        <circle cx="50" cy="56" r="32" fill="#b45309"/>
        <!-- Snout -->
        <ellipse cx="50" cy="62" rx="14" ry="11" fill="#fef3c7"/>
        <ellipse cx="50" cy="58" rx="5" ry="3.5" fill="#451a03"/>
        <path d="M47,63 Q50,67 53,63" fill="none" stroke="#451a03" stroke-width="2" stroke-linecap="round"/>
        <!-- Eyes -->
        <circle cx="37" cy="50" r="3.5" fill="#451a03"/>
        <circle cx="63" cy="50" r="3.5" fill="#451a03"/>
        <circle cx="38" cy="49" r="1.2" fill="#ffffff"/>
        <circle cx="64" cy="49" r="1.2" fill="#ffffff"/>
        <!-- Heart Blush -->
        <ellipse cx="30" cy="58" rx="3.5" ry="2" fill="#f87171" opacity="0.75"/>
        <ellipse cx="70" cy="58" rx="3.5" ry="2" fill="#f87171" opacity="0.75"/>
      </svg>
    `),
  },
  {
    id: 'happy-avo',
    name: 'Happy Avocado',
    category: 'magical',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="avoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ecfdf5"/>
            <stop offset="100%" stop-color="#a7f3d0"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#avoBg)"/>
        <!-- Skin -->
        <path d="M50,16 C38,16 30,30 30,46 C30,66 38,84 50,84 C62,84 70,66 70,46 C70,30 62,16 50,16 Z" fill="#15803d"/>
        <!-- Flesh -->
        <path d="M50,20 C41,20 34,32 34,47 C34,64 41,80 50,80 C59,80 66,64 66,47 C66,32 59,20 50,20 Z" fill="#bef264"/>
        <!-- Pit -->
        <circle cx="50" cy="58" r="13" fill="#78350f"/>
        <!-- Face on Pit -->
        <circle cx="46" cy="56" r="1.8" fill="#ffffff"/>
        <circle cx="54" cy="56" r="1.8" fill="#ffffff"/>
        <path d="M47,61 Q50,65 53,61" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/>
        <!-- Blush -->
        <circle cx="43" cy="60" r="1.5" fill="#f43f5e"/>
        <circle cx="57" cy="60" r="1.5" fill="#f43f5e"/>
      </svg>
    `),
  },
  {
    id: 'sakura-spirit',
    name: 'Sakura Spirit',
    category: 'magical',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="sakuraBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffe4e6"/>
            <stop offset="100%" stop-color="#fbcfe8"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#sakuraBg)"/>
        <!-- Petals -->
        <circle cx="50" cy="50" r="28" fill="#ffffff" opacity="0.9"/>
        <path d="M50,18 C46,28 54,28 50,18 Z" fill="#f472b6"/>
        <path d="M50,82 C46,72 54,72 50,82 Z" fill="#f472b6"/>
        <path d="M18,50 C28,46 28,54 18,50 Z" fill="#f472b6"/>
        <path d="M82,50 C72,46 72,54 82,50 Z" fill="#f472b6"/>
        <!-- Cute face -->
        <ellipse cx="42" cy="49" rx="3.5" ry="4.5" fill="#831843"/>
        <ellipse cx="58" cy="49" rx="3.5" ry="4.5" fill="#831843"/>
        <circle cx="43.5" cy="47.5" r="1.5" fill="#ffffff"/>
        <circle cx="59.5" cy="47.5" r="1.5" fill="#ffffff"/>
        <!-- Blush -->
        <circle cx="34" cy="55" r="4" fill="#fb7185" opacity="0.8"/>
        <circle cx="66" cy="55" r="4" fill="#fb7185" opacity="0.8"/>
        <!-- Smile -->
        <path d="M47,54 Q50,58 53,54" fill="none" stroke="#831843" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'cyber-bot',
    name: 'Cyber Bot',
    category: 'minimal',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="botBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0284c7"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#botBg)"/>
        <!-- Antenna -->
        <line x1="50" y1="28" x2="50" y2="16" stroke="#38bdf8" stroke-width="3" stroke-linecap="round"/>
        <circle cx="50" cy="14" r="4" fill="#38bdf8"/>
        <!-- Head -->
        <rect x="24" y="28" width="52" height="46" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="2.5"/>
        <!-- Screen -->
        <rect x="30" y="35" width="40" height="26" rx="8" fill="#0f172a"/>
        <!-- Glowing Cyan Eyes -->
        <circle cx="40" cy="48" r="4.5" fill="#38bdf8"/>
        <circle cx="60" cy="48" r="4.5" fill="#38bdf8"/>
        <circle cx="41.5" cy="46.5" r="1.5" fill="#ffffff"/>
        <circle cx="61.5" cy="46.5" r="1.5" fill="#ffffff"/>
        <!-- Cheeks -->
        <rect x="32" y="52" width="4" height="2" rx="1" fill="#f43f5e"/>
        <rect x="64" y="52" width="4" height="2" rx="1" fill="#f43f5e"/>
      </svg>
    `),
  },
  {
    id: 'neon-q',
    name: 'Neon Q',
    category: 'minimal',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="qBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#2563eb"/>
            <stop offset="50%" stop-color="#7c3aed"/>
            <stop offset="100%" stop-color="#db2777"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#qBg)"/>
        <!-- Glow Circle -->
        <circle cx="50" cy="48" r="22" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.95"/>
        <circle cx="50" cy="48" r="13" fill="none" stroke="#fbcfe8" stroke-width="2" opacity="0.7"/>
        <!-- Tail -->
        <path d="M58,58 L72,74" stroke="#ffffff" stroke-width="8" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'sleepy-koala',
    name: 'Sleepy Koala',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="koalaBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e0e7ff"/>
            <stop offset="100%" stop-color="#c7d2fe"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#koalaBg)"/>
        <!-- Fluffy Ears -->
        <circle cx="24" cy="40" r="14" fill="#94a3b8"/>
        <circle cx="24" cy="40" r="8" fill="#f1f5f9"/>
        <circle cx="76" cy="40" r="14" fill="#94a3b8"/>
        <circle cx="76" cy="40" r="8" fill="#f1f5f9"/>
        <!-- Head -->
        <circle cx="50" cy="54" r="28" fill="#cbd5e1"/>
        <!-- Sleepy Closed Eyes -->
        <path d="M33,52 Q38,56 43,52" fill="none" stroke="#334155" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M57,52 Q62,56 67,52" fill="none" stroke="#334155" stroke-width="2.4" stroke-linecap="round"/>
        <!-- Blush -->
        <ellipse cx="32" cy="59" rx="4" ry="2.2" fill="#fda4af" opacity="0.85"/>
        <ellipse cx="68" cy="59" rx="4" ry="2.2" fill="#fda4af" opacity="0.85"/>
        <!-- Big Oval Nose -->
        <ellipse cx="50" cy="56" rx="5.5" ry="7.5" fill="#334155"/>
        <ellipse cx="48.5" cy="53" rx="1.5" ry="2.2" fill="#94a3b8" opacity="0.6"/>
        <!-- Little Smile -->
        <path d="M47,67 Q50,70 53,67" fill="none" stroke="#334155" stroke-width="1.8" stroke-linecap="round"/>
        <!-- Little Leaf -->
        <path d="M68,28 Q76,22 78,30 Q72,34 68,28 Z" fill="#4ade80"/>
      </svg>
    `),
  },
  {
    id: 'pudding-pup',
    name: 'Pudding Pup',
    category: 'animals',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="pupBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fef08a"/>
            <stop offset="100%" stop-color="#fde047"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#pupBg)"/>
        <!-- Floppy Ears -->
        <ellipse cx="24" cy="52" rx="9" ry="18" transform="rotate(14 24 52)" fill="#92400e"/>
        <ellipse cx="76" cy="52" rx="9" ry="18" transform="rotate(-14 76 52)" fill="#92400e"/>
        <!-- Head -->
        <circle cx="50" cy="54" r="28" fill="#fef3c7"/>
        <!-- Caramel Cap -->
        <path d="M24,46 Q50,22 76,46 Q64,38 50,42 Q36,38 24,46 Z" fill="#b45309"/>
        <!-- Eyes -->
        <circle cx="39" cy="52" r="4" fill="#451a03"/>
        <circle cx="61" cy="52" r="4" fill="#451a03"/>
        <circle cx="40.5" cy="50.5" r="1.4" fill="#ffffff"/>
        <circle cx="62.5" cy="50.5" r="1.4" fill="#ffffff"/>
        <!-- Blush -->
        <ellipse cx="32" cy="59" rx="4" ry="2.2" fill="#fb7185" opacity="0.75"/>
        <ellipse cx="68" cy="59" rx="4" ry="2.2" fill="#fb7185" opacity="0.75"/>
        <!-- Nose & Tongue -->
        <ellipse cx="50" cy="58" rx="4" ry="2.8" fill="#451a03"/>
        <path d="M46,62 Q50,65 54,62" fill="none" stroke="#451a03" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M47,63 Q50,71 53,63 Z" fill="#fb7185"/>
      </svg>
    `),
  },
  {
    id: 'cloud-sheep',
    name: 'Cloud Sheep',
    category: 'magical',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="sheepBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#e0f2fe"/>
            <stop offset="100%" stop-color="#bae6fd"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#sheepBg)"/>
        <!-- Fluffy Wool Puffs -->
        <circle cx="50" cy="30" r="15" fill="#ffffff"/>
        <circle cx="32" cy="38" r="14" fill="#ffffff"/>
        <circle cx="68" cy="38" r="14" fill="#ffffff"/>
        <circle cx="28" cy="56" r="14" fill="#ffffff"/>
        <circle cx="72" cy="56" r="14" fill="#ffffff"/>
        <circle cx="38" cy="70" r="14" fill="#ffffff"/>
        <circle cx="62" cy="70" r="14" fill="#ffffff"/>
        <!-- Ears -->
        <ellipse cx="22" cy="50" rx="7" ry="4" transform="rotate(-20 22 50)" fill="#fed7aa"/>
        <ellipse cx="78" cy="50" rx="7" ry="4" transform="rotate(20 78 50)" fill="#fed7aa"/>
        <!-- Face -->
        <ellipse cx="50" cy="54" rx="20" ry="18" fill="#ffedd5"/>
        <!-- Wool Forehead Bangs -->
        <circle cx="42" cy="38" r="7" fill="#ffffff"/>
        <circle cx="52" cy="36" r="8" fill="#ffffff"/>
        <circle cx="60" cy="39" r="6" fill="#ffffff"/>
        <!-- Eyes -->
        <circle cx="42" cy="53" r="3.4" fill="#1e293b"/>
        <circle cx="58" cy="53" r="3.4" fill="#1e293b"/>
        <circle cx="43.2" cy="51.8" r="1.2" fill="#ffffff"/>
        <circle cx="59.2" cy="51.8" r="1.2" fill="#ffffff"/>
        <!-- Blush & Smile -->
        <ellipse cx="36" cy="59" rx="3.5" ry="2" fill="#fda4af" opacity="0.85"/>
        <ellipse cx="64" cy="59" rx="3.5" ry="2" fill="#fda4af" opacity="0.85"/>
        <path d="M47,60 Q50,63 53,60" fill="none" stroke="#9a3412" stroke-width="1.8" stroke-linecap="round"/>
      </svg>
    `),
  },
  {
    id: 'starry-axolotl',
    name: 'Starry Axolotl',
    category: 'magical',
    url: svgToDataUri(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
        <defs>
          <linearGradient id="axoBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#fae8ff"/>
            <stop offset="100%" stop-color="#f5d0fe"/>
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#axoBg)"/>
        <!-- Gill Frills -->
        <ellipse cx="21" cy="42" rx="10" ry="4.5" transform="rotate(-25 21 42)" fill="#ec4899"/>
        <ellipse cx="18" cy="52" rx="10" ry="4.5" transform="rotate(-5 18 52)" fill="#f472b6"/>
        <ellipse cx="21" cy="62" rx="10" ry="4.5" transform="rotate(20 21 62)" fill="#ec4899"/>
        <ellipse cx="79" cy="42" rx="10" ry="4.5" transform="rotate(25 79 42)" fill="#ec4899"/>
        <ellipse cx="82" cy="52" rx="10" ry="4.5" transform="rotate(5 82 52)" fill="#f472b6"/>
        <ellipse cx="79" cy="62" rx="10" ry="4.5" transform="rotate(-20 79 62)" fill="#ec4899"/>
        <!-- Head -->
        <ellipse cx="50" cy="54" rx="28" ry="24" fill="#fbcfe8"/>
        <!-- Eyes -->
        <circle cx="38" cy="52" r="4" fill="#831843"/>
        <circle cx="62" cy="52" r="4" fill="#831843"/>
        <circle cx="39.5" cy="50.5" r="1.5" fill="#ffffff"/>
        <circle cx="63.5" cy="50.5" r="1.5" fill="#ffffff"/>
        <!-- Blush -->
        <ellipse cx="31" cy="59" rx="4" ry="2.2" fill="#f43f5e" opacity="0.6"/>
        <ellipse cx="69" cy="59" rx="4" ry="2.2" fill="#f43f5e" opacity="0.6"/>
        <!-- Wide Cute Smile -->
        <path d="M43,60 Q50,66 57,60" fill="none" stroke="#831843" stroke-width="2" stroke-linecap="round"/>
        <!-- Sparkle Star -->
        <polygon points="50,22 52,27 57,29 52,31 50,36 48,31 43,29 48,27" fill="#facc15"/>
      </svg>
    `),
  },
];
