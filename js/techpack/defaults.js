// Výchozí obsah tech packu podle kategorie. Všechno je označené jako PROPOSED –
// je to návrh na začátek, který přepíšeš skutečnými údaji.

export const CATEGORIES = [
  ["tee", "T-shirt"], ["longsleeve", "Longsleeve"], ["sweatshirt", "Sweatshirt (crewneck)"],
  ["hoodie", "Hoodie"], ["ziphoodie", "Zip hoodie"], ["jacket", "Jacket (denim / trucker)"],
  ["jeans", "Jeans"], ["pants", "Sweatpants"], ["shorts", "Shorts (denim)"], ["sweatshorts", "Sweatshorts"],
  ["accessory", "Accessory / other"],
];
export const catLabel = (c) => (CATEGORIES.find(([k]) => k === c) || [, c])[1];
export const FITS = ["Oversized", "Boxy", "Relaxed", "Regular", "Slim"];
export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];
export const SRC = [["P", "PROPOSED"], ["C", "CONFIRMED"], ["V", "VISIBLE"], ["T", "TBC"]];
export const srcLabel = (s) => (SRC.find(([k]) => k === s) || SRC[0])[1];
export const STATUSES = [["draft", "Rozpracovaný"], ["review", "Ke kontrole"], ["sent", "Odeslaný výrobci"], ["approved", "Schválený"]];
export const isTop = (c) => ["tee", "longsleeve", "sweatshirt", "hoodie", "ziphoodie", "jacket"].includes(c);
export const isBottom = (c) => ["jeans", "pants", "shorts", "sweatshorts"].includes(c);

// [kód, popis, jak měřit, M, gradace, tolerance]
const P = (code, desc, how, m, grade, tol) => ({ code, desc, how, base: m, grade, tol, src: "P" });
const POM = {
  tee: [
    P("A", "Body length", "From HPS straight down to hem", 74, 2, 1),
    P("B", "Chest width ½", "2 cm below armhole, edge to edge", 61, 3, 1),
    P("C", "Shoulder width", "Shoulder seam to shoulder seam", 56, 2, 1),
    P("D", "Sleeve length", "From shoulder seam to sleeve hem", 23, 1, 0.5),
    P("E", "Armhole (straight)", "Shoulder point to underarm, straight", 26, 1, 0.5),
    P("F", "Bicep ½", "2.5 cm below armhole, parallel to sleeve opening", 23, 1, 0.5),
    P("G", "Sleeve opening ½", "Edge to edge at sleeve hem", 20, 0.75, 0.5),
    P("H", "Bottom width ½", "Edge to edge at hem", 61, 3, 1),
    P("I", "Neck width", "Seam to seam, inside neck", 20, 0.5, 0.5),
    P("J", "Front neck drop", "From HPS line to neck seam at CF", 9, 0.5, 0.3),
    P("K", "Back neck drop", "From HPS line to neck seam at CB", 2, 0, 0.3),
    P("L", "Neck rib height", "Finished rib height", 2.2, 0, 0.2),
  ],
  longsleeve: [
    P("A", "Body length", "From HPS straight down to hem", 74, 2, 1),
    P("B", "Chest width ½", "2 cm below armhole, edge to edge", 60, 3, 1),
    P("C", "Shoulder width", "Shoulder seam to shoulder seam", 55, 2, 1),
    P("D", "Sleeve length", "From shoulder seam to sleeve hem", 60, 1, 1),
    P("E", "Armhole (straight)", "Shoulder point to underarm, straight", 25, 1, 0.5),
    P("F", "Bicep ½", "2.5 cm below armhole", 21, 1, 0.5),
    P("G", "Sleeve opening ½", "At hem, relaxed", 11, 0.5, 0.5),
    P("H", "Bottom width ½", "Edge to edge at hem", 60, 3, 1),
    P("I", "Neck width", "Seam to seam", 20, 0.5, 0.5),
    P("J", "Front neck drop", "HPS line to neck seam at CF", 9, 0.5, 0.3),
    P("L", "Neck rib height", "Finished rib height", 2.2, 0, 0.2),
  ],
  sweatshirt: [
    P("A", "Body length", "From HPS to bottom of hem rib", 70, 2, 1),
    P("B", "Chest width ½", "2 cm below armhole", 63, 3, 1),
    P("C", "Shoulder width", "Shoulder seam to shoulder seam", 58, 2, 1),
    P("D", "Sleeve length", "Shoulder seam to cuff edge", 58, 1, 1),
    P("E", "Armhole (straight)", "Shoulder point to underarm", 27, 1, 0.5),
    P("F", "Bicep ½", "2.5 cm below armhole", 24, 1, 0.5),
    P("G", "Cuff opening ½ (relaxed)", "At cuff edge, relaxed", 10, 0.5, 0.5),
    P("M", "Cuff height", "Finished rib", 7, 0, 0.3),
    P("H", "Bottom width ½ (relaxed)", "At hem rib edge, relaxed", 54, 3, 1),
    P("N", "Hem rib height", "Finished rib", 7, 0, 0.3),
    P("I", "Neck width", "Seam to seam", 21, 0.5, 0.5),
    P("J", "Front neck drop", "HPS line to neck seam at CF", 9, 0.5, 0.3),
    P("L", "Neck rib height", "Finished rib", 2.5, 0, 0.2),
  ],
  hoodie: [
    P("A", "Body length", "From HPS to bottom of hem rib", 72, 2, 1),
    P("B", "Chest width ½", "2 cm below armhole", 64, 3, 1),
    P("C", "Shoulder width", "Shoulder seam to shoulder seam", 60, 2, 1),
    P("D", "Sleeve length", "Shoulder seam to cuff edge", 58, 1, 1),
    P("E", "Armhole (straight)", "Shoulder point to underarm", 28, 1, 0.5),
    P("F", "Bicep ½", "2.5 cm below armhole", 25, 1, 0.5),
    P("G", "Cuff opening ½ (relaxed)", "At cuff edge, relaxed", 10, 0.5, 0.5),
    P("M", "Cuff height", "Finished rib", 7, 0, 0.3),
    P("H", "Bottom width ½ (relaxed)", "At hem rib edge, relaxed", 54, 3, 1),
    P("N", "Hem rib height", "Finished rib", 7, 0, 0.3),
    P("O", "Hood height", "From HPS to top of hood", 36, 0.5, 1),
    P("Q", "Hood width", "Widest point, flat", 26, 0.5, 0.5),
    P("R", "Kangaroo pocket width", "At bottom edge", 34, 1, 0.5),
    P("S", "Kangaroo pocket height", "Top edge to bottom seam", 22, 0.5, 0.5),
    P("T", "Pocket position", "From HPS to top of pocket", 40, 1, 0.5),
  ],
  ziphoodie: [],
  jacket: [
    P("A", "Body length", "From HPS to bottom of waistband", 64, 1.5, 1),
    P("B", "Chest width ½", "2 cm below armhole", 62, 3, 1),
    P("C", "Shoulder width", "Shoulder seam to shoulder seam", 54, 2, 1),
    P("D", "Sleeve length", "Shoulder seam to cuff edge", 60, 1, 1),
    P("E", "Armhole (straight)", "Shoulder point to underarm", 27, 1, 0.5),
    P("F", "Bicep ½", "2.5 cm below armhole", 24, 1, 0.5),
    P("G", "Cuff width ½", "Buttoned", 13, 0.5, 0.5),
    P("M", "Cuff height", "Finished", 6, 0, 0.3),
    P("N", "Waistband height", "Finished", 4, 0, 0.2),
    P("H", "Bottom width ½", "Waistband buttoned", 58, 3, 1),
    P("U", "Collar point length", "Collar edge to point", 7.5, 0, 0.3),
    P("V", "Collar height at CB", "Finished", 7, 0, 0.3),
    P("W", "Chest pocket w × h", "Flap incl.", "13 × 14", "", 0.5),
  ],
  jeans: [
    P("A", "Waist ½", "Top of waistband, buttoned, edge to edge", 41, 2, 1),
    P("B", "Hip ½", "18 cm below waistband, edge to edge", 55, 2, 1),
    P("C", "Front rise", "Crotch seam to top of waistband (incl.)", 30, 0.75, 0.5),
    P("D", "Back rise", "Crotch seam to top of waistband (incl.)", 41, 1, 0.5),
    P("E", "Thigh ½", "2.5 cm below crotch", 34, 1.25, 0.5),
    P("F", "Knee ½", "36 cm below crotch", 25, 0.75, 0.5),
    P("G", "Leg opening ½", "At hem, edge to edge", 22, 0.5, 0.5),
    P("H", "Inseam", "Crotch to hem along inseam", 80, 1, 1),
    P("I", "Outseam", "Top of waistband to hem", 108, 1.5, 1),
    P("J", "Waistband height", "Finished", 4, 0, 0.2),
    P("K", "Front pocket opening", "Along curve", 16, 0, 0.5),
    P("L", "Back pocket w × h", "Width at top × CB height", "14 × 15", "", 0.5),
  ],
  pants: [
    P("A", "Waist ½ (relaxed)", "Top of waistband, relaxed", 36, 2, 1),
    P("A2", "Waist ½ (extended)", "Fully stretched", 52, 2, 1.5),
    P("B", "Hip ½", "18 cm below waistband", 56, 2, 1),
    P("C", "Front rise", "Crotch seam to top of waistband", 31, 0.75, 0.5),
    P("D", "Back rise", "Crotch seam to top of waistband", 41, 1, 0.5),
    P("E", "Thigh ½", "2.5 cm below crotch", 33, 1.25, 0.5),
    P("F", "Knee ½", "36 cm below crotch", 26, 0.75, 0.5),
    P("G", "Leg opening ½ (cuff, relaxed)", "At cuff edge", 11, 0.5, 0.5),
    P("H", "Inseam", "Crotch to cuff edge", 78, 1, 1),
    P("J", "Waistband height", "Finished", 5, 0, 0.3),
    P("M", "Cuff height", "Finished rib", 7, 0, 0.3),
  ],
  shorts: [
    P("A", "Waist ½", "Top of waistband, buttoned", 41, 2, 1),
    P("B", "Hip ½", "18 cm below waistband", 55, 2, 1),
    P("C", "Front rise", "Crotch seam to top of waistband", 30, 0.75, 0.5),
    P("D", "Back rise", "Crotch seam to top of waistband", 41, 1, 0.5),
    P("E", "Thigh ½", "2.5 cm below crotch", 34, 1.25, 0.5),
    P("G", "Leg opening ½", "At hem, edge to edge", 32, 1, 0.5),
    P("H", "Inseam", "Crotch to hem", 20, 0.5, 0.5),
    P("I", "Outseam", "Top of waistband to hem", 50, 1, 1),
    P("J", "Waistband height", "Finished", 4, 0, 0.2),
  ],
  sweatshorts: [
    P("A", "Waist ½ (relaxed)", "Top of waistband, relaxed", 36, 2, 1),
    P("B", "Hip ½", "18 cm below waistband", 56, 2, 1),
    P("C", "Front rise", "Crotch seam to top of waistband", 31, 0.75, 0.5),
    P("D", "Back rise", "Crotch seam to top of waistband", 41, 1, 0.5),
    P("E", "Thigh ½", "2.5 cm below crotch", 34, 1.25, 0.5),
    P("G", "Leg opening ½", "At hem", 31, 1, 0.5),
    P("H", "Inseam", "Crotch to hem", 18, 0.5, 0.5),
    P("J", "Waistband height", "Finished", 5, 0, 0.3),
  ],
  accessory: [P("A", "Width", "", "", "", 0.5), P("B", "Height", "", "", "", 0.5)],
};
POM.ziphoodie = POM.hoodie.filter((r) => !["R", "S", "T"].includes(r.code)).concat([P("Z", "Zip length", "Top stop to bottom stop", 62, 1.5, 0.5)]);

const B = (component, material, composition, weight, color, supplier, consumption) =>
  ({ component, material, composition, weight, color, supplier, consumption, src: "P" });
const TRIMS = [
  B("Main label", "Woven damask label", "100% polyester", "", "Black / white", "End-fold, 5 × 2 cm", "1 pc"),
  B("Size label", "Woven", "100% polyester", "", "Black / white", "1 × 1.5 cm", "1 pc"),
  B("Care & composition label", "Printed satin", "100% polyester", "", "White / black print", "3 × 8 cm", "1 pc"),
  B("Hangtag", "Uncoated card", "FSC paper", "350 g/m²", "Off-white / black", "5.5 × 9 cm + cotton string", "1 pc"),
  B("Polybag", "Recycled LDPE", "", "50 µm", "Clear", "Self-seal, with suffocation warning", "1 pc"),
];
const BOM = {
  knitTop: [
    B("Main fabric", "Single jersey, combed ring-spun", "100% cotton", "240 g/m²", "TBC", "Garment-dyed or piece-dyed, pre-shrunk", "~0.55 kg"),
    B("Neck rib", "1×1 rib", "95% cotton / 5% elastane", "260 g/m²", "Self", "Same dye lot as body", "—"),
    B("Back neck tape", "Self fabric or cotton twill tape", "100% cotton", "", "Self", "1 cm", "0.45 m"),
    B("Sewing thread", "Core-spun", "Polyester / cotton", "Tex 27", "Match body", "", "—"),
  ],
  fleeceTop: [
    B("Main fabric", "Brushed-back fleece (or loopback French terry)", "100% cotton", "450 g/m²", "TBC", "Pre-shrunk, low pilling", "~1.1 kg"),
    B("Rib (cuffs, hem, neck)", "2×2 rib", "95% cotton / 5% elastane", "400 g/m²", "Self", "Same dye lot as body", "—"),
    B("Sewing thread", "Core-spun", "Polyester / cotton", "Tex 40", "Match body", "", "—"),
  ],
  hood: [
    B("Hood lining", "Self fabric (double hood)", "Same as main", "", "Self", "", "—"),
    B("Drawcord", "Flat braided cord", "100% cotton", "10 mm", "Match body", "Length 140 cm, tipped ends", "1 pc"),
    B("Eyelets", "Metal eyelets", "Brass", "Ø 8 mm", "Black matte", "With washer + fabric reinforcement", "2 pcs"),
  ],
  zip: [B("Zipper", "Separating zip #5", "Metal / YKK or equal", "", "Black matte", "Length per size", "1 pc")],
  denimTop: [
    B("Main fabric", "Rigid denim, 3×1 RHT", "100% cotton", "13.5 oz (≈ 458 g/m²)", "TBC wash", "Sanforized", "~1.6 m"),
    B("Buttons", "Shank button", "Brass / zinc", "17 mm", "Antique silver", "Engraved METROMOOD (TBC)", "~10 pcs"),
    B("Interfacing", "Fusible woven", "Cotton / poly", "", "White", "Collar, cuffs, placket", "—"),
    B("Topstitch thread", "Core-spun", "Polyester / cotton", "Tex 70", "Copper / gold", "", "—"),
    B("Construction thread", "Core-spun", "Polyester / cotton", "Tex 40", "Match", "", "—"),
  ],
  denimBottom: [
    B("Main fabric", "Rigid denim, 3×1 RHT", "100% cotton", "13.5 oz (≈ 458 g/m²)", "TBC wash", "Sanforized", "~1.4 m"),
    B("Pocketing", "Twill pocketing", "65% polyester / 35% cotton", "120 g/m²", "Off-white", "", "0.3 m"),
    B("Zipper", "Fly zip #4.5, auto-lock", "Brass / YKK or equal", "", "Antique brass", "", "1 pc"),
    B("Shank button", "Tack button", "Brass / zinc", "17 mm", "Antique silver", "Engraved METROMOOD (TBC)", "1 pc"),
    B("Rivets", "Rivets", "Copper", "9 mm", "Antique copper", "Front pocket corners", "6 pcs"),
    B("Topstitch thread", "Core-spun", "Polyester / cotton", "Tex 70", "Copper / gold", "", "—"),
    B("Construction thread", "Core-spun", "Polyester / cotton", "Tex 40", "Match", "", "—"),
  ],
  fleeceBottom: [
    B("Main fabric", "Brushed-back fleece", "100% cotton", "400 g/m²", "TBC", "Pre-shrunk", "~1.0 kg"),
    B("Rib (cuffs)", "2×2 rib", "95% cotton / 5% elastane", "400 g/m²", "Self", "", "—"),
    B("Waist elastic", "Woven elastic", "Polyester / rubber", "40 mm", "White", "Inside waistband", "≈ waist"),
    B("Drawcord", "Flat braided cord", "100% cotton", "10 mm", "Match body", "120 cm, tipped ends", "1 pc"),
    B("Eyelets", "Metal eyelets", "Brass", "Ø 8 mm", "Black matte", "", "2 pcs"),
    B("Sewing thread", "Core-spun", "Polyester / cotton", "Tex 40", "Match", "", "—"),
  ],
};
function bomFor(c) {
  const base = {
    tee: BOM.knitTop, longsleeve: BOM.knitTop, sweatshirt: BOM.fleeceTop,
    hoodie: [...BOM.fleeceTop, ...BOM.hood], ziphoodie: [...BOM.fleeceTop, ...BOM.hood, ...BOM.zip],
    jacket: BOM.denimTop, jeans: BOM.denimBottom, shorts: BOM.denimBottom,
    pants: BOM.fleeceBottom, sweatshorts: BOM.fleeceBottom, accessory: [],
  }[c] || [];
  return [...base, ...TRIMS].map((r) => ({ ...r }));
}

const K = (area, spec, stitch) => ({ area, spec, stitch, src: "P" });
const CONS = {
  knitTop: [
    K("General", "Stitch density 12 SPI (≈ 5 stitches/cm). Seam allowance 1 cm unless stated.", ""),
    K("Shoulder seams", "Overlock, reinforced with clear elastic or self tape", "ISO 514"),
    K("Sleeve attach / side seams", "4-thread overlock, side seams in one continuous operation", "ISO 514"),
    K("Neck", "Rib attached with overlock, twin-needle coverstitch topstitch; back neck tape shoulder to shoulder", "ISO 514 + 406"),
    K("Hems (sleeve & body)", "Turned 2.5 cm hem, twin-needle coverstitch", "ISO 406"),
    K("Labels", "Main label at CB neck under tape, care label in left side seam 10 cm above hem", "ISO 301"),
  ],
  fleeceTop: [
    K("General", "Stitch density 11–12 SPI. Seam allowance 1 cm. Seams flat and without twisting.", ""),
    K("Shoulder / armhole / side seams", "4-thread overlock; optional flatlock topstitch on armhole", "ISO 514 (+ 607)"),
    K("Cuffs & hem rib", "Rib folded double, attached with overlock, stretched evenly", "ISO 514"),
    K("Neck rib", "Rib attached with overlock, coverstitch topstitch; back neck tape", "ISO 514 + 406"),
    K("Labels", "Main label at CB neck, care label in left side seam 10 cm above hem", "ISO 301"),
  ],
  hood: [
    K("Hood", "Double layer hood, CB seam overlocked + twin-needle topstitch; hood edge self-faced with drawcord channel 3 cm", "ISO 514 + 406"),
    K("Eyelets", "Metal eyelets on reinforced area (interfacing inside), 4 cm apart from CF", ""),
  ],
  kangaroo: [K("Kangaroo pocket", "Pocket edges hemmed 1.5 cm, attached with twin-needle topstitch; bartacks at pocket opening corners", "ISO 401 + bartack")],
  zip: [K("Zipper", "Zip set to CF with double-needle topstitch 0.6 cm from teeth; zip garage at top", "ISO 301")],
  denimTop: [
    K("General", "Stitch density 8–9 SPI for topstitch, 10–11 SPI for construction. Seam allowance 1 cm.", ""),
    K("Yoke, shoulder & armhole", "Flat-felled seams, double-needle chainstitch topstitch", "ISO 401"),
    K("Side & underarm seams", "Overlock + single needle topstitch", "ISO 514 + 301"),
    K("Collar & cuffs", "Interfaced, edge stitched 0.15 cm + 0.6 cm topstitch", "ISO 301"),
    K("Front placket", "Double-needle topstitch, buttonholes keyhole, buttons by machine", "ISO 301"),
    K("Chest pockets & flaps", "Patch pockets, double-needle topstitch, bartacks at top corners", "ISO 301 + bartack"),
    K("Washing", "Wash recipe TBC (rinse / stone wash). Shrinkage tested after wash.", ""),
  ],
  denimBottom: [
    K("General", "Stitch density 8–9 SPI for topstitch, 10–11 SPI for construction. Seam allowance 1 cm.", ""),
    K("Inseam", "Flat-felled, double-needle chainstitch", "ISO 401"),
    K("Outseam", "Overlocked + single needle topstitch (or selvedge if selvedge denim)", "ISO 514 + 301"),
    K("Seat & yoke", "Flat-felled, double-needle chainstitch", "ISO 401"),
    K("Fly", "J-stitch double-needle topstitch, bartack at bottom of fly", "ISO 301 + bartack"),
    K("Waistband", "Attached with waistband machine, double-needle chainstitch; belt loops bartacked top & bottom", "ISO 401 + bartack"),
    K("Pockets", "Front pocket rivets at opening corners, back pockets double-needle topstitch + bartacks", "ISO 301"),
    K("Hems", "Turned 1 cm double fold, chainstitch", "ISO 401"),
    K("Washing", "Wash recipe TBC (rinse / stone wash). Shrinkage tested after wash.", ""),
  ],
  fleeceBottom: [
    K("General", "Stitch density 11–12 SPI. Seam allowance 1 cm.", ""),
    K("Side, in- and crotch seams", "4-thread overlock, crotch seam reinforced with tape", "ISO 514"),
    K("Waistband", "Elastic inside, waistband attached with overlock + coverstitch, 4 rows topstitch through elastic (optional)", "ISO 514 + 406"),
    K("Pockets", "Side-seam pockets, bartacks at opening ends", "ISO 514 + bartack"),
    K("Cuffs / hem", "Rib cuffs folded double, overlock (pants); hem coverstitch 2.5 cm (shorts)", "ISO 514 / 406"),
  ],
};
function consFor(c) {
  const map = {
    tee: CONS.knitTop, longsleeve: CONS.knitTop, sweatshirt: CONS.fleeceTop,
    hoodie: [...CONS.fleeceTop, ...CONS.hood, ...CONS.kangaroo], ziphoodie: [...CONS.fleeceTop, ...CONS.hood, ...CONS.zip],
    jacket: CONS.denimTop, jeans: CONS.denimBottom, shorts: CONS.denimBottom, pants: CONS.fleeceBottom, sweatshorts: CONS.fleeceBottom,
    accessory: [K("General", "", "")],
  };
  return (map[c] || []).map((r) => ({ ...r }));
}

export const QC_CHECKS = [
  "Measurements within tolerance (check all sizes of the size set)",
  "Fabric free of holes, slubs, stains, shading",
  "Shade consistency body / rib / trims (same dye lot)",
  "Stitching: no skipped, broken or loose stitches; even SPI",
  "Logo / crown placement per spec (± 0.5 cm)",
  "Embroidery: no loose threads, clean backing, no puckering",
  "Print: full coverage, no cracking after stretch test",
  "Seams strong, no open seams; bartacks at stress points",
  "Symmetry left / right (sleeves, pockets, collar)",
  "Finishing: threads trimmed, pressed, no glue or chalk marks",
  "Labels correct (size, care, composition, country of origin) and positioned per spec",
  "Packaging: folded per spec, polybag with warning, hangtag attached",
];
const T = (test, standard, req) => ({ test, standard, req, src: "P" });
export const QC_TESTS = [
  T("Dimensional stability (shrinkage)", "ISO 6330 + ISO 5077, 3 washes 40 °C, tumble dry low", "≤ 5 % length / width (knits), ≤ 3 % (denim, sanforized)"),
  T("Colour fastness to washing", "ISO 105-C06", "≥ 4 (change), ≥ 3–4 (staining)"),
  T("Colour fastness to rubbing", "ISO 105-X12", "Dry ≥ 4, wet ≥ 3 (indigo denim: wet ≥ 2–3)"),
  T("Print / embroidery durability", "5 × wash 40 °C inside out", "No cracking, peeling, fading or loose threads"),
  T("Seam strength", "ISO 13935-2", "≥ 150 N (wovens), seams don't open"),
  T("Pilling (fleece / jersey)", "ISO 12945-2, 2000 rubs", "≥ grade 3–4"),
];
export const QC_STAGES = "1. Proto sample – check design & construction.\n2. Fit sample (size M) – check measurements on body, correct POM.\n3. Size set (all sizes) – check grading.\n4. PP sample (final fabric, trims, wash, labels) – signed approval before bulk.\n5. Bulk – inline + final inspection (AQL 2.5).";

const L = (type, dims, material, method, color, placement) => ({ type, dims, material, method, color, placement, src: "P" });
function labelsFor(c) {
  const bottom = isBottom(c);
  return [
    L("Main label", "5 × 2 cm", "Damask woven, polyester", "Woven, end-fold", "Black ground, white crown + METROMOOD", bottom ? "Inside back waistband, centre" : "Centre back neck, under neck tape"),
    L("Size label", "1 × 1.5 cm", "Damask woven", "Woven", "Black / white", "Sewn under main label, right side"),
    L("Care & composition label", "3 × 8 cm", "Satin, polyester", "Printed", "White / black", bottom ? "Left side seam inside, 10 cm below waistband" : "Left side seam inside, 10 cm above hem"),
    L("Hangtag", "5.5 × 9 cm", "350 g/m² uncoated FSC card", "Printed 1-colour + SKU / size / price sticker", "Off-white / black", "Attached through main label (or care label) with cotton string"),
    L("Packaging", "Fold to approx. 30 × 35 cm", "Recycled LDPE polybag 50 µm", "Printed warning + barcode sticker", "Clear", "1 garment per bag, folded with tissue"),
  ];
}

const KEY_BRANDING = (c) => [{
  name: "Crown logo", artwork: "", placement: isBottom(c) ? "TBC (e.g. back right pocket / left leg)" : "Left chest, 18 cm from HPS, 9 cm from CF",
  size: "7 × 5 cm", method: "Flat embroidery", colors: "TBC", specs: "Satin + fill stitch, ~9 000 stitches (TBC)", backing: "Tear-away + soft cover backing inside",
  src: "T",
}];

const CALLOUTS = {
  tee: ["Crew neck rib", "Shoulder seam", "Sleeve hem (coverstitch)", "Body hem (coverstitch)", "Crown logo", "Main label"],
  longsleeve: ["Crew neck rib", "Shoulder seam", "Sleeve hem", "Body hem", "Crown logo", "Main label"],
  sweatshirt: ["Crew neck rib", "Raglan / set-in armhole seam", "Rib cuffs", "Hem rib", "Crown logo", "Main label"],
  hoodie: ["Double-layer hood", "Drawcord + metal eyelets", "Kangaroo pocket", "Rib cuffs", "Hem rib", "Crown logo", "Main label"],
  ziphoodie: ["Double-layer hood", "Drawcord + metal eyelets", "Front zip", "Side-seam pockets", "Rib cuffs & hem", "Crown logo"],
  jacket: ["Point collar", "Front yoke", "Chest pockets with flap", "Button placket", "Button cuff", "Waistband", "Back yoke & pleat seams", "Crown logo"],
  jeans: ["Waistband & shank button", "Belt loops", "Fly (J-stitch)", "Front pockets + rivets", "Coin pocket", "Back yoke", "Back pockets", "Hem"],
  shorts: ["Waistband & shank button", "Belt loops", "Fly (J-stitch)", "Front pockets + rivets", "Back pockets", "Hem"],
  pants: ["Elastic waistband + drawcord", "Side-seam pockets", "Back patch pocket", "Rib cuffs", "Crown logo"],
  sweatshorts: ["Elastic waistband + drawcord", "Side-seam pockets", "Hem", "Crown logo"],
  accessory: ["Detail 1"],
};

/** Celý výchozí obsah tech packu pro kategorii. */
export function defaultsFor(category) {
  return {
    overview: { fit: "Oversized", sizes: SIZES.join(", "), base: "M", colorways: "", description: "", features: "", dev_notes: "", collection: "", target_customer: "", price: "", moq: "", factory: "" },
    photos: [],
    flats: [],
    callouts: (CALLOUTS[category] || []).map((element) => ({ element, location: "", dims: "", method: "", material: "", color: "", placement: "", src: "V", pin: null })),
    bom: bomFor(category),
    colors: [
      { element: "Main fabric", name: "", hex: "", pantone: "Match to physical swatch", application: "Body", src: "T" },
      { element: "Thread", name: "", hex: "", pantone: "", application: "All seams", src: "T" },
      { element: "Logo / embroidery", name: "", hex: "", pantone: "", application: "Crown logo", src: "T" },
    ],
    pom: (POM[category] || []).map((r) => ({ ...r, vals: grade(r) })),
    construction: consFor(category),
    branding: KEY_BRANDING(category),
    labels: labelsFor(category),
    qc: { checks: QC_CHECKS.map((t) => ({ text: t, on: true })), tests: QC_TESTS.map((t) => ({ ...t })), stages: QC_STAGES },
    summary: { special: "", approvals: "Fit sample (M) approval\nPP sample approval incl. wash, trims and labels\nLab test results (shrinkage, colour fastness)" },
  };
}

/** Přepočítá hodnoty všech velikostí z M + gradace. */
export function grade(r, sizes = SIZES, base = "M") {
  const bi = sizes.indexOf(base);
  const out = {};
  const b = Number(String(r.base).replace(",", "."));
  const g = Number(String(r.grade).replace(",", "."));
  sizes.forEach((s, i) => {
    if (r.base === "" || r.base == null || isNaN(b)) { out[s] = r.base ?? ""; return; }
    if (isNaN(g) || r.grade === "") { out[s] = i === bi ? r.base : ""; return; }
    const v = b + (i - bi) * g;
    out[s] = String(Math.round(v * 100) / 100).replace(/\.0+$/, "");
  });
  return out;
}
