import "server-only";
import { sql, type SQL } from "drizzle-orm";

// A compatibility map for player records whose identity was split across multiple IDs
// due to slight name variations in game PDF reports. Keeping this in the data layer
// ensures every server query resolves canonical player identities consistently without mutating Neon.
const PLAYER_ID_ALIASES: Readonly<Record<number, number>> = {
  895: 896, // Greans Chandra B. Tangkulung -> Greans Chandra Bartes Tangkulung
  1921: 1922, // Sevly Victory Adolf -> Sevly Victory Adolf Rondonuwu
  1012: 1011, // Mohammed Aymane Garudi Arip (ID 1012) -> ID 1011
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
