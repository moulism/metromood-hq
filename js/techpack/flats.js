// Technické nákresy (flats) jako čisté SVG čáry – šablona podle kategorie.
// Pevná černá = obrys a švy, čárkovaná = prošití (topstitch).
// Kdo má vlastní nákres z Illustratoru, nahraje ho v editoru místo šablony.

const OUT = 'fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"';
const SEAM = 'fill="none" stroke="#111" stroke-width="1" stroke-linecap="round"';
const TOP = 'fill="none" stroke="#111" stroke-width=".8" stroke-dasharray="3 2.2"';
const THIN = 'fill="none" stroke="#111" stroke-width=".6"';

const TOPS = {
  tee: { sleeve: "short", neck: "rib" },
  longsleeve: { sleeve: "long", neck: "rib", cuff: "hem" },
  sweatshirt: { sleeve: "long", neck: "rib", cuff: "rib", hemRib: true },
  hoodie: { sleeve: "long", neck: "hood", cuff: "rib", hemRib: true, pocket: "kangaroo" },
  ziphoodie: { sleeve: "long", neck: "hood", cuff: "rib", hemRib: true, pocket: "split", zip: true },
  jacket: { sleeve: "long", neck: "collar", cuff: "button", band: true, placket: true, chest: true, yoke: true },
};
const BOTTOMS = {
  jeans: { len: 340, waist: "band", fly: true, fivePocket: true, opening: 58 },
  pants: { len: 340, waist: "elastic", opening: 40, cuffRib: true, sidePocket: true },
  shorts: { len: 175, waist: "band", fly: true, fivePocket: true, opening: 66 },
  sweatshorts: { len: 165, waist: "elastic", opening: 62, sidePocket: true },
};

export function hasTemplate(category) { return !!(TOPS[category] || BOTTOMS[category]); }

export function flatSVG(category, view = "front") {
  if (TOPS[category]) return top(TOPS[category], view === "back");
  if (BOTTOMS[category]) return bottom(BOTTOMS[category], view === "back");
  return blank();
}

function wrap(inner, vb = "0 0 300 400") {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" class="flat-svg">${inner}</svg>`;
}
function blank() {
  return wrap(`<rect x="20" y="20" width="260" height="360" ${THIN} stroke-dasharray="4 4"/><text x="150" y="205" text-anchor="middle" font-size="12" font-family="Arial" fill="#888">Nahraj vlastní nákres</text>`);
}

// ---------- vršky ----------
function top(o, back) {
  const Y = 50; // posun dolů kvůli kapuci
  const y = (v) => v + Y;
  const long = o.sleeve === "long";
  // body: drop-shoulder, oversized
  const nL = 124, nR = 176, nY = y(40);
  const sL = 76, sR = 224, sY = y(54);
  const uL = 84, uR = 216, uY = y(118);
  const hemY = y(305);
  const hL = 82, hR = 218;
  const frontDrop = back ? y(46) : o.neck === "collar" ? y(70) : y(60);
  let sleeveL, sleeveR, sleeveHem = [];
  if (long) {
    // vnější linie rukávu dolů k manžetě
    sleeveL = `L 34 ${y(298)} L 62 ${y(302)} L ${uL + 2} ${uY}`;
    sleeveR = `L ${300 - 62} ${y(302)} L ${300 - 34} ${y(298)}`;
    sleeveHem = [[34, y(298), 62, y(302)], [300 - 62, y(302), 300 - 34, y(298)]];
  } else {
    sleeveL = `L 26 ${y(124)} L 56 ${y(142)} L ${uL + 2} ${uY}`;
    sleeveR = `L ${300 - 56} ${y(142)} L ${300 - 26} ${y(124)}`;
    sleeveHem = [[26, y(124), 56, y(142)], [300 - 56, y(142), 300 - 26, y(124)]];
  }
  const outline = `M ${nL} ${nY} L ${sL} ${sY} ${sleeveL} L ${hL} ${hemY} L ${hR} ${hemY} L ${uR - 2} ${uY} ${sleeveR} L ${sR} ${sY} L ${nR} ${nY} Q 150 ${frontDrop + 4} ${nL} ${nY} Z`;
  let s = `<path d="${outline}" ${OUT}/>`;
  // průramek
  s += `<path d="M ${sL} ${sY} Q ${sL + 14} ${y(88)} ${uL + 2} ${uY}" ${SEAM}/><path d="M ${sR} ${sY} Q ${sR - 14} ${y(88)} ${uR - 2} ${uY}" ${SEAM}/>`;
  // ramenní šev
  s += `<path d="M ${nL} ${nY} L ${sL} ${sY}" ${SEAM}/><path d="M ${nR} ${nY} L ${sR} ${sY}" ${SEAM}/>`;
  // lem rukávu / manžeta
  const cuffH = o.cuff === "rib" || o.cuff === "button" ? 22 : 9;
  sleeveHem.forEach(([x1, y1, x2, y2], i) => {
    const dx = i === 0 ? 3 : -3;
    const off = cuffH;
    const a = [x1 + dx * (off / 9), y1 - off], b = [x2 + dx * (off / 9) * 0.4, y2 - off];
    if (!long) { a[0] = x1 + (i === 0 ? 5 : -5); a[1] = y1 - 7; b[0] = x2 + (i === 0 ? 4 : -4); b[1] = y2 - 9; }
    s += `<path d="M ${a[0]} ${a[1]} L ${b[0]} ${b[1]}" ${o.cuff === "rib" || o.cuff === "button" ? SEAM : TOP}/>`;
    if (o.cuff === "rib") for (let k = 1; k < 6; k++) {
      const t = k / 6; s += `<path d="M ${a[0] + (x1 - a[0]) * 0 + (b[0] - a[0]) * t} ${a[1] + (b[1] - a[1]) * t} L ${x1 + (x2 - x1) * t} ${y1 + (y2 - y1) * t}" ${THIN}/>`;
    }
    if (o.cuff === "button") s += `<path d="M ${a[0] + 2} ${a[1] + 3} L ${b[0] - 2} ${b[1] + 3}" ${TOP}/><circle cx="${(a[0] + x2) / 2 + (i ? -4 : 4)}" cy="${(a[1] + y2) / 2}" r="2.6" ${SEAM}/>`;
  });
  // spodní lem / pas
  if (o.hemRib || o.band) {
    const bh = o.band ? 16 : 22;
    s += `<path d="M ${hL + 0.5} ${hemY - bh} L ${hR - 0.5} ${hemY - bh}" ${SEAM}/>`;
    if (o.hemRib) for (let x = hL + 8; x < hR; x += 8) s += `<path d="M ${x} ${hemY - bh} L ${x} ${hemY}" ${THIN}/>`;
    if (o.band) s += `<path d="M ${hL + 1} ${hemY - bh + 3} L ${hR - 1} ${hemY - bh + 3}" ${TOP}/><path d="M ${hL + 1} ${hemY - 3} L ${hR - 1} ${hemY - 3}" ${TOP}/>`;
  } else {
    s += `<path d="M ${hL + 0.5} ${hemY - 9} L ${hR - 0.5} ${hemY - 9}" ${TOP}/><path d="M ${hL + 0.5} ${hemY - 6} L ${hR - 0.5} ${hemY - 6}" ${TOP}/>`;
  }
  // výstřih
  if (o.neck === "rib") {
    const d2 = back ? y(50) : frontDrop + 14;
    s += `<path d="M ${nL + 6} ${nY + 3} Q 150 ${d2} ${nR - 6} ${nY + 3}" ${SEAM}/><path d="M ${nL + 7} ${nY + 6} Q 150 ${d2 + 3} ${nR - 7} ${nY + 6}" ${TOP}/>`;
    if (!back) s += `<path d="M ${nL + 2} ${nY - 2} Q 150 ${y(26)} ${nR - 2} ${nY - 2}" ${SEAM}/>`; // zadní výstřih vidět zepředu
  }
  if (o.neck === "hood") {
    if (back) {
      s = `<path d="M ${nL - 4} ${nY + 2} C 98 ${y(-10)} 112 ${y(-46)} 150 ${y(-46)} C 188 ${y(-46)} 202 ${y(-10)} ${nR + 4} ${nY + 2} Q 150 ${nY + 12} ${nL - 4} ${nY + 2} Z" ${OUT}/>` + s;
      s += `<path d="M 150 ${y(-46)} L 150 ${nY + 8}" ${SEAM}/><path d="M 147 ${y(-44)} L 147 ${nY + 6}" ${TOP}/><path d="M 153 ${y(-44)} L 153 ${nY + 6}" ${TOP}/>`;
    } else {
      s += `<path d="M ${nL - 4} ${nY + 2} C 96 ${y(-8)} 112 ${y(-46)} 150 ${y(-46)} C 188 ${y(-46)} 204 ${y(-8)} ${nR + 4} ${nY + 2} L 158 ${y(66)} L 142 ${y(66)} Z" ${OUT}/>`;
      s += `<path d="M ${nL + 8} ${nY + 6} C 114 ${y(0)} 126 ${y(-30)} 150 ${y(-30)} C 174 ${y(-30)} 186 ${y(0)} ${nR - 8} ${nY + 6} L 156 ${y(60)} L 144 ${y(60)} Z" fill="#fff" ${SEAM.replace('fill="none" ', "")}/>`;
      s += `<path d="M ${nL - 1} ${nY + 1} C 101 ${y(-6)} 116 ${y(-40)} 150 ${y(-40)}" ${TOP}/><path d="M ${nR + 1} ${nY + 1} C 199 ${y(-6)} 184 ${y(-40)} 150 ${y(-40)}" ${TOP}/>`;
      // šňůrky + průchodky
      s += `<circle cx="140" cy="${y(54)}" r="2.2" ${SEAM}/><circle cx="160" cy="${y(54)}" r="2.2" ${SEAM}/>`;
      s += `<path d="M 140 ${y(56)} Q 137 ${y(80)} 139 ${y(104)}" ${SEAM}/><path d="M 160 ${y(56)} Q 163 ${y(80)} 161 ${y(104)}" ${SEAM}/>`;
      s += `<rect x="137" y="${y(104)}" width="4" height="8" rx="1" ${SEAM}/><rect x="159" y="${y(104)}" width="4" height="8" rx="1" ${SEAM}/>`;
    }
  }
  if (o.neck === "collar") {
    if (back) {
      s += `<path d="M ${nL - 2} ${nY + 1} Q 150 ${nY - 8} ${nR + 2} ${nY + 1} L ${nR + 6} ${nY + 16} Q 150 ${nY + 8} ${nL - 6} ${nY + 16} Z" ${OUT}/><path d="M ${nL - 3} ${nY + 12} Q 150 ${nY + 4} ${nR + 3} ${nY + 12}" ${TOP}/>`;
    } else {
      s += `<path d="M ${nL} ${nY} L 128 ${y(84)} L 150 ${y(74)} L ${nL + 14} ${nY + 4} Z" ${OUT}/><path d="M ${nR} ${nY} L 172 ${y(84)} L 150 ${y(74)} L ${nR - 14} ${nY + 4} Z" ${OUT}/>`;
      s += `<path d="M ${nL + 3} ${nY + 4} L 131 ${y(80)}" ${TOP}/><path d="M ${nR - 3} ${nY + 4} L 169 ${y(80)}" ${TOP}/>`;
    }
  }
  // sedlo (yoke)
  if (o.yoke) {
    const yy = back ? y(100) : y(96);
    if (back) s += `<path d="M ${uL + 3} ${yy} L 150 ${yy + 22} L ${uR - 3} ${yy}" ${SEAM}/><path d="M ${uL + 4} ${yy + 4} L 150 ${yy + 26} L ${uR - 4} ${yy + 4}" ${TOP}/><path d="M 118 ${yy + 15} L 112 ${hemY - 16}" ${SEAM}/><path d="M 182 ${yy + 15} L 188 ${hemY - 16}" ${SEAM}/><path d="M 115 ${yy + 15} L 109 ${hemY - 16}" ${TOP}/><path d="M 185 ${yy + 15} L 191 ${hemY - 16}" ${TOP}/>`;
    else s += `<path d="M ${uL + 2} ${yy} L 148 ${yy}" ${SEAM}/><path d="M 152 ${yy} L ${uR - 2} ${yy}" ${SEAM}/><path d="M ${uL + 3} ${yy + 3} L 148 ${yy + 3}" ${TOP}/><path d="M 152 ${yy + 3} L ${uR - 3} ${yy + 3}" ${TOP}/>`;
  }
  // léga s knoflíky
  if (o.placket && !back) {
    s += `<path d="M 150 ${y(74)} L 150 ${hemY}" ${SEAM}/><path d="M 156 ${y(78)} L 156 ${hemY - 1}" ${TOP}/><path d="M 144 ${y(78)} L 144 ${hemY - 1}" ${TOP}/>`;
    for (let i = 0; i < 6; i++) s += `<circle cx="150" cy="${y(88 + i * 38)}" r="3.2" ${SEAM}/><circle cx="150" cy="${y(88 + i * 38)}" r="1" fill="#111"/>`;
  }
  if (o.chest && !back) {
    [[98, 132], [168, 202]].forEach(([a, b]) => {
      const t = y(106);
      s += `<path d="M ${a} ${t} L ${b} ${t} L ${b} ${t + 14} L ${(a + b) / 2} ${t + 20} L ${a} ${t + 14} Z" ${OUT}/><path d="M ${a + 2} ${t + 3} L ${b - 2} ${t + 3}" ${TOP}/>`;
      s += `<path d="M ${a + 2} ${t + 14} L ${a + 2} ${t + 44} L ${b - 2} ${t + 44} L ${b - 2} ${t + 14}" ${SEAM}/><path d="M ${(a + b) / 2} ${t + 21} L ${(a + b) / 2} ${t + 44}" ${TOP}/>`;
      s += `<circle cx="${(a + b) / 2}" cy="${t + 14}" r="2.4" ${SEAM}/>`;
    });
  }
  // kapsy
  if (o.pocket === "kangaroo" && !back) {
    const t = y(198), b = hemY - 22;
    s += `<path d="M 108 ${t} L 192 ${t} L 210 ${t + 40} L 210 ${b} L 90 ${b} L 90 ${t + 40} Z" ${SEAM}/>`;
    s += `<path d="M 110 ${t + 3} L 190 ${t + 3}" ${TOP}/><path d="M 92 ${t + 41} L 108.5 ${t + 4}" ${TOP}/><path d="M 208 ${t + 41} L 191.5 ${t + 4}" ${TOP}/>`;
  }
  if (o.pocket === "split" && !back) {
    s += `<path d="M 100 ${y(200)} L 112 ${hemY - 22}" ${SEAM}/><path d="M 200 ${y(200)} L 188 ${hemY - 22}" ${SEAM}/>`;
  }
  if (o.zip && !back) s += `<path d="M 150 ${y(66)} L 150 ${hemY}" stroke="#111" stroke-width="2.2"/><rect x="146.5" y="${y(66)}" width="7" height="12" rx="1.5" ${OUT}/>`;
  // středová značka
  if (back) s += `<path d="M ${nL + 20} ${y(52)} h 10 v 6 h -10 Z" ${THIN}/>`; // hlavní etiketa
  return wrap(s);
}

// ---------- spodky ----------
function bottom(o, back) {
  const wT = 30, wB = 48;
  const hip = 230;
  const L = o.len;
  const op = o.opening;
  const crotch = 150;
  const wl = 92, wr = 208;
  let s = "";
  const outline = `M ${wl} ${wB} L ${wl - 10} ${hip - 80} L ${150 - 8 - op} ${L} L ${150 - 8} ${L} L 150 ${crotch + (L > 200 ? 0 : 0)} L ${150 + 8} ${L} L ${150 + 8 + op} ${L} L ${wr + 10} ${hip - 80} L ${wr} ${wB} Z`;
  s += `<path d="${outline}" ${OUT}/>`;
  // pas
  s += `<path d="M ${wl} ${wT} L ${wr} ${wT} L ${wr} ${wB} L ${wl} ${wB} Z" ${OUT}/>`;
  if (o.waist === "elastic") {
    for (let x = wl + 6; x < wr; x += 6) s += `<path d="M ${x} ${wT + 2} Q ${x + 1.5} ${(wT + wB) / 2} ${x} ${wB - 2}" ${THIN}/>`;
    if (!back) s += `<circle cx="144" cy="${wT + 9}" r="1.8" ${SEAM}/><circle cx="156" cy="${wT + 9}" r="1.8" ${SEAM}/><path d="M 144 ${wT + 10} Q 140 ${wB + 20} 142 ${wB + 34}" ${SEAM}/><path d="M 156 ${wT + 10} Q 160 ${wB + 20} 158 ${wB + 34}" ${SEAM}/>`;
  } else {
    s += `<path d="M ${wl + 1} ${wT + 3} L ${wr - 1} ${wT + 3}" ${TOP}/><path d="M ${wl + 1} ${wB - 3} L ${wr - 1} ${wB - 3}" ${TOP}/>`;
    // poutka
    const loops = back ? [104, 136, 164, 196] : [100, 126, 174, 200];
    loops.forEach((x) => { s += `<rect x="${x - 2.5}" y="${wT - 2}" width="5" height="${wB - wT + 6}" ${OUT}/>`; });
    if (!back) s += `<circle cx="150" cy="${(wT + wB) / 2}" r="4.2" ${SEAM}/><circle cx="150" cy="${(wT + wB) / 2}" r="1.5" fill="#111"/>`;
  }
  // nohavice – lem / manžeta
  const hemOff = o.cuffRib ? 24 : 9;
  [[150 - 8 - op, 150 - 8], [150 + 8, 150 + 8 + op]].forEach(([a, b]) => {
    s += `<path d="M ${a + (o.cuffRib ? 2.5 : 1)} ${L - hemOff} L ${b - (o.cuffRib ? 0.6 : 0.3)} ${L - hemOff}" ${o.cuffRib ? SEAM : TOP}/>`;
    if (o.cuffRib) for (let x = a + 6; x < b; x += 6) s += `<path d="M ${x} ${L - hemOff} L ${x} ${L}" ${THIN}/>`;
  });
  // boční šev (outseam) – naznačení
  if (!back) {
    if (o.fly) {
      s += `<path d="M 150 ${wB} L 150 ${crotch - 6}" ${SEAM}/><path d="M 160 ${wB + 1} L 160 ${crotch - 22} Q 160 ${crotch - 8} 150 ${crotch - 6}" ${TOP}/>`;
      s += `<path d="M 147 ${crotch - 10} l 6 0" stroke="#111" stroke-width="2"/>`; // bartack
    } else {
      s += `<path d="M 150 ${wB} L 150 ${crotch}" ${SEAM}/>`;
    }
    if (o.fivePocket) {
      s += `<path d="M ${wl + 6} ${wB} Q ${wl + 34} ${wB + 4} ${wl + 40} ${wB + 0.5}" ${SEAM}/>`;
      s += `<path d="M ${wl + 6} ${wB} Q ${wl + 12} ${wB + 30} ${wl - 3} ${wB + 34}" ${SEAM}/><path d="M ${wl + 9} ${wB + 1} Q ${wl + 15} ${wB + 30} ${wl - 0.5} ${wB + 37}" ${TOP}/>`;
      s += `<path d="M ${wr - 6} ${wB} Q ${wr - 12} ${wB + 30} ${wr + 3} ${wB + 34}" ${SEAM}/><path d="M ${wr - 9} ${wB + 1} Q ${wr - 15} ${wB + 30} ${wr + 0.5} ${wB + 37}" ${TOP}/>`;
      s += `<path d="M ${wr - 16} ${wB + 4} L ${wr - 16} ${wB + 16} L ${wr - 32} ${wB + 16} L ${wr - 32} ${wB + 4}" ${SEAM}/>`; // coin pocket
      s += `<circle cx="${wl + 6}" cy="${wB + 3}" r="1.8" ${SEAM}/><circle cx="${wr - 6}" cy="${wB + 3}" r="1.8" ${SEAM}/>`; // nýty
    }
    if (o.sidePocket) {
      s += `<path d="M ${wl - 1} ${wB + 10} L ${wl - 6} ${wB + 60}" ${SEAM}/><path d="M ${wr + 1} ${wB + 10} L ${wr + 6} ${wB + 60}" ${SEAM}/>`;
    }
  } else {
    s += `<path d="M 150 ${wB} L 150 ${crotch}" ${SEAM}/><path d="M 153 ${wB} L 153 ${crotch - 4}" ${TOP}/>`;
    if (o.fivePocket) {
      // sedlo + zadní kapsy
      s += `<path d="M ${wl - 1} ${wB + 22} L 150 ${wB + 34} L ${wr + 1} ${wB + 22}" ${SEAM}/><path d="M ${wl - 1} ${wB + 26} L 150 ${wB + 38} L ${wr + 1} ${wB + 26}" ${TOP}/>`;
      [[100, 138], [162, 200]].forEach(([a, b]) => {
        const t = wB + 42;
        s += `<path d="M ${a} ${t} L ${b} ${t} L ${b - 1} ${t + 34} L ${(a + b) / 2} ${t + 42} L ${a + 1} ${t + 34} Z" ${SEAM}/><path d="M ${a + 3} ${t + 3} L ${b - 3} ${t + 3}" ${TOP}/>`;
      });
    } else if (o.waist === "elastic") {
      s += `<path d="M 168 ${wB + 26} L 196 ${wB + 26} L 196 ${wB + 58} L 168 ${wB + 58} Z" ${SEAM}/><path d="M 170 ${wB + 29} L 194 ${wB + 29}" ${TOP}/>`;
    }
    s += `<path d="M 104 ${wT + 4} h 10 v 6 h -10 Z" ${THIN}/>`; // etiketa
  }
  return wrap(s, `0 0 300 ${Math.max(L + 30, 220)}`);
}
