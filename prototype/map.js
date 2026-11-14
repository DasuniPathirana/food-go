/* Original illustrated game map. No map service or location data is used. */
(function () {
  'use strict';

  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const number = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const bounded = (value, fallback) => Math.max(3, Math.min(97, number(value, fallback)));
  const food = type => {
    const key = String(type || '').toLowerCase();
    if (key.includes('pizza') || key.includes('italian')) return '<path d="M15 4 27 27 4 22Z" fill="#f1c978" stroke="#805a39" stroke-width="1.4"/><path d="M15 4q8 4 12 23" fill="none" stroke="#bc7851" stroke-width="4" stroke-linecap="round"/><circle cx="14" cy="16" r="2.5" fill="#ad5142"/><circle cx="19" cy="22" r="2" fill="#ad5142"/><path d="m9 19 3-3m7-3 2 2" stroke="#436950" stroke-width="2"/>';
    if (key.includes('coffee') || key.includes('cafe') || key.includes('bakery')) return '<path d="M8 12h15v9a7 7 0 0 1-7 7h-1a7 7 0 0 1-7-7Z" fill="#fff9e9" stroke="#61745d" stroke-width="1.5"/><path d="M23 14h3a4 4 0 0 1 0 8h-3" fill="none" stroke="#61745d" stroke-width="2"/><ellipse cx="15.5" cy="12" rx="7.5" ry="2.2" fill="#8e6648"/><path d="M12 8c-3-3 2-3 0-6m7 6c-3-3 2-3 0-6" fill="none" stroke="#96a18a" stroke-width="1.5" stroke-linecap="round"/>';
    if (key.includes('market')) return '<path d="m6 13 3-8h18l3 8Z" fill="#b47651"/><path d="M6 13h24v4H6z" fill="#eed7a3"/><path d="M9 17v12h18V17" fill="#faf2d5" stroke="#7e8867" stroke-width="1.5"/><path d="M14 21h8v8h-8z" fill="#72875c"/><path d="M12 5 10 13m9-8v8m6-8 2 8" stroke="#f9ebcb" stroke-width="3"/>';
    return '<path d="M16 4C10 4 5 14 5 21a11 11 0 0 0 22 0C27 14 22 4 16 4Z" fill="#81a461" stroke="#46694c" stroke-width="1.4"/><path d="M16 8c-4 0-8 8-8 13a8 8 0 0 0 16 0c0-5-4-13-8-13Z" fill="#d9df8a"/><circle cx="16" cy="22" r="5" fill="#956947"/><path d="M14 20c0-2 2-3 3-2" fill="none" stroke="#c6a077" stroke-width="1.5" stroke-linecap="round"/>';
  };

  function tree(x, y, r, colour) {
    return `<g transform="translate(${x} ${y})"><ellipse cx="3" cy="${r * .72}" rx="${r * .85}" ry="${r * .32}" fill="#547157" opacity=".11"/><path d="M0 0v${r * .9}" stroke="#788567" stroke-width="3"/><circle cy="-3" r="${r}" fill="${colour || '#9fb88a'}"/><circle cx="${-r * .24}" cy="${-r * .27}" r="${r * .72}" fill="#c0cf9d" opacity=".65"/></g>`;
  }

  function building(x, y, w, h, colour, seed) {
    const lines = [];
    if (w > 37 && h > 25) {
      for (let wx = x + 9; wx < x + w - 5; wx += 15) {
        lines.push(`<path d="M${wx} ${y + 8}v${Math.min(h - 15, 12)}" stroke="#fffdf1" stroke-width="4" opacity=".42"/>`);
      }
    }
    return `<g><rect x="${x + 4}" y="${y + 6}" width="${w}" height="${h}" rx="3" fill="#7e8a69" opacity=".14"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${colour}" stroke="#fcfaf0" stroke-width="2"/><path d="M${x + 4} ${y + h - 3}h${w - 8}" stroke="#7d896a" stroke-width="2" opacity=".22"/>${lines.join('')}${seed % 3 === 0 ? `<rect x="${x + w - 14}" y="${y + h - 15}" width="7" height="7" rx="1" fill="#9aab8b" opacity=".6"/>` : ''}</g>`;
  }

  function background() {
    let buildings = '';
    const colours = ['#c9cbb1','#d7cfb6','#c9c5aa','#d9d1ba','#c2c9b0','#d5c9af','#c4c7b1'];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 11; col++) {
        const x = col * 144 - 64;
        const y = row * 120 - 62;
        const seed = row * 17 + col * 11;
        // Leave uninterrupted green spaces for the neighbourhood gardens.
        if ((col >= 2 && col <= 3 && row >= 1 && row <= 3) || (col >= 8 && col <= 10 && row >= 4 && row <= 5)) continue;
        buildings += `<rect x="${x}" y="${y}" width="118" height="92" rx="8" fill="#e3e4ce"/>`;
        if (seed % 4 === 0) {
          buildings += building(x + 8, y + 8, 96, 35, colours[seed % 7], seed);
          buildings += building(x + 8, y + 49, 43, 35, colours[(seed + 2) % 7], seed + 1);
          buildings += building(x + 58, y + 49, 45, 35, colours[(seed + 3) % 7], seed + 2);
        } else if (seed % 4 === 1) {
          buildings += building(x + 8, y + 8, 46, 74, colours[seed % 7], seed);
          buildings += building(x + 61, y + 8, 45, 33, colours[(seed + 2) % 7], seed + 1);
          buildings += building(x + 61, y + 48, 45, 34, colours[(seed + 4) % 7], seed + 2);
        } else {
          for (let n = 0; n < 3; n++) {
            buildings += building(x + 7 + n * 36, y + 9, 29, 32, colours[(seed + n) % 7], seed + n);
            buildings += building(x + 7 + n * 36, y + 49, 29, 33, colours[(seed + n + 2) % 7], seed + n + 1);
          }
        }
        if (seed % 3 === 1) buildings += tree(x + 113, y + 85, 7, '#a4b98a');
      }
    }
    let grove = '';
    for (let i = 0; i < 48; i++) {
      const x = 261 + (i * 67 % 236);
      const y = 87 + (i * 53 % 312);
      if (Math.abs((x - 275) - (y - 100) * .55) < 19) continue;
      grove += tree(x, y, 10 + i % 5, ['#9ab380','#acc293','#8eaa79'][i % 3]);
    }
    let southernTrees = '';
    for (let i = 0; i < 31; i++) southernTrees += tree(1110 + i * 43 % 292, 461 + i * 37 % 176, 9 + i % 5, ['#a1b789','#aec296','#91aa7d'][i % 3]);
    let avenue = '';
    for (let i = 0; i < 20; i++) avenue += tree(56 + i * 77, 712 + Math.sin(i * .7) * 12, 8, '#a0b68c');
    return `<svg class="map-base" viewBox="0 0 1500 1000" preserveAspectRatio="xMidYMid slice" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="fgm-grass" width="24" height="24" patternUnits="userSpaceOnUse"><path d="m4 17 1-3m12 5 1-2" stroke="#8eaa76" stroke-width="1" opacity=".22"/></pattern>
        <pattern id="fgm-water" width="66" height="32" patternUnits="userSpaceOnUse"><path d="M6 17h20m16-9h13" stroke="#e5f1dc" stroke-width="2" stroke-linecap="round" opacity=".43"/></pattern>
      </defs>
      <rect width="1500" height="1000" fill="#e9e9d7"/>
      <path d="M-80 846C205 700 317 978 594 868S928 731 1150 814s298 88 446-5v270H-80Z" fill="#afcfc1"/>
      <path d="M-80 846C205 700 317 978 594 868S928 731 1150 814s298 88 446-5v270H-80Z" fill="url(#fgm-water)"/>
      <path d="M-80 817C205 671 317 949 594 839S928 702 1150 785s298 88 446-5" fill="none" stroke="#c4d2af" stroke-width="35"/>
      <path d="M-80 816C205 670 317 948 594 838S928 701 1150 784s298 88 446-5" fill="none" stroke="#faf8e7" stroke-width="5"/>
      <g transform="rotate(-11 750 450)">
        <path d="M-100 412H1650" stroke="#f5f3e6" stroke-width="39"/>
        <path d="M-100 412H1650" stroke="#d7c69c" stroke-width="3"/>
        <path d="M667-150v1080" stroke="#f8f6e8" stroke-width="35"/>
        <path d="M667-150v1080" stroke="#d7c69c" stroke-width="3"/>
        ${buildings}
        <rect x="247" y="63" width="264" height="340" rx="20" fill="#c0d1a6"/>
        <rect x="247" y="63" width="264" height="340" rx="20" fill="url(#fgm-grass)"/>
        <path d="M265 80 492 384M265 384 492 80M378 70v325M254 233h249" stroke="#e9e8ca" stroke-width="7"/>
        <ellipse cx="378" cy="234" rx="47" ry="49" fill="#d9dfb9"/>
        <ellipse cx="378" cy="234" rx="18" ry="20" fill="#a2c4b5" stroke="#eeeccf" stroke-width="5"/>
        ${grove}
        <path d="M1101 446h304v208h-304Z" fill="#c2d2a9"/>
        <path d="M1101 446h304v208h-304Z" fill="url(#fgm-grass)"/>
        <path d="M1110 635q160-177 282-125M1110 465q127 90 282 105" fill="none" stroke="#eae8cb" stroke-width="7"/>
        ${southernTrees}
        <g fill="#777f69" font-family="Arial,sans-serif" font-size="11" letter-spacing="2.1" text-anchor="middle">
          <text x="870" y="417">GERTRUDE STREET</text><text x="900" y="299">MOOR STREET</text>
          <text x="875" y="536">VICTORIA PARADE</text><text x="887" y="178">JOHNSTON STREET</text>
          <text transform="translate(674 237) rotate(-90)">BRUNSWICK STREET</text>
          <text transform="translate(1105 265) rotate(-90)">SMITH STREET</text>
          <text transform="translate(235 530) rotate(-90)">RATHDOWNE STREET</text>
        </g>
        <g fill="#577155" font-family="Arial,sans-serif" font-size="13" letter-spacing="2.5" text-anchor="middle"><text x="378" y="260">CARLTON</text><text x="378" y="280">GARDENS</text><text x="1250" y="617">FITZROY GARDENS</text></g>
      </g>
      <path d="M80 758q422-81 681-25t740-23" fill="none" stroke="#faf8e7" stroke-width="16"/>
      <path d="M80 758q422-81 681-25t740-23" fill="none" stroke="#d9d2b1" stroke-width="2"/>
      ${avenue}
      <path d="m457 802 43 112m444-161 13 100" stroke="#8ca993" stroke-width="35"/>
      <path d="m457 802 43 112m444-161 13 100" stroke="#faf7e6" stroke-width="27"/>
      <path d="m457 802 43 112m444-161 13 100" stroke="#d5c29b" stroke-width="2"/>
      <g fill="#6c8068" font-family="Arial,sans-serif" text-anchor="middle" font-weight="600" font-size="20" letter-spacing="5"><text x="279" y="74">CARLTON</text><text x="1038" y="142">FITZROY</text><text x="643" y="675">EAST MELBOURNE</text></g>
      <text x="1150" y="925" fill="#739f92" font-family="Georgia,serif" font-size="20" font-style="italic" letter-spacing="3" transform="rotate(8 1150 925)">Yarra River</text>
      <g fill="#e7edd6" stroke="#8bb3a0" stroke-width="1"><path d="m150 836 24 7-20 5Z"/><path d="m798 850 22-3-16 12Z"/><path d="m1302 871 22 6-18 6Z"/></g>
    </svg>`;
  }

  const mapStyles = `<style>
    .map-world{position:absolute;inset:0;transform-origin:center;isolation:isolate;background:#e9e9d7;overflow:hidden;transition:transform .45s ease}
    .map-base,.map-route{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
    .map-route{z-index:2;overflow:visible}
    .map-pin{position:absolute;z-index:5;display:flex;align-items:center;flex-direction:column;gap:0;transform:translate(-50%,-80%);border:0;background:transparent;padding:7px;cursor:pointer;color:#183d32;min-width:58px;isolation:isolate;transition:filter .2s,transform .2s;font-family:inherit}
    .map-pin:hover,.map-pin:focus-visible{z-index:9;transform:translate(-50%,-85%) scale(1.06);filter:drop-shadow(0 4px 7px #183d3220)}
    .map-pin:focus-visible{outline:2px solid #183d32;outline-offset:5px;border-radius:18px}
    .pin-photo{width:61px;height:61px;display:block;border:4px solid #fffdf4;border-radius:50%;background:#f7f4e8;box-shadow:0 4px 0 #abc1a2,0 9px 15px #294b3529;overflow:hidden;position:relative}
    .pin-photo img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
    .map-pin::after{content:'';position:absolute;z-index:-1;left:50%;top:66px;width:6px;height:25px;transform:translateX(-50%);background:#688861;border-radius:0 0 4px 4px;box-shadow:1px 0 #f8f6e8}
    .map-pin::before{content:'';position:absolute;z-index:-2;left:50%;top:84px;width:38px;height:12px;transform:translateX(-50%);border:2px solid #72966566;background:#9cb98566;border-radius:50%}
    .map-pin.selected .pin-photo{border-color:#e6b55b;box-shadow:0 4px 0 #a78a4e,0 9px 20px #294b3536}
    .pin-type{position:absolute;right:1px;bottom:0;width:21px;height:21px;border:2px solid #fffdf4;border-radius:50%;background:#254c3d;display:grid;place-items:center;color:#fffdf4}
    .pin-label{display:block;margin-top:10px;padding:5px 9px;border:1px solid #e0dfca;background:#fffdf5eF;border-radius:6px;box-shadow:0 3px 8px #2348310c;font-size:10px;font-weight:700;white-space:nowrap;letter-spacing:.05px}
    .pin-xp{position:absolute;left:50%;top:-8px;transform:translateX(-50%);padding:3px 7px;background:#254c3d;color:#fffef6;border:2px solid #fffdf5;border-radius:5px;font-size:9px;font-weight:750;letter-spacing:.6px;white-space:nowrap}
    .map-pin.visited .pin-xp{background:#8a754c}
    .explorer{position:absolute;z-index:6;width:62px;height:82px;transform:translate(-50%,-80%);pointer-events:none;transition:left .6s ease,top .6s ease}
    .explorer-avatar{width:62px;height:82px;position:relative;z-index:2;filter:drop-shadow(0 5px 2px #294b3529)}
    .radar{position:absolute;width:152px;height:85px;border:1px solid #6f98745c;border-radius:50%;left:50%;bottom:2px;transform:translate(-50%,50%);background:#96b78b1f}
    .radar::before{content:'';position:absolute;inset:16px 27px;border-radius:50%;border:1px solid #6f98746b;background:#96b78b26}
    .radar::after{content:'';position:absolute;inset:-22px -38px;border-radius:50%;border:1px solid #6f98742c;animation:fgm-pulse 4s ease-out infinite}
    .explorer-name{position:absolute;z-index:3;bottom:-17px;left:50%;transform:translateX(-50%);font-size:8px;font-weight:800;letter-spacing:1.2px;background:#fffdf5;border:1px solid #d6ddc7;padding:4px 8px;border-radius:5px;white-space:nowrap;color:#294d39}
    .wild-token{position:absolute;z-index:4;width:42px;height:42px;transform:translate(-50%,-50%);display:grid;place-items:center;background:#fff9e9;border:2px solid #edce8c;border-radius:50%;box-shadow:0 4px 0 #c2b58b,0 6px 10px #23483124;cursor:pointer;animation:fgm-float 4s ease-in-out infinite;transition:scale .2s}
    .wild-token:hover{scale:1.15}.wild-token svg{width:28px;height:28px;pointer-events:none}.wild-token::after{content:'';position:absolute;inset:-7px;border:1px solid #d6bc7980;border-radius:50%}
    .wild-spark{position:absolute;color:#b8944c;font-family:Georgia,serif;font-size:15px;pointer-events:none;animation:fgm-float 3s ease-in-out infinite}
    @keyframes fgm-pulse{0%,100%{opacity:.3;scale:.96}50%{opacity:1;scale:1.04}}
    @keyframes fgm-float{0%,100%{translate:0 0}50%{translate:0 -5px}}
    @media(prefers-reduced-motion:reduce){.map-world,.explorer,.map-pin{transition:none}.radar::after,.wild-token,.wild-spark{animation:none}}
    @media(max-width:700px){.pin-photo{width:48px;height:48px;border-width:3px}.map-pin::after{top:54px;height:21px}.map-pin::before{top:68px}.pin-label{font-size:8px;padding:4px 6px;margin-top:9px;max-width:112px;overflow:hidden;text-overflow:ellipsis}.pin-xp{font-size:8px}.wild-token{width:35px;height:35px}.explorer{width:52px;height:68px}.explorer-avatar{width:52px;height:68px}.radar{width:125px;height:72px}}
  </style>`;

  const base = background();
  const explorerSvg = `<svg class="explorer-avatar" viewBox="0 0 62 82" fill="none" aria-hidden="true"><ellipse cx="31" cy="76" rx="15" ry="5" fill="#416346" opacity=".2"/><path d="M23 53 21 71q3 6 8 1l3-17m2-1 4 18q5 5 8 0l-5-22" fill="#354e43"/><path d="m20 73-3 5h13l-1-6m8 1-1 5h13l-5-6" fill="#faf6e3" stroke="#476349" stroke-width="1.5"/><path d="M22 31q-7 5-8 18l6 3 4-13m16-8q7 7 10 16l-6 4-8-13" fill="#c59d76"/><path d="M23 30q8-4 16 0l4 25q-11 6-23 0Z" fill="#cf946a"/><path d="m25 31 2 12h10l2-12" fill="#edc298"/><path d="M21 36q-7 4-6 18l9 3 1-22" fill="#e5d8b7" stroke="#ab9e7d" stroke-width="1.3"/><path d="M28 21h10v12q-5 5-10 0Z" fill="#c59d76"/><ellipse cx="32" cy="19" rx="10" ry="12" fill="#dbb18a"/><path d="M21 19q-2-13 11-14 14 0 12 15l-7-6-14 6Z" fill="#334f3e"/><path d="M18 14q1-9 14-10 13 0 15 11Z" fill="#d4c9a2"/><ellipse cx="33" cy="15" rx="18" ry="4" fill="#c4b78d"/><path d="M23 10q8-3 18 0" stroke="#64785a" stroke-width="3"/></svg>`;

  window.FoodGoMap = {
    foodIcon(type) { return `<svg viewBox="0 0 34 34" aria-hidden="true">${food(type)}</svg>`; },
    render(venues, state) {
      state = state || {};
      venues = Array.isArray(venues) ? venues : [];
      const visited = state.visited instanceof Set ? state.visited : new Set(state.visited || []);
      const player = state.player || {x:52,y:56};
      const px = bounded(player.x, 52), py = bounded(player.y, 56);
      const routeId = typeof state.route === 'object' && state.route ? state.route.id : state.route;
      const target = venues.find(venue => venue.id === routeId);
      const route = target ? `<svg class="map-route" viewBox="0 0 1500 1000" preserveAspectRatio="none" aria-hidden="true"><path d="M${px*15} ${py*10} L${px*15} ${(py+bounded(target.y,40))*5} L${bounded(target.x,60)*15} ${(py+bounded(target.y,40))*5} L${bounded(target.x,60)*15} ${bounded(target.y,40)*10}" fill="none" stroke="#fffdf4" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M${px*15} ${py*10} L${px*15} ${(py+bounded(target.y,40))*5} L${bounded(target.x,60)*15} ${(py+bounded(target.y,40))*5} L${bounded(target.x,60)*15} ${bounded(target.y,40)*10}" fill="none" stroke="#46775c" stroke-width="5" stroke-dasharray="3 13" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '';
      const pins = venues.map((venue, index) => {
        const done = visited.has(venue.id);
        const selected = state.selected === venue.id || state.selected && state.selected.id === venue.id;
        const x = bounded(venue.x, 25 + index * 15), y = bounded(venue.y, 35 + index % 2 * 14);
        return `<button class="map-pin${selected?' selected':''}${done?' visited':''}" style="left:${x}%;top:${y}%" data-action="venue" data-id="${escape(venue.id)}" aria-label="Explore ${escape(venue.name)}${done?', visited in demo':''}"${selected?' aria-pressed="true"':' aria-pressed="false"'}><span class="pin-xp">${done?'VISITED':venue.rare?'RARE FIND':'+50 XP'}</span><span class="pin-photo"><img src="${escape(venue.image)}" alt="" draggable="false"></span><span class="pin-label">${escape(venue.name)}</span></button>`;
      }).join('');
      const tokens = venues.slice(0, 3).filter(venue => !visited.has(venue.id)).map((venue,index) => {
        const x = bounded(number(venue.x, 30 + index * 20) + (index % 2 ? -8 : 9), 50);
        const y = bounded(number(venue.y, 40) + 14, 55);
        return `<button class="wild-token" style="left:${x}%;top:${y}%;animation-delay:${index * -.8}s" data-action="encounter" data-id="${escape(venue.id)}" aria-label="Discover ${escape(venue.dish || 'a nearby dish')}">${this.foodIcon(venue.dish || venue.cuisine || venue.kind)}<span class="wild-spark" style="right:-11px;top:-12px">+</span></button>`;
      }).join('');
      return `${mapStyles}<div class="map-world">${base}${route}${pins}${tokens}<div class="explorer" style="left:${px}%;top:${py}%"><span class="radar"></span>${explorerSvg}<span class="explorer-name">YOU ARE HERE</span></div></div>`;
    }
  };
})();
