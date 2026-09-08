import React from 'react';

export default function PackIllustration({ pack }) {
  const isDuo = /dúo|duo|pareja|romántico|romantico/i.test(`${pack?.id || ''} ${pack?.name || ''}`);
  const isParty = /fiesta|mega|compartir|familiar|pack_mega/i.test(`${pack?.id || ''} ${pack?.name || ''}`);

  if (isDuo) {
    return (
      <svg viewBox="0 0 200 130" width="180" height="110" style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="cupGrad1" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb37e" />
            <stop offset="100%" stopColor="#d97736" />
          </linearGradient>
          <linearGradient id="scoopBerry" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff758c" />
            <stop offset="100%" stopColor="#e83e5a" />
          </linearGradient>
          <linearGradient id="scoopChoc" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a4430" />
            <stop offset="100%" stopColor="#432017" />
          </linearGradient>
          <linearGradient id="scoopCream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6db" />
            <stop offset="100%" stopColor="#f5deb3" />
          </linearGradient>
          <filter id="packShadowDuo" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#432017" floodOpacity="0.14" />
          </filter>
        </defs>
        <ellipse cx="100" cy="118" rx="68" ry="7" fill="#432017" opacity="0.12" />
        <g filter="url(#packShadowDuo)">
          <path d="M40 70 Q70 108 90 70 Z" fill="url(#cupGrad1)" stroke="#b35b24" strokeWidth="1" />
          <path d="M42 72 Q65 92 88 72" fill="none" stroke="#7a3e19" strokeWidth="0.8" opacity="0.4" />
          <circle cx="56" cy="56" r="18" fill="url(#scoopBerry)" />
          <circle cx="75" cy="54" r="16" fill="url(#scoopCream)" />
          <path d="M48 50 Q60 58 72 50 Q80 56 86 52" fill="none" stroke="#432017" strokeWidth="3" strokeLinecap="round" />
          <circle cx="65" cy="40" r="5" fill="#c91834" />
          <path d="M66 36 Q70 28 76 27" fill="none" stroke="#2b1e16" strokeWidth="1.2" strokeLinecap="round" />

          <path d="M110 70 Q130 108 160 70 Z" fill="url(#cupGrad1)" stroke="#b35b24" strokeWidth="1" />
          <path d="M112 72 Q135 92 158 72" fill="none" stroke="#7a3e19" strokeWidth="0.8" opacity="0.4" />
          <circle cx="125" cy="54" r="16" fill="url(#scoopChoc)" />
          <circle cx="144" cy="56" r="18" fill="url(#scoopBerry)" />
          <path d="M118 50 Q130 58 142 50 Q150 56 156 52" fill="none" stroke="#fff4cc" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="145" y="28" width="6" height="32" rx="2" fill="#e5ad74" transform="rotate(22 145 28)" stroke="#9c663b" strokeWidth="0.6" />

          <path d="M100 32 C97 26 89 28 89 34 C89 40 100 47 100 47 C100 47 111 40 111 34 C111 28 103 26 100 32 Z" fill="#ff4d6d" />
          <path d="M96 16 L98 21 L103 23 L98 25 L96 30 L94 25 L89 23 L94 21 Z" fill="#ffd166" opacity="0.9" />
          <path d="M115 18 L116 22 L120 23 L116 24 L115 28 L114 24 L110 23 L114 22 Z" fill="#ffd166" opacity="0.8" />
        </g>
      </svg>
    );
  }

  if (isParty) {
    return (
      <svg viewBox="0 0 200 130" width="180" height="110" style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <linearGradient id="coneGradParty" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f3a683" />
            <stop offset="100%" stopColor="#cf8a4f" />
          </linearGradient>
          <linearGradient id="scoopMangoP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffbe0b" />
            <stop offset="100%" stopColor="#fb5607" />
          </linearGradient>
          <linearGradient id="scoopMentaP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#b7efc5" />
            <stop offset="100%" stopColor="#2ec4b6" />
          </linearGradient>
          <linearGradient id="scoopFresaP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff758c" />
            <stop offset="100%" stopColor="#ff006e" />
          </linearGradient>
          <linearGradient id="scoopChocoP" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7a4430" />
            <stop offset="100%" stopColor="#3d1e16" />
          </linearGradient>
          <filter id="partyShadowParty" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#432017" floodOpacity="0.14" />
          </filter>
        </defs>
        <ellipse cx="100" cy="118" rx="78" ry="7" fill="#432017" opacity="0.12" />
        <g filter="url(#partyShadowParty)">
          <g transform="translate(-8, 8) rotate(-14 55 90)">
            <path d="M44 65 L55 108 L66 65 Z" fill="url(#coneGradParty)" stroke="#aa6834" strokeWidth="0.8" />
            <circle cx="55" cy="55" r="14" fill="url(#scoopMentaP)" />
          </g>
          <g transform="translate(15, 0) rotate(-6 75 90)">
            <path d="M64 60 L75 110 L86 60 Z" fill="url(#coneGradParty)" stroke="#aa6834" strokeWidth="0.8" />
            <circle cx="75" cy="48" r="16" fill="url(#scoopFresaP)" />
            <circle cx="73" cy="42" r="3" fill="#ffffff" opacity="0.6" />
          </g>
          <g transform="translate(0, -6)">
            <path d="M88 56 L100 114 L112 56 Z" fill="url(#coneGradParty)" stroke="#aa6834" strokeWidth="0.8" />
            <circle cx="100" cy="44" r="17" fill="url(#scoopMangoP)" />
            <circle cx="100" cy="30" r="5" fill="#c91834" />
          </g>
          <g transform="translate(-15, 0) rotate(6 125 90)">
            <path d="M114 60 L125 110 L136 60 Z" fill="url(#coneGradParty)" stroke="#aa6834" strokeWidth="0.8" />
            <circle cx="125" cy="48" r="16" fill="url(#scoopChocoP)" />
          </g>
          <g transform="translate(8, 8) rotate(14 145 90)">
            <path d="M134 65 L145 108 L156 65 Z" fill="url(#coneGradParty)" stroke="#aa6834" strokeWidth="0.8" />
            <circle cx="145" cy="55" r="14" fill="url(#scoopFresaP)" />
          </g>
          <circle cx="35" cy="38" r="2.5" fill="#ffbe0b" />
          <circle cx="165" cy="40" r="2.5" fill="#ff006e" />
          <circle cx="48" cy="22" r="2" fill="#2ec4b6" />
          <circle cx="152" cy="24" r="2" fill="#ffbe0b" />
          <path d="M98 12 L100 15 L103 16 L100 17 L98 20 L96 17 L93 16 L96 15 Z" fill="#ffd166" />
          <path d="M68 18 L69 20 L71 21 L69 22 L68 24 L67 22 L65 21 L67 20 Z" fill="#ff758c" />
          <path d="M130 18 L131 20 L133 21 L131 22 L130 24 L129 22 L127 21 L129 20 Z" fill="#ffd166" />
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 200 130" width="180" height="110" style={{ display: 'block', margin: '0 auto' }}>
      <defs>
        <linearGradient id="boxGradBaseDef" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ae1641" />
          <stop offset="100%" stopColor="#7a0e2d" />
        </linearGradient>
        <linearGradient id="ribbonGoldDef" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffd166" />
          <stop offset="100%" stopColor="#f4a261" />
        </linearGradient>
        <filter id="defPackShadowDef" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#432017" floodOpacity="0.15" />
        </filter>
      </defs>
      <ellipse cx="100" cy="116" rx="65" ry="7" fill="#432017" opacity="0.12" />
      <g filter="url(#defPackShadowDef)">
        <path d="M68 45 L78 80 L88 45 Z" fill="#e5ad74" stroke="#ab6c39" strokeWidth="0.8" />
        <circle cx="78" cy="38" r="13" fill="#ff758c" />
        <path d="M112 45 L122 80 L132 45 Z" fill="#e5ad74" stroke="#ab6c39" strokeWidth="0.8" />
        <circle cx="122" cy="38" r="13" fill="#ffd166" />
        <circle cx="100" cy="32" r="15" fill="#7a4430" />
        <rect x="52" y="58" width="96" height="52" rx="8" fill="url(#boxGradBaseDef)" />
        <rect x="46" y="52" width="108" height="14" rx="4" fill="#c7214e" />
        <rect x="94" y="52" width="12" height="58" fill="url(#ribbonGoldDef)" />
        <path d="M96 52 C82 42 82 28 97 38 Z" fill="url(#ribbonGoldDef)" stroke="#d48a37" strokeWidth="0.6" />
        <path d="M104 52 C118 42 118 28 103 38 Z" fill="url(#ribbonGoldDef)" stroke="#d48a37" strokeWidth="0.6" />
        <circle cx="100" cy="46" r="4.5" fill="#ffd166" />
      </g>
    </svg>
  );
}
