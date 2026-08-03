import "server-only";
import { sql, type SQL } from "drizzle-orm";

// A compatibility map for player records whose identity was split across multiple IDs
// due to slight name variations in game PDF reports. Keeping this in the data layer
// ensures every server query resolves canonical player identities consistently without mutating Neon.
const PLAYER_ID_ALIASES: Readonly<Record<number, number>> = {
  895: 896, // Greans Chandra B. Tangkulung -> Greans Chandra Bartes Tangkulung
  1921: 1922, // Sevly Victory Adolf -> Sevly Victory Adolf Rondonuwu
  1012: 1011, // Mohammed Aymane Garudi Arip (ID 1012) -> ID 1011
  1864: 1011, // M Aymane Garudi Arip (ID 1864) -> ID 1011
  1876: 1011, // Mohammed Aymane Arip (ID 1876) -> ID 1011
  1140: 1141, // Yosua Otto S Judaprajitna -> Yosua Otto Sunarko Judaprajitna
  1738: 1743, // A. A. G. A. B. Paramesvara -> A. A. Gede Agung Bagus Paramesvara
  1739: 1743, // A. A. G. A. Bagus Paramesvara -> A. A. Gede Agung Bagus Paramesvara
  1740: 1743, // A. A. Gede A B Paramesvara -> A. A. Gede Agung Bagus Paramesvara
  1741: 1743, // A. A. Gede Agung B Paramesvara -> A. A. Gede Agung Bagus Paramesvara
  1787: 1788, // Darnell D Cowart Junior -> Darnell Deon Cowart Junior
  1821: 1823, // I Nyoman B B Daneswara -> I Nyoman Bagus Bhaskara Daneswara
  1822: 1823, // I Nyoman B Bhaskara Daneswara -> I Nyoman Bagus Bhaskara Daneswara

  // Rans Simba Bogor (RSB)
  852: 854, // Daniel William T Salamena -> Daniel William Tunasey Salamena
  1781: 854, // Daniel W. T. Salamena (ID 1781) -> Daniel William Tunasey Salamena (ID 854)
  1074: 1075, // Rheza Saputra Butar Butar -> Rheza Saputra Butarbutar

  // Rajawali Medan (RJM)
  1860: 1861, // Likemo V Deo P Conrad -> Likemo Victor Deo Putra Conrad

  // Surabaya Swans / SWS
  969: 970, // Kevin Immanuel M Sihombing -> Kevin Immanuel Mendita Sihombing
  971: 970, // Kevin Immanuel Sihombing -> Kevin Immanuel Mendita Sihombing
  1132: 1133, // Yehezkiel M. Rahadiyanto -> Yehezkiel Mahesvara Rahadiyanto
  1816: 1818, // Henry A S Sualang -> Henry Alexander Samuel Sualang
  1817: 1818, // Henry A. Samuel Sualang -> Henry Alexander Samuel Sualang
  1865: 1875, // M. Nabizar Atilla Taqwa -> Mochammad Nabizar Atilla Taqwa
  1873: 1875, // Moch. Nabizar Atilla Taqwa -> Mochammad Nabizar Atilla Taqwa
  1874: 1875, // Mochammad Nabizar A. Taqwa -> Mochammad Nabizar Atilla Taqwa
};

const PLAYER_DISPLAY_NAME_OVERRIDES: Readonly<Record<number, string>> = {
  896: "Greans Chandra Bartes Tangkulung",
  1922: "Sevly Victory Adolf Rondonuwu",
  1011: "Mohammed Aymane Garudi Arip",
  1141: "Yosua Otto Sunarko Judaprajitna",
  1743: "A. A. Gede Agung Bagus Paramesvara",
  1788: "Darnell Deon Cowart Junior",
  1823: "I Nyoman Bagus Bhaskara Daneswara",
  854: "Daniel William Tunasey Salamena",
  1075: "Rheza Saputra Butarbutar",
  1861: "Likemo Victor Deo Putra Conrad",
  970: "Kevin Immanuel Mendita Sihombing",
  1133: "Yehezkiel Mahesvara Rahadiyanto",
  1818: "Henry Alexander Samuel Sualang",
  1875: "Mochammad Nabizar Atilla Taqwa",
};

const FOREIGN_PLAYER_NAMES = new Set<string>([
  "aaron craig fuller",
  "adonnecy joshua bramah",
  "adonys henriquez",
  "alioune tew",
  "amine noua",
  "amir darrion williams",
  "amorie anthony archibald",
  "anthony denell january jr",
  "anthony james peacock",
  "anthony metten",
  "antonio kurtis hester",
  "artem kovalov",
  "artem pustovyi",
  "ater james majok",
  "augusto cesar lima brito",
  "augustus lewis stone jr",
  "bailey john fields iii",
  "bobby arthur williams jr",
  "brandis raley ross",
  "brandon lee mccoy",
  "brandone francis",
  "bryan jose carabali porozo",
  "chad teron brown",
  "chanceler james gettys",
  "chishon reydell briggs",
  "chrishon reydell briggs",
  "christian tyler james",
  "christopher deonte bryant",
  "christopher navell seeley",
  "corey anthony raley ross",
  "curtis lee davis iii",
  "dane anthony miller jr",
  "darious lee moten",
  "darnell d cowart junior",
  "darnell deon cowart junior",
  "dayon griffin",
  "de vaughn lamar washington",
  "dennis j clifford",
  "deon marshall thompson",
  "devin lamonte davis",
  "devon d van oostrum",
  "devon doekele v oostrum",
  "devon doekele van oostrum",
  "devondrick deshawn walker",
  "dino butaroc",
  "dino butorac",
  "djery jean baptiste",
  "donell cooper ii",
  "elgin rashad cook",
  "eric michael hancik",
  "feliciano perez neto",
  "frank victor johnson",
  "garrius de marquise holloman",
  "gelvis andres solano paulino",
  "giorgi bezhanishvili",
  "gracin bakumanya bolongi",
  "gregoryshon derek magee",
  "ikcaven savalianta curry",
  "isaac pito asrat",
  "isaiah jamal briscoe",
  "jabari a q peter narcis",
  "jabari akins quami peter narcis",
  "jabari carl bird",
  "jailan jakai haslem",
  "jalen leonard jones",
  "james clough gist ii",
  "james clough gist iii",
  "james l dickey iii",
  "jaquori curtis mclaughlin",
  "jarred dwayne shaw",
  "jarron tevanti crump",
  "jarvis terrell summers",
  "jason henry copman",
  "jaylyn marice richardson",
  "jeantal cylla",
  "jeffree david withey",
  "jerome adolphus jordan",
  "jerome anthony beane jr",
  "jr anthony beane jr",
  "joao vitor franca dos santos",
  "john wesley murry ii",
  "jonas zohore bergstedt",
  "jonathan komagum",
  "jordan lavell adams",
  "jordan treyvon ivy curry",
  "joshua bryan ibarra",
  "joshua darius caldwell",
  "joshua marckus cunningham",
  "joshua norman ezekiel nurse",
  "julius jucikas",
  "justin donta brownlee",
  "kaleb avery wesson",
  "kamani kevin ano johnson",
  "keljin deshawn blevins",
  "kenneth dermont funderburk jr",
  "kentrell debarus barkley",
  "kenyon joseph buffen",
  "kevin kangu",
  "kevin ornell c mc daniels",
  "kevin ornell chapman mc daniels",
  "kierell ar darius green",
  "kierell ardarius green",
  "le bryan keithdrick nash",
  "leon gilmore iii",
  "lester prosper",
  "majur mabior mayuek majak",
  "malachi lewis richardson",
  "malik jhamari dunbar",
  "manuel alejandro suarez",
  "maodo malick diouf",
  "marquis d steven holloway davison",
  "marquis deshaun s holloway davison",
  "marquis deshaun steven holloway davison",
  "martyce joshua kimbrough",
  "maxie kunle esho",
  "mckenzie zachary moore",
  "miguel angel miranda",
  "michael anthony singletary",
  "michael ayodele kolawole",
  "michael david henn",
  "michael rashad qualls",
  "morakinyo michael williams",
  "mycheal gerome henry",
  "najeal jewone young",
  "nathanial paul grimes",
  "nemanja besovic",
  "nicholas craig stover",
  "nicholas david jordan faust",
  "nicholas julian hornsby",
  "nicholas wiggins",
  "niven antone glover",
  "norbertas giga",
  "pape malick dime",
  "patrick james mcglynn iv",
  "perrin levon buford",
  "quintin dove",
  "radoslav pekovic",
  "rakeem maleek christmas",
  "randy bell",
  "randy tyree bell",
  "rashad deandre vaughn",
  "rayvonte detra rice",
  "reynaldo garcia zamora",
  "ronald earl delph",
  "ryan taylor batte",
  "samuel anu itunu dare adewunmi",
  "serhii pavlov",
  "serigne modou kane",
  "shannon eugene evans ii",
  "stephan lane hurt",
  "stephaun b branch",
  "stephen lane hurt",
  "steve taylor jr",
  "steven bernard lenard green",
  "tavario earnest ptristian miller",
  "taylor john",
  "taylor johns",
  "taylor marice johns",
  "thomas earl robinson",
  "thomas hugo de thaey",
  "thomas hugo r de thaey",
  "toluwalope joseph obasa",
  "travin marquell thibodeaux",
  "travion marice leonard",
  "troy akeem gillenwater",
  "tyree jamal robinson",
  "tyrell jabar corbin",
  "vander lee blue ii",
  "viacheslav kravtsov",
  "warren washington",
  "wendell lewis",
  "william javonta brown",
  "william joseph artino",
  "xavier allen alexander",
  "xavier charles cannefax",
  "xavier ford",
  "zoran talley jr",
]);

const aliasIds = Object.keys(PLAYER_ID_ALIASES).map(Number);

export function canonicalPlayerId(playerId: number): number {
  return PLAYER_ID_ALIASES[playerId] ?? playerId;
}

export function playerIdsFor(playerId: number): number[] {
  const canonicalId = canonicalPlayerId(playerId);
  const aliases = aliasIds.filter(
    (aliasId) => PLAYER_ID_ALIASES[aliasId] === canonicalId
  );
  return Array.from(new Set([canonicalId, ...aliases]));
}

export function playerIdMatches(column: SQL, playerId: number): SQL {
  const ids = playerIdsFor(playerId);
  if (ids.length === 1) {
    return sql`${column} = ${ids[0]}`;
  }
  return sql`${column} in (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})`;
}

export function canonicalPlayerIdExpression(column: SQL): SQL {
  const cases = Object.entries(PLAYER_ID_ALIASES).map(
    ([alias, canonical]) => sql`when ${Number(alias)} then ${canonical}`
  );
  return sql`
    case ${column}
      ${sql.join(cases, sql` `)}
      else ${column}
    end
  `;
}

export function canonicalPlayerDisplayName(
  playerId: number,
  defaultName: string
): string {
  const canonicalId = canonicalPlayerId(playerId);
  return PLAYER_DISPLAY_NAME_OVERRIDES[canonicalId] ?? defaultName;
}

export function isCanonicalPlayerId(playerId: number): boolean {
  return !Object.hasOwn(PLAYER_ID_ALIASES, playerId);
}

export function isForeignPlayer(displayName?: string | null): boolean {
  if (!displayName) return false;
  const norm = displayName.toLowerCase().replace(/[-_]/g, " ").replace(/[^a-z0-9 ]/g, "").trim();
  return FOREIGN_PLAYER_NAMES.has(norm);
}

export function getPlayerCategory(displayName?: string | null): "import" | "local" {
  return isForeignPlayer(displayName) ? "import" : "local";
}

export function playerCategoryCondition(
  column: SQL,
  category: "all" | "local" | "import"
): SQL {
  if (!category || category === "all") return sql`true`;
  const names = Array.from(FOREIGN_PLAYER_NAMES);
  const inClause = sql`replace(replace(lower(${column}), '_', ' '), '-', ' ') in (${sql.join(
    names.map((n) => sql`${n}`),
    sql`, `
  )})`;
  if (category === "import") {
    return inClause;
  }
  return sql`not (${inClause})`;
}
