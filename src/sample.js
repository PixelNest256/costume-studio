export const SAMPLE_NAME = 'paint-blob';

// An original sample drawing created for this project. It is intentionally
// simple, uses no external resources, and makes it easy to try the vector tools.
export const SAMPLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="blobBody" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0" stop-color="#a78bfa"/>
      <stop offset="0.55" stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#d946ef"/>
    </linearGradient>
    <linearGradient id="blobShine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <ellipse cx="150" cy="272" rx="78" ry="13" fill="#4c1d95" opacity="0.16"/>
  <path d="M150 28c-63 0-106 37-106 94 0 39 18 65 42 85 11 9 17 20 18 33l2 23c1 10 9 18 19 18h50c10 0 18-8 19-18l2-23c1-13 7-24 18-33 24-20 42-46 42-85 0-57-43-94-106-94z"
        fill="url(#blobBody)" stroke="#4c1d95" stroke-width="6" stroke-linejoin="round"/>
  <path d="M86 108c10-31 34-51 63-56 13-2 24 0 34 4-48 5-82 34-97 76-8-7-8-15 0-24z"
        fill="url(#blobShine)"/>
  <ellipse cx="115" cy="146" rx="16" ry="20" fill="#ffffff"/>
  <ellipse cx="185" cy="146" rx="16" ry="20" fill="#ffffff"/>
  <circle cx="119" cy="150" r="8" fill="#2e1065"/>
  <circle cx="181" cy="150" r="8" fill="#2e1065"/>
  <circle cx="116" cy="146" r="3" fill="#ffffff"/>
  <circle cx="178" cy="146" r="3" fill="#ffffff"/>
  <ellipse cx="86" cy="178" rx="14" ry="8" fill="#fb7185" opacity="0.65"/>
  <ellipse cx="214" cy="178" rx="14" ry="8" fill="#fb7185" opacity="0.65"/>
  <path d="M121 184c12 18 46 18 58 0" fill="none" stroke="#2e1065" stroke-width="6"
        stroke-linecap="round"/>
  <path d="M137 201c8 5 18 5 26 0" fill="none" stroke="#2e1065" stroke-width="3"
        stroke-linecap="round" opacity="0.45"/>
  <path d="M47 58l3 10 10 3-10 3-3 10-3-10-10-3 10-3z" fill="#fbbf24"/>
  <path d="M252 92l2 7 7 2-7 2-2 7-2-7-7-2 7-2z" fill="#22d3ee"/>
  <path d="M246 225l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#fbbf24"/>
  <path d="M53 210l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#f472b6"/>
  <circle cx="36" cy="142" r="4" fill="#c4b5fd"/>
  <circle cx="267" cy="156" r="5" fill="#f9a8d4"/>
  <circle cx="225" cy="44" r="4" fill="#a5f3fc"/>
</svg>`;
