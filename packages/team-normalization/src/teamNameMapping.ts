/**
 * Team name mapping configuration for different countries
 *
 * This file provides mappings between different formats of team names
 * that might appear in different data sources (matches API, team stats, etc.)
 *
 * Mappings are organized by country to support teams that move between
 * leagues within the same country (promotion/relegation).
 */

export interface TeamNameMapping {
  /** The normalized team name as it appears in the teams.json files */
  normalizedName: string;
  /** Alternative names that might be used in other data sources */
  alternativeNames: string[];
}

export interface CountryTeamMappings {
  [country: string]: TeamNameMapping[];
}

/**
 * Consolidated Belgian team mappings (First Division + Second Division)
 * Resolves conflicts between league-specific mappings for teams that move between divisions
 */
const belgianTeamMapping: TeamNameMapping[] = [
  // First Division teams
  {
    normalizedName: "Anderlecht",
    alternativeNames: ["RSC Anderlecht", "Royal Sporting Club Anderlecht"],
  },
  {
    normalizedName: "Club Brugge",
    alternativeNames: ["Club Brugge KV", "Club Bruges", "FC Bruges"],
  },
  {
    normalizedName: "Genk",
    alternativeNames: ["KRC Genk", "Racing Genk"],
  },
  {
    normalizedName: "Gent",
    alternativeNames: ["KAA Gent", "La Gantoise"],
  },
  {
    normalizedName: "Standard Liege",
    alternativeNames: ["Standard Liège", "Standard de Liège", "Standard"],
  },
  {
    normalizedName: "Union SG",
    alternativeNames: [
      "Union Saint-Gilloise",
      "Royale Union Saint-Gilloise",
      "Union",
    ],
  },
  {
    normalizedName: "KV Mechelen",
    alternativeNames: ["Mechelen", "Yellow Red KV Mechelen", "Malines"],
  },
  {
    normalizedName: "Sint-Truiden",
    alternativeNames: ["Sint Truiden", "STVV", "Sint-Truidense VV"],
  },
  {
    normalizedName: "Antwerp FC",
    alternativeNames: ["Royal Antwerp", "Antwerp", "Royal Antwerp FC"],
  },
  {
    normalizedName: "Zulte-Waregem",
    alternativeNames: ["SV Zulte-Waregem", "Zulte Waregem", "Essevee"],
  },
  {
    normalizedName: "Westerlo",
    alternativeNames: ["KVC Westerlo", "VC Westerlo"],
  },
  {
    normalizedName: "RAAL",
    alternativeNames: ["RAAL La Louvière", "RAAL La Louviere", "La Louvière"],
  },
  {
    normalizedName: "RSC Charleroi",
    alternativeNames: ["Charleroi", "Sporting Charleroi", "Royal Charleroi SC"],
  },
  {
    normalizedName: "FCV Dender",
    alternativeNames: [
      "Dender",
      "FCV Dender EH",
      "Dender EH",
      "FC Verbroedering Dender EH",
    ],
  },
  {
    normalizedName: "Cercle Brugge",
    alternativeNames: ["Cercle Brugge KSV", "Cercle Bruges", "Cercle"],
  },
  {
    normalizedName: "OH Leuven",
    alternativeNames: ["Leuven", "Oud-Heverlee Leuven", "OHL"],
  },
  {
    normalizedName: "Beerschot",
    alternativeNames: [
      "Beerschot VA",
      "K Beerschot VA",
      "KBVA",
      "Beerschot Wilrijk",
    ],
  },
  {
    normalizedName: "Kortrijk",
    alternativeNames: ["KV Kortrijk", "KVK", "Courtrai"],
  },
  {
    normalizedName: "Oostende",
    alternativeNames: ["KV Oostende", "KVO", "Ostend"],
  },
  {
    normalizedName: "Seraing",
    alternativeNames: [
      "RFC Seraing",
      "Royal Football Club Seraing",
      "Seraing United",
    ],
  },
  {
    normalizedName: "Eupen",
    alternativeNames: ["KAS Eupen", "AS Eupen", "KAS"],
  },
  {
    normalizedName: "RWDM",
    alternativeNames: [
      "RWDM Brussels",
      "RWD Molenbeek",
      "Racing White Daring Molenbeek",
    ],
  },
  {
    normalizedName: "Excel Mouscron",
    alternativeNames: ["Mouscron", "Royal Excel Mouscron", "REM"],
  },
  {
    normalizedName: "Waas-Beveren",
    alternativeNames: [
      "Beveren",
      "KSK Beveren",
      "Waasland-Beveren",
      "KSKW Beveren",
    ],
  },
  // Second Division teams
  {
    normalizedName: "Lommel",
    alternativeNames: ["Lommel SK", "K. Lommel SK", "Lommel United"],
  },
  {
    normalizedName: "Patro Eisden",
    alternativeNames: ["Patro Eisden Maasmechelen", "Royal Patro Eisden"],
  },
  {
    normalizedName: "RFC Liège",
    alternativeNames: [
      "RFC Liege",
      "Royal Football Club de Liège",
      "RFC de Liège",
    ],
  },
  {
    normalizedName: "Jong KAA Gent",
    alternativeNames: ["KAA Gent II", "Gent B", "Gent Beloften"],
  },
  {
    normalizedName: "RSCA Futures",
    alternativeNames: [
      "Anderlecht Futures",
      "RSC Anderlecht Futures",
      "Anderlecht B",
    ],
  },
  {
    normalizedName: "Lierse",
    alternativeNames: ["Lierse Kempenzonen", "Lierse K", "K. Lierse SK"],
  },
  {
    normalizedName: "Jong Genk",
    alternativeNames: ["KRC Genk II", "Genk B", "Genk Beloften"],
  },
  {
    normalizedName: "Francs Borains",
    alternativeNames: ["RFC Francs Borains", "Royal Francs Borains"],
  },
  {
    normalizedName: "Lokeren-Temse",
    alternativeNames: ["KSC Lokeren-Temse", "SK Lokeren-Temse"],
  },
  {
    normalizedName: "Club NXT",
    alternativeNames: [
      "Club Brugge NXT",
      "Club Brugge B",
      "Club Brugge Beloften",
    ],
  },
  {
    normalizedName: "Olympic Charleroi",
    alternativeNames: [
      "R. Olympic Charleroi",
      "Royal Olympic Charleroi",
      "ROC Charleroi",
    ],
  },
  {
    normalizedName: "Deinze",
    alternativeNames: [
      "KM Deinze",
      "KMSK Deinze",
      "Koninklijke Maatschappij Sportkring Deinze",
    ],
  },
];

/**
 * Mapping of team names for the Eredivisie
 */
const eredivisieMapping: TeamNameMapping[] = [
  {
    normalizedName: "Ajax",
    alternativeNames: ["AFC Ajax", "Ajax Amsterdam"],
  },
  {
    normalizedName: "PSV",
    alternativeNames: ["PSV Eindhoven", "Philips Sport Vereniging"],
  },
  {
    normalizedName: "Feyenoord",
    alternativeNames: ["Feyenoord Rotterdam"],
  },
  {
    normalizedName: "AZ",
    alternativeNames: ["AZ Alkmaar"],
  },
  {
    normalizedName: "Utrecht",
    alternativeNames: ["FC Utrecht"],
  },
  {
    normalizedName: "Twente",
    alternativeNames: [
      "FC Twente",
      "Twente Enschede FC",
      "FC Twente Enschede",
      "Twente Enschede",
    ],
  },
  {
    normalizedName: "Sparta R'dam",
    alternativeNames: ["Sparta Rotterdam", "Sparta"],
  },
  {
    normalizedName: "Go Ahead Eag",
    alternativeNames: ["Go Ahead Eagles", "GA Eagles", "Go Ahead"],
  },
  {
    normalizedName: "NEC",
    alternativeNames: ["NEC Nijmegen", "Nijmegen Eendracht Combinatie"],
  },
  {
    normalizedName: "Heerenveen",
    alternativeNames: ["SC Heerenveen"],
  },
  {
    normalizedName: "Groningen",
    alternativeNames: ["FC Groningen"],
  },
  {
    normalizedName: "Sittard",
    alternativeNames: ["Fortuna Sittard"],
  },
  {
    normalizedName: "Heracles",
    alternativeNames: ["Heracles Almelo"],
  },
  {
    normalizedName: "NAC",
    alternativeNames: ["NAC Breda", "NOAD ADVENDO Combinatie"],
  },
  {
    normalizedName: "Volendam",
    alternativeNames: ["FC Volendam"],
  },
  {
    normalizedName: "Excelsior",
    alternativeNames: ["SBV Excelsior", "Excelsior Rotterdam"],
  },
  {
    normalizedName: "Zwolle",
    alternativeNames: ["FC Zwolle", "PEC Zwolle"],
  },
  {
    normalizedName: "Telstar",
    alternativeNames: ["SC Telstar", "Telstar 1963", "Witte Leeuwen"],
  },
];

/**
 * Mapping of team names for the Spanish La Liga
 */
const laLigaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Barcelona",
    alternativeNames: ["FC Barcelona", "Barça", "Barca"],
  },
  {
    normalizedName: "Real Madrid",
    alternativeNames: ["Real Madrid CF", "Los Blancos"],
  },
  {
    normalizedName: "Atletico Madrid",
    alternativeNames: [
      "Atlético Madrid",
      "Atlético de Madrid",
      "Atletico",
      "Atleti",
    ],
  },
  {
    normalizedName: "Athletic",
    alternativeNames: ["Athletic Bilbao", "Athletic Club", "Bilbao"],
  },
  {
    normalizedName: "Sevilla",
    alternativeNames: ["Sevilla FC", "Sevilla Football Club"],
  },
  {
    normalizedName: "Valencia",
    alternativeNames: ["Valencia CF", "Valencia Club de Fútbol"],
  },
  {
    normalizedName: "Villarreal",
    alternativeNames: ["Villarreal CF", "Yellow Submarine"],
  },
  {
    normalizedName: "Real Sociedad",
    alternativeNames: ["Real Sociedad de Fútbol", "La Real"],
  },
  {
    normalizedName: "Betis",
    alternativeNames: ["Real Betis", "Real Betis Balompié"],
  },
  {
    normalizedName: "Espanyol",
    alternativeNames: [
      "RCD Espanyol",
      "RCD Espanyol Barcelona",
      "Espanyol Barcelona",
    ],
  },
  {
    normalizedName: "Celta",
    alternativeNames: [
      "Celta Vigo",
      "Celta de Vigo",
      "RC Celta",
      "Real Club Celta de Vigo",
    ],
  },
  {
    normalizedName: "Mallorca",
    alternativeNames: ["RCD Mallorca", "Real Mallorca"],
  },
  {
    normalizedName: "Getafe",
    alternativeNames: ["Getafe CF", "Getafe Club de Fútbol"],
  },
  {
    normalizedName: "Osasuna",
    alternativeNames: ["CA Osasuna", "Club Atlético Osasuna"],
  },
  {
    normalizedName: "Rayo Vallecano",
    alternativeNames: ["Rayo", "Rayo Vallecano de Madrid"],
  },
  {
    normalizedName: "Alavés",
    alternativeNames: ["Alaves", "Deportivo Alavés"],
  },
  {
    normalizedName: "Girona",
    alternativeNames: ["Girona FC", "Girona Football Club"],
  },
  {
    normalizedName: "Elche",
    alternativeNames: ["Elche CF", "Elche Club de Fútbol"],
  },
  {
    normalizedName: "Levante",
    alternativeNames: ["Levante UD", "Levante Unión Deportiva"],
  },
  {
    normalizedName: "Oviedo",
    alternativeNames: ["Real Oviedo", "Real Oviedo CF"],
  },
];

/**
 * Mapping of team names for the French Ligue 1
 */
const ligue1Mapping: TeamNameMapping[] = [
  {
    normalizedName: "Paris Saint-Germain",
    alternativeNames: [
      "PSG",
      "Paris SG",
      "Paris S-G",
      "Paris Saint Germain",
      "Paris",
    ],
  },
  {
    normalizedName: "Marseille",
    alternativeNames: ["Olympique de Marseille", "OM", "Olympique Marseille"],
  },
  {
    normalizedName: "Lyon",
    alternativeNames: ["Olympique Lyonnais", "OL", "Olympique Lyon"],
  },
  {
    normalizedName: "Lille",
    alternativeNames: ["LOSC", "LOSC Lille", "Lille OSC"],
  },
  {
    normalizedName: "AS Monaco",
    alternativeNames: ["Monaco", "ASM", "AS Monaco FC"],
  },
  {
    normalizedName: "Nice",
    alternativeNames: ["OGC Nice", "Olympique Gymnaste Club Nice"],
  },
  {
    normalizedName: "Rennes",
    alternativeNames: ["Stade Rennais", "Stade Rennais FC", "SR FC"],
  },
  {
    normalizedName: "Strasbourg",
    alternativeNames: [
      "RC Strasbourg Alsace",
      "RC Strasbourg",
      "Racing Strasbourg",
      "Racing Club de Strasbourg Alsace",
    ],
  },
  {
    normalizedName: "RC Lens",
    alternativeNames: ["Lens", "Racing Club de Lens"],
  },
  {
    normalizedName: "Brest",
    alternativeNames: ["Stade Brestois", "Stade Brestois 29", "SB29"],
  },
  {
    normalizedName: "Nantes",
    alternativeNames: ["FC Nantes", "Les Canaris"],
  },
  {
    normalizedName: "Angers",
    alternativeNames: ["Angers SCO", "SCO Angers"],
  },
  {
    normalizedName: "Toulouse",
    alternativeNames: ["Toulouse FC", "FC Toulouse", "TFC", "Le Téfécé"],
  },
  {
    normalizedName: "Auxerre",
    alternativeNames: ["AJ Auxerre", "AJA"],
  },
  {
    normalizedName: "Metz",
    alternativeNames: ["FC Metz", "Les Grenats"],
  },
  {
    normalizedName: "Lorient",
    alternativeNames: ["FC Lorient", "Les Merlus"],
  },
  {
    normalizedName: "Le Havre",
    alternativeNames: ["Le Havre AC", "HAC"],
  },
  {
    normalizedName: "Paris FC",
    alternativeNames: ["PFC"],
  },
];

/**
 * Mapping of team names for the Mexican Liga MX
 */
const ligaMXMapping: TeamNameMapping[] = [
  {
    normalizedName: "Pachuca",
    alternativeNames: ["CF Pachuca", "Club de Fútbol Pachuca", "Los Tuzos"],
  },
  {
    normalizedName: "Monterrey",
    alternativeNames: ["CF Monterrey", "Club de Fútbol Monterrey", "Rayados"],
  },
  {
    normalizedName: "Cruz Azul",
    alternativeNames: ["Club Deportivo Cruz Azul", "La Máquina", "La Maquina"],
  },
  {
    normalizedName: "América",
    alternativeNames: [
      "Club América",
      "Club America",
      "Las Águilas",
      "Las Aguilas",
      "Águilas",
      "Aguilas",
    ],
  },
  {
    normalizedName: "Toluca",
    alternativeNames: [
      "Deportivo Toluca FC",
      "Deportivo Toluca",
      "Los Diablos Rojos",
    ],
  },
  {
    normalizedName: "UANL",
    alternativeNames: ["Tigres UANL", "Tigres", "Club Tigres", "Los Felinos"],
  },
  {
    normalizedName: "Tijuana",
    alternativeNames: ["Club Tijuana", "Xolos", "Xoloitzcuintles"],
  },
  {
    normalizedName: "FC Juárez",
    alternativeNames: ["FC Juarez", "Juárez", "Juarez", "Bravos", "Los Bravos"],
  },
  {
    normalizedName: "Atlético",
    alternativeNames: [
      "Atlético San Luis",
      "Atletico San Luis",
      "San Luis",
      "Los Tuneros",
    ],
  },
  {
    normalizedName: "Santos",
    alternativeNames: ["Santos Laguna", "Club Santos Laguna", "Guerreros"],
  },
  {
    normalizedName: "León",
    alternativeNames: [
      "Club León",
      "Club Leon",
      "Leon",
      "La Fiera",
      "Los Panzas Verdes",
    ],
  },
  {
    normalizedName: "Mazatlán",
    alternativeNames: [
      "Mazatlán FC",
      "Mazatlan FC",
      "Mazatlan",
      "Los Cañoneros",
      "Los Canoneros",
    ],
  },
  {
    normalizedName: "Necaxa",
    alternativeNames: ["Club Necaxa", "Rayos", "Los Rayos", "Electricistas"],
  },
  {
    normalizedName: "UNAM",
    alternativeNames: [
      "Pumas UNAM",
      "Pumas",
      "Club Universidad Nacional",
      "Los Pumas",
    ],
  },
  {
    normalizedName: "Atlas",
    alternativeNames: [
      "Atlas FC",
      "Club Atlas",
      "Los Rojinegros",
      "La Academia",
    ],
  },
  {
    normalizedName: "Guadalajara",
    alternativeNames: [
      "Chivas",
      "Chivas Guadalajara",
      "CD Guadalajara",
      "Club Deportivo Guadalajara",
      "Las Chivas",
    ],
  },
  {
    normalizedName: "Querétaro",
    alternativeNames: [
      "Querétaro FC",
      "Queretaro FC",
      "Queretaro",
      "Gallos Blancos",
    ],
  },
  {
    normalizedName: "Puebla",
    alternativeNames: ["Club Puebla", "Puebla FC", "La Franja", "Camoteros"],
  },
];

/**
 * Mapping of team names for the Portuguese Primeira Liga
 */
const primeiraLigaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Sporting CP",
    alternativeNames: [
      "Sporting",
      "Sporting Lisbon",
      "Sporting Clube de Portugal",
      "Leões",
      "Leoes",
      "Lions",
    ],
  },
  {
    normalizedName: "Braga",
    alternativeNames: [
      "SC Braga",
      "Sporting Braga",
      "Sporting Clube de Braga",
      "Os Arcebispos",
      "Arsenalistas",
    ],
  },
  {
    normalizedName: "Porto",
    alternativeNames: [
      "FC Porto",
      "Futebol Clube do Porto",
      "Dragões",
      "Dragoes",
      "Dragons",
    ],
  },
  {
    normalizedName: "Famalicão",
    alternativeNames: [
      "FC Famalicão",
      "Famalicao",
      "FC Famalicao",
      "Famalicenses",
    ],
  },
  {
    normalizedName: "Moreirense",
    alternativeNames: [
      "Moreirense FC",
      "Moreirense Futebol Clube",
      "Os Verdes e Brancos",
    ],
  },
  {
    normalizedName: "Benfica",
    alternativeNames: [
      "SL Benfica",
      "Sport Lisboa e Benfica",
      "Águias",
      "Aguilas",
      "Eagles",
      "Encarnados",
    ],
  },
  {
    normalizedName: "Gil Vicente FC",
    alternativeNames: ["Gil Vicente", "Gilistas", "Galos"],
  },
  {
    normalizedName: "Casa Pia",
    alternativeNames: [
      "Casa Pia AC",
      "Casa Pia Atlético Clube",
      "Gansos",
      "The Geese",
    ],
  },
  {
    normalizedName: "Vitória",
    alternativeNames: [
      "Vitória SC",
      "Vitoria SC",
      "Vitória Guimarães",
      "Vitoria Guimaraes",
      "Conquistadores",
    ],
  },
  {
    normalizedName: "Arouca",
    alternativeNames: ["FC Arouca", "Futebol Clube de Arouca", "Arouquenses"],
  },
  {
    normalizedName: "Estrela",
    alternativeNames: [
      "Estrela Amadora",
      "CF Estrela",
      "Clube de Futebol Estrela da Amadora",
      "Estrelistas",
    ],
  },
  {
    normalizedName: "Nacional",
    alternativeNames: [
      "CD Nacional",
      "Nacional da Madeira",
      "Clube Desportivo Nacional",
      "Alvinegros",
    ],
  },
  {
    normalizedName: "Rio Ave",
    alternativeNames: ["Rio Ave FC", "Rio Ave Futebol Clube", "Rioavistas"],
  },
  {
    normalizedName: "Estoril",
    alternativeNames: [
      "Estoril Praia",
      "GD Estoril Praia",
      "Grupo Desportivo Estoril Praia",
      "Canarinhos",
    ],
  },
  {
    normalizedName: "Alverca",
    alternativeNames: ["FC Alverca", "Futebol Clube de Alverca", "Ribatejanos"],
  },
  {
    normalizedName: "AVS Futebol",
    alternativeNames: [
      "AVS",
      "AVS Futebol SAD",
      "Desportivo Aves",
      "CD Aves",
      "Clube Desportivo das Aves",
    ],
  },
  {
    normalizedName: "Santa Clara",
    alternativeNames: [
      "CD Santa Clara",
      "Clube Desportivo Santa Clara",
      "Açorianos",
      "Acorianos",
    ],
  },
  {
    normalizedName: "Tondela",
    alternativeNames: [
      "CD Tondela",
      "Clube Desportivo de Tondela",
      "Auriverdes",
    ],
  },
  {
    normalizedName: "Farense",
    alternativeNames: [
      "SC Farense",
      "Sporting Clube Farense",
      "Leões de Faro",
      "Leoes de Faro",
    ],
  },
  {
    normalizedName: "Boavista",
    alternativeNames: [
      "Boavista FC",
      "Boavista Porto",
      "Boavista Futebol Clube",
      "As Panteras",
      "Axadrezados",
      "The Chequered Ones",
    ],
  },
];

/**
 * Mapping of team names for the Brazilian Serie A
 */
const brazilianSerieAMapping: TeamNameMapping[] = [
  {
    normalizedName: "Flamengo",
    alternativeNames: [
      "CR Flamengo",
      "Clube de Regatas do Flamengo",
      "Mengão",
      "Mengao",
      "Rubro-Negro",
    ],
  },
  {
    normalizedName: "Palmeiras",
    alternativeNames: [
      "SE Palmeiras",
      "Sociedade Esportiva Palmeiras",
      "Verdão",
      "Verdao",
      "Alviverde",
    ],
  },
  {
    normalizedName: "Cruzeiro",
    alternativeNames: [
      "Cruzeiro EC",
      "Cruzeiro Esporte Clube",
      "Raposa",
      "Cabuloso",
    ],
  },
  {
    normalizedName: "Bahia",
    alternativeNames: [
      "EC Bahia",
      "Esporte Clube Bahia",
      "Tricolor Baiano",
      "Tricolor de Aço",
      "Esquadrão",
    ],
  },
  {
    normalizedName: "Botafogo (RJ)",
    alternativeNames: [
      "Botafogo",
      "Botafogo FR",
      "Botafogo de Futebol e Regatas",
      "Fogão",
      "Fogao",
      "Glorioso",
    ],
  },
  {
    normalizedName: "Mirassol",
    alternativeNames: ["Mirassol FC", "Mirassol Futebol Clube", "Leão", "Leao"],
  },
  {
    normalizedName: "São Paulo",
    alternativeNames: [
      "Sao Paulo",
      "São Paulo FC",
      "Sao Paulo FC",
      "São Paulo Futebol Clube",
      "Tricolor Paulista",
      "Soberano",
    ],
  },
  {
    normalizedName: "Fluminense",
    alternativeNames: [
      "Fluminense FC",
      "Fluminense Football Club",
      "Flu",
      "Tricolor Carioca",
      "Time de Guerreiros",
    ],
  },
  {
    normalizedName: "RB Bragantino",
    alternativeNames: [
      "Red Bull Bragantino",
      "Bragantino",
      "Massa Bruta",
      "Bragantino-SP",
    ],
  },
  {
    normalizedName: "Ceará",
    alternativeNames: [
      "Ceara",
      "Ceará SC",
      "Ceara SC",
      "Ceará Sporting Club",
      "Vozão",
      "Vozao",
      "Alvinegro",
    ],
  },
  {
    normalizedName: "Atlético Mineiro",
    alternativeNames: [
      "Atletico Mineiro",
      "Atlético-MG",
      "Atletico-MG",
      "Clube Atlético Mineiro",
      "Galo",
    ],
  },
  {
    normalizedName: "Internacional",
    alternativeNames: [
      "SC Internacional",
      "Sport Club Internacional",
      "Inter",
      "Colorado",
    ],
  },
  {
    normalizedName: "Grêmio",
    alternativeNames: [
      "Gremio",
      "Grêmio FBPA",
      "Gremio FBPA",
      "Grêmio Foot-Ball Porto Alegrense",
      "Tricolor Gaúcho",
      "Imortal",
    ],
  },
  {
    normalizedName: "Corinthians",
    alternativeNames: [
      "SC Corinthians Paulista",
      "Sport Club Corinthians Paulista",
      "Timão",
      "Timao",
      "Alvinegro",
    ],
  },
  {
    normalizedName: "Santos",
    alternativeNames: [
      "Santos FC",
      "Santos Futebol Clube",
      "Peixe",
      "Alvinegro Praiano",
    ],
  },
  {
    normalizedName: "Vasco da Gama",
    alternativeNames: [
      "CR Vasco da Gama",
      "Club de Regatas Vasco da Gama",
      "Vasco",
      "Gigante da Colina",
      "Cruzmaltino",
    ],
  },
  {
    normalizedName: "Vitória",
    alternativeNames: [
      "EC Vitória",
      "Esporte Clube Vitória",
      "Vitoria",
      "Rubro-Negro Baiano",
      "Leão da Barra",
    ],
  },
  {
    normalizedName: "Sport Recife",
    alternativeNames: [
      "Sport",
      "Sport Club do Recife",
      "Leão",
      "Leao",
      "Leão da Ilha",
      "Leao da Ilha",
      "Rubro-Negro",
    ],
  },
  {
    normalizedName: "Fortaleza",
    alternativeNames: [
      "Fortaleza EC",
      "Fortaleza Esporte Clube",
      "Leão do Pici",
      "Leao do Pici",
      "Tricolor de Aço",
      "Tricolor do Pici",
    ],
  },
  {
    normalizedName: "Juventude",
    alternativeNames: [
      "EC Juventude",
      "Esporte Clube Juventude",
      "Juve",
      "Alviverde",
      "Papo",
    ],
  },
];

/**
 * Mapping of team names for the German Bundesliga
 */
const bundesligaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Bayern Munich",
    alternativeNames: [
      "Bayern",
      "FC Bayern",
      "FC Bayern München",
      "FC Bayern Munchen",
      "Bayern Munchen",
      "Die Bayern",
      "Die Roten",
    ],
  },
  {
    normalizedName: "Köln",
    alternativeNames: [
      "Koln",
      "FC Köln",
      "FC Koln",
      "1. FC Köln",
      "1. FC Koln",
      "1.FC Köln",
      "Effzeh",
      "Die Geißböcke",
      "Die Geissboecke",
    ],
  },
  {
    normalizedName: "Eint Frankfurt",
    alternativeNames: [
      "Eintracht Frankfurt",
      "Frankfurt",
      "SGE",
      "Die Adler",
      "Eintracht",
    ],
  },
  {
    normalizedName: "Dortmund",
    alternativeNames: [
      "Borussia Dortmund",
      "BVB",
      "Die Schwarzgelben",
      "Die Borussen",
    ],
  },
  {
    normalizedName: "Stuttgart",
    alternativeNames: ["VfB Stuttgart", "VfB", "Die Schwaben", "Die Roten"],
  },
  {
    normalizedName: "Hamburger SV",
    alternativeNames: ["Hamburg", "HSV", "Die Rothosen", "Der Dino"],
  },
  {
    normalizedName: "Werder Bremen",
    alternativeNames: [
      "Werder",
      "Bremen",
      "SVW",
      "Die Werderaner",
      "Die Grün-Weißen",
      "Die Grun-Weissen",
      "SV Werder Bremen",
    ],
  },
  {
    normalizedName: "Gladbach",
    alternativeNames: [
      "Borussia Mönchengladbach",
      "Borussia Monchengladbach",
      "Mönchengladbach",
      "Monchengladbach",
      "BMG",
      "Die Fohlen",
    ],
  },
  {
    normalizedName: "St. Pauli",
    alternativeNames: [
      "Sankt Pauli",
      "FC St. Pauli",
      "FC Sankt Pauli",
      "FCSP",
      "Kiezkicker",
    ],
  },
  {
    normalizedName: "Leverkusen",
    alternativeNames: [
      "Bayer Leverkusen",
      "Bayer 04 Leverkusen",
      "Bayer 04",
      "Die Werkself",
    ],
  },
  {
    normalizedName: "Freiburg",
    alternativeNames: [
      "SC Freiburg",
      "Sport-Club Freiburg",
      "SCF",
      "Breisgau-Brasilianer",
    ],
  },
  {
    normalizedName: "Wolfsburg",
    alternativeNames: ["VfL Wolfsburg", "VfL", "Die Wölfe", "Die Wolfe"],
  },
  {
    normalizedName: "Mainz 05",
    alternativeNames: [
      "Mainz",
      "1.FSV Mainz 05",
      "1. FSV Mainz 05",
      "FSV Mainz 05",
      "Die Nullfünfer",
      "Die Nullfunfer",
    ],
  },
  {
    normalizedName: "Hoffenheim",
    alternativeNames: [
      "TSG Hoffenheim",
      "TSG 1899 Hoffenheim",
      "1899 Hoffenheim",
      "Die Kraichgauer",
    ],
  },
  {
    normalizedName: "Augsburg",
    alternativeNames: [
      "FC Augsburg",
      "FCA",
      "Die Fuggerstädter",
      "Die Fuggerstaedter",
    ],
  },
  {
    normalizedName: "Union Berlin",
    alternativeNames: [
      "Union",
      "1. FC Union Berlin",
      "1.FC Union Berlin",
      "Die Eisernen",
      "Eisern Union",
    ],
  },
  {
    normalizedName: "Heidenheim",
    alternativeNames: ["1. FC Heidenheim", "FCH", "Die Heidenheimer"],
  },
  {
    normalizedName: "RB Leipzig",
    alternativeNames: ["Leipzig", "Die Roten Bullen", "Die Bullen"],
  },
];

/**
 * Mapping of team names for Denmark
 */
const denmarkMapping: TeamNameMapping[] = [
  {
    normalizedName: "FC Copenhagen",
    alternativeNames: ["Copenhagen", "FCK", "Kopenhagen"],
  },
];

/**
 * Mapping of team names for Austria
 */
const austriaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Red Bull Salzburg",
    alternativeNames: ["RB Salzburg", "FC Red Bull Salzburg", "Salzburg"],
  },
];

/**
 * Mapping of team names for Ukraine
 */
const ukraineMapping: TeamNameMapping[] = [
  {
    normalizedName: "Shakhtar",
    alternativeNames: ["Shakhtar Donetsk"],
  },
];

/**
 * Mapping of team names for Bulgaria
 */
const bulgarianMapping: TeamNameMapping[] = [
  {
    normalizedName: "Ludogorets",
    alternativeNames: ["Ludogorets Razgrad", "PFC Ludogorets"],
  },
];

/**
 * Mapping of team names for Slovenia
 */
const sloveniaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Olimpija",
    alternativeNames: ["Olimpija Ljubljana"],
  },
];

/**
 * Mapping of team names for Scotland
 */
const scotlandMapping: TeamNameMapping[] = [
  {
    normalizedName: "Hearts",
    alternativeNames: ["Heart of Midlothian"],
  },
];

/**
 * Mapping of team names for Finland
 */
const finnishMapping: TeamNameMapping[] = [
  {
    normalizedName: "HJK Helsinki",
    alternativeNames: ["HJK"],
  },
];

/**
 * Mapping of team names for Moldova
 */
const moldovaMapping: TeamNameMapping[] = [
  {
    normalizedName: "Petrocub",
    alternativeNames: ["Petrocub Sărata-Galbenă"],
  },
];

/**
 * Mapping of team names for Romania
 */
const romaniaMapping: TeamNameMapping[] = [
  {
    normalizedName: "CS U Craiova",
    alternativeNames: ["CS Universitatea Craiova"],
  },
];

/**
 * Mapping of team names for Gibraltar
 */
const gibraltarMapping: TeamNameMapping[] = [
  {
    normalizedName: "Red Imps",
    alternativeNames: ["Lincoln Red Imps"],
  },
];

/**
 * Mapping of team names for Poland
 */
const polandMapping: TeamNameMapping[] = [
  {
    normalizedName: "Raków",
    alternativeNames: ["Raków Częstochowa"],
  },
];

/**
 * Mapping of team names for Turkey
 */
const turkeyMapping: TeamNameMapping[] = [
  {
    normalizedName: "Galatasaray",
    alternativeNames: ["Galatasaray SK", "Galatasaray S.K.", "Gala"],
  },
  {
    normalizedName: "Başakşehir",
    alternativeNames: ["Başakşehir FK", "İstanbul Başakşehir"],
  },
];

/**
 * Mapping of team names for the Argentine Primera División
 */
const argentinePrimeraMapping: TeamNameMapping[] = [
  {
    normalizedName: "River Plate",
    alternativeNames: [
      "Club Atlético River Plate",
      "CARP",
      "Los Millonarios",
      "La Banda",
    ],
  },
  {
    normalizedName: "Rosario Central",
    alternativeNames: [
      "Club Atlético Rosario Central",
      "CARC",
      "Los Canallas",
      "El Canalla",
      "Academia",
    ],
  },
  {
    normalizedName: "Boca Juniors",
    alternativeNames: [
      "Club Atlético Boca Juniors",
      "CABJ",
      "Los Xeneizes",
      "La Boca",
      "Azul y Oro",
    ],
  },
  {
    normalizedName: "Arg Juniors",
    alternativeNames: [
      "Argentinos Juniors",
      "AA Argentinos Juniors",
      "Asociación Atlética Argentinos Juniors",
      "El Bicho",
      "Los Bichos",
    ],
  },
  {
    normalizedName: "Barracas Central",
    alternativeNames: [
      "Club Atlético Barracas Central",
      "CABC",
      "El Guapo",
      "El Camionero",
    ],
  },
  {
    normalizedName: "Huracan",
    alternativeNames: [
      "Club Atlético Huracán",
      "Huracán",
      "Atlético Huracan",
      "Atlético Huracán",
      "CAH",
      "El Globo",
      "Quemeros",
    ],
  },
  {
    normalizedName: "Tigre",
    alternativeNames: [
      "Club Atlético Tigre",
      "CA Tigre BA",
      "CAT",
      "El Matador",
      "Los Matadores",
    ],
  },
  {
    normalizedName: "San Lorenzo",
    alternativeNames: [
      "Club Atlético San Lorenzo de Almagro",
      "CASLA",
      "El Ciclón",
      "Los Cuervos",
      "Azulgrana",
    ],
  },
  {
    normalizedName: "Racing Club",
    alternativeNames: [
      "Racing Club de Avellaneda",
      "La Academia",
      "El Primer Grande",
    ],
  },
  {
    normalizedName: "Ind. Rivadavia",
    alternativeNames: [
      "Independiente Rivadavia",
      "Club Sportivo Independiente Rivadavia",
      "La Lepra",
      "Azul",
    ],
  },
  {
    normalizedName: "Independiente",
    alternativeNames: [
      "Club Atlético Independiente",
      "CAI",
      "El Rojo",
      "Los Diablos Rojos",
      "Rey de Copas",
    ],
  },
  {
    normalizedName: "Deportivo Riestra",
    alternativeNames: [
      "Club Deportivo Riestra",
      "El Malevo",
      "El Blanquinegro",
    ],
  },
  {
    normalizedName: "Estudiantes–LP",
    alternativeNames: [
      "Estudiantes",
      "Estudiantes de La Plata",
      "Club Estudiantes de La Plata",
      "El Pincha",
      "Los Pinchas",
    ],
  },
  {
    normalizedName: "Lanus",
    alternativeNames: ["Club Atlético Lanús", "Lanús", "El Granate", "Granate"],
  },
  {
    normalizedName: "Platense",
    alternativeNames: [
      "Club Atlético Platense",
      "El Calamar",
      "Marrón",
      "El Marrón",
    ],
  },
  {
    normalizedName: "Defensa y Just",
    alternativeNames: [
      "Defensa y Justicia",
      "Club Social y Deportivo Defensa y Justicia",
      "El Halcón",
      "El Halcon de Varela",
    ],
  },
  {
    normalizedName: "Instituto de Córdoba",
    alternativeNames: [
      "Central Córdoba",
      "Cen. Córdoba–SdE",
      "Central Cordoba",
      "Club Atlético Central Córdoba",
      "Central Cordoba de Santiago del Estero",
      "El Ferroviario",
    ],
  },
  {
    normalizedName: "Newell's OB",
    alternativeNames: [
      "Newell's Old Boys",
      "Newells Old Boys",
      "Newell's",
      "Newells",
      "La Lepra",
      "Los Leprosos",
    ],
  },
  {
    normalizedName: "Belgrano",
    alternativeNames: [
      "Club Atlético Belgrano",
      "Belgrano de Cordoba",
      "CAB",
      "El Pirata",
      "Los Piratas",
      "El Celeste",
    ],
  },
  {
    normalizedName: "Gimnasia–LP",
    alternativeNames: [
      "Gimnasia",
      "Gimnasia y Esgrima La Plata",
      "Gimnasia La Plata",
      "GELP",
      "El Lobo",
      "Los Lobos",
      "Tripero",
    ],
  },
  {
    normalizedName: "Instituto",
    alternativeNames: [
      "Instituto Atlético Central Córdoba",
      "Instituto ACC",
      "La Gloria",
    ],
  },
  {
    normalizedName: "Unión",
    alternativeNames: [
      "Club Atlético Unión",
      "Unión de Santa Fe",
      "Union Santa Fe",
      "El Tatengue",
      "Los Tatengues",
    ],
  },
  {
    normalizedName: "Atletico Tucuman",
    alternativeNames: [
      "Atlético Tucumán",
      "Atlético Tucuman",
      "Atlé Tucumán",
      "Club Atlético Tucumán",
      "El Decano",
      "Los Decanos",
    ],
  },
  {
    normalizedName: "Velez Sarsfield",
    alternativeNames: [
      "Vélez",
      "Velez",
      "Velez Sarsfield BA",
      "Vélez Sarsfield",
      "Velez Sarsfield",
      "Club Atlético Vélez Sarsfield",
      "El Fortín",
      "El Fortin",
    ],
  },
  {
    normalizedName: "Banfield",
    alternativeNames: ["Club Atlético Banfield", "El Taladro", "Los Taladros"],
  },
  {
    normalizedName: "Sarmiento",
    alternativeNames: [
      "Club Atlético Sarmiento",
      "Sarmiento de Junín",
      "Sarmiento de Junin",
      "El Verde",
    ],
  },
  {
    normalizedName: "Godoy Cruz",
    alternativeNames: [
      "Club Deportivo Godoy Cruz Antonio Tomba",
      "CDGCAT",
      "El Tomba",
      "Tombino",
      "Bodeguero",
    ],
  },
  {
    normalizedName: "Talleres",
    alternativeNames: [
      "Club Atlético Talleres",
      "Talleres de Córdoba",
      "Talleres de Cordoba",
      "La T",
      "El Matador",
    ],
  },
  {
    normalizedName: "Aldosivi",
    alternativeNames: [
      "Club Atlético Aldosivi",
      "El Tiburón",
      "Aldosivi Mar del Plata",
      "El Tiburon",
      "Los Tiburones",
    ],
  },
  {
    normalizedName: "San Martin de San Juan",
    alternativeNames: [
      "San Martín",
      "San Martin",
      "San Martín de San Juan",
      "Club Atlético San Martín",
      "El Santo",
      "El Verdinegro",
    ],
  },
];

/**
 * Consolidated English team mappings (Premier League + Championship)
 * Resolves conflicts between league-specific mappings for teams that move between divisions
 */
const englishTeamMapping: TeamNameMapping[] = [
  {
    normalizedName: "Arsenal",
    alternativeNames: ["Arsenal FC", "Arsenal Football Club"],
  },
  {
    normalizedName: "Aston Villa",
    alternativeNames: ["Aston Villa FC", "Villa"],
  },
  {
    normalizedName: "Brentford",
    alternativeNames: ["Brentford FC", "The Bees"],
  },
  {
    normalizedName: "Brighton",
    alternativeNames: [
      "Brighton & Hove Albion",
      "Brighton and Hove Albion",
      "Brighton & Hove",
    ],
  },
  {
    normalizedName: "Burnley",
    alternativeNames: ["Burnley FC", "The Clarets"],
  },
  {
    normalizedName: "Bournemouth",
    alternativeNames: ["AFC Bournemouth", "The Cherries"],
  },
  {
    normalizedName: "Chelsea",
    alternativeNames: ["Chelsea FC", "The Blues"],
  },
  {
    normalizedName: "Crystal Palace",
    alternativeNames: ["Crystal Palace FC", "Palace", "The Eagles"],
  },
  {
    normalizedName: "Everton",
    alternativeNames: ["Everton FC", "The Toffees"],
  },
  {
    normalizedName: "Fulham",
    alternativeNames: ["Fulham FC", "The Cottagers"],
  },
  {
    normalizedName: "Liverpool",
    alternativeNames: ["Liverpool FC", "The Reds"],
  },
  {
    normalizedName: "Manchester City",
    alternativeNames: [
      "Man City",
      "Manchester City",
      "Manchester City FC",
      "City",
      "MCFC",
      "The Citizens",
    ],
  },
  {
    normalizedName: "Manchester United",
    alternativeNames: [
      "Man United",
      "Manchester United FC",
      "Manchester Utd",
      "United",
      "MUFC",
      "The Red Devils",
    ],
  },
  {
    normalizedName: "Newcastle",
    alternativeNames: [
      "Newcastle United",
      "Newcastle Utd",
      "Newcastle United FC",
      "The Magpies",
      "NUFC",
    ],
  },
  {
    normalizedName: "Nottingham Forest",
    alternativeNames: [
      "Nott'ham Forest",
      "Nott'm Forest",
      "Nottingham Forest",
      "Nottingham Forest FC",
      "Forest",
      "NFFC",
      "The Reds",
    ],
  },
  {
    normalizedName: "Tottenham",
    alternativeNames: [
      "Tottenham Hotspur",
      "Tottenham Hotspur FC",
      "Spurs",
      "THFC",
    ],
  },
  {
    normalizedName: "West Ham",
    alternativeNames: [
      "West Ham United",
      "West Ham United FC",
      "The Hammers",
      "WHUFC",
    ],
  },
  {
    normalizedName: "Wolves",
    alternativeNames: [
      "Wolverhampton Wanderers",
      "Wolverhampton Wanderers FC",
      "WWFC",
    ],
  },
  // Championship and promoted/relegated teams
  {
    normalizedName: "Sunderland",
    alternativeNames: ["Sunderland AFC", "Sunderland FC", "The Black Cats"],
  },
  {
    normalizedName: "Leicester",
    alternativeNames: ["Leicester City", "Leicester City FC", "The Foxes"],
  },
  {
    normalizedName: "Southampton",
    alternativeNames: ["Southampton FC", "Saints", "The Saints"],
  },
  {
    normalizedName: "Ipswich Town",
    alternativeNames: ["Ipswich", "The Tractor Boys"],
  },
  {
    normalizedName: "Leeds United",
    alternativeNames: ["Leeds", "Leeds United FC", "United", "The Whites"],
  },
  {
    normalizedName: "Norwich",
    alternativeNames: ["Norwich City", "Norwich City FC", "The Canaries"],
  },
  {
    normalizedName: "Watford",
    alternativeNames: ["Watford FC", "The Hornets"],
  },
  {
    normalizedName: "Derby County",
    alternativeNames: ["Derby", "The Rams"],
  },
  {
    normalizedName: "Bristol City",
    alternativeNames: ["Bristol", "The Robins"],
  },
  {
    normalizedName: "Hull City",
    alternativeNames: ["Hull", "The Tigers"],
  },
  {
    normalizedName: "Blackburn Rovers",
    alternativeNames: ["Blackburn", "Rovers"],
  },
  {
    normalizedName: "Charlton Athletic",
    alternativeNames: ["Charlton Ath", "Charlton", "The Addicks"],
  },
  {
    normalizedName: "Swansea City",
    alternativeNames: ["Swansea", "The Swans"],
  },
  {
    normalizedName: "Birmingham City",
    alternativeNames: ["Birmingham", "Blues"],
  },
  {
    normalizedName: "Oxford United",
    alternativeNames: ["Oxford", "The U's", "The Yellows"],
  },
  {
    normalizedName: "Coventry City",
    alternativeNames: ["Coventry", "The Sky Blues"],
  },
  {
    normalizedName: "Queens Park Rangers",
    alternativeNames: ["QPR", "Rangers", "The Hoops"],
  },
  {
    normalizedName: "Preston North End",
    alternativeNames: ["Preston", "Preston NE", "PNE", "The Lilywhites"],
  },
  {
    normalizedName: "Middlesbrough",
    alternativeNames: ["Boro", "Middlesbrough FC", "The Boro"],
  },
  {
    normalizedName: "Sheffield United",
    alternativeNames: ["Sheffield Utd", "Sheffield", "The Blades"],
  },
  {
    normalizedName: "Millwall",
    alternativeNames: ["The Lions", "Millwall FC", "The Den"],
  },
  {
    normalizedName: "West Bromwich Albion",
    alternativeNames: ["West Brom", "WBA", "The Baggies"],
  },
  {
    normalizedName: "Portsmouth",
    alternativeNames: ["Pompey", "Portsmouth FC"],
  },
  {
    normalizedName: "Wrexham",
    alternativeNames: ["Wrexham AFC", "The Red Dragons"],
  },
  {
    normalizedName: "Sheffield Wednesday",
    alternativeNames: ["Sheffield Weds", "Wednesday", "The Owls"],
  },
  {
    normalizedName: "Stoke City",
    alternativeNames: ["Stoke", "The Potters"],
  },
  {
    normalizedName: "Luton Town",
    alternativeNames: ["Luton", "The Hatters"],
  },
  {
    normalizedName: "Plymouth Argyle",
    alternativeNames: ["Plymouth", "The Pilgrims"],
  },
  {
    normalizedName: "Cardiff City",
    alternativeNames: ["Cardiff", "The Bluebirds"],
  },
  {
    normalizedName: "Huddersfield Town",
    alternativeNames: [
      "Huddersfield",
      "Huddersfield Town AFC",
      "The Terriers",
      "HTAFC",
    ],
  },
  {
    normalizedName: "Forest Green Rovers",
    alternativeNames: ["FG Rovers", "Forest Green", "The Green Devils"],
  },
  {
    normalizedName: "Peterborough United",
    alternativeNames: ["P'borough Utd", "Peterborough", "Posh", "The Posh"],
  },
  {
    normalizedName: "Accrington Stanley",
    alternativeNames: ["Acc'ton Stanley", "Accrington", "Stanley"],
  },
  {
    normalizedName: "Wycombe Wanderers",
    alternativeNames: ["Wycombe", "The Chairboys"],
  },
  {
    normalizedName: "Cheltenham Town",
    alternativeNames: ["Cheltenham", "The Robins"],
  },
  {
    normalizedName: "Northampton Town",
    alternativeNames: ["Northampton", "The Cobblers"],
  },
  {
    normalizedName: "Rotherham United",
    alternativeNames: ["Rotherham Utd", "Rotherham", "The Millers"],
  },
  {
    normalizedName: "Cambridge United",
    alternativeNames: ["Cambridge Utd", "Cambridge", "The U's"],
  },
  {
    normalizedName: "Doncaster Rovers",
    alternativeNames: ["Doncaster", "Donny", "Rovers"],
  },
  {
    normalizedName: "Crewe Alexandra",
    alternativeNames: ["Crewe", "The Railwaymen"],
  },
  {
    normalizedName: "Bolton Wanderers",
    alternativeNames: ["Bolton", "The Trotters"],
  },
  {
    normalizedName: "Colchester United",
    alternativeNames: ["Colchester Utd", "Colchester", "The U's"],
  },
  {
    normalizedName: "Milton Keynes Dons",
    alternativeNames: ["MK Dons", "Milton-Keynes Dons"],
  },
  {
    normalizedName: "Grimsby Town",
    alternativeNames: ["Grimsby", "The Mariners"],
  },
  {
    normalizedName: "Shrewsbury Town",
    alternativeNames: ["Shrewsbury", "Town", "The Shrews"],
  },
  {
    normalizedName: "Exeter City",
    alternativeNames: ["Exeter", "The Grecians"],
  },
  {
    normalizedName: "Bradford City",
    alternativeNames: ["Bradford", "The Bantams"],
  },
  {
    normalizedName: "Swindon Town",
    alternativeNames: ["Swindon", "The Robins"],
  },
  {
    normalizedName: "Blackpool",
    alternativeNames: ["Blackpool FC", "The Seasiders"],
  },
  {
    normalizedName: "Scunthorpe United",
    alternativeNames: ["Scunthorpe Utd", "Scunthorpe", "The Iron"],
  },
  {
    normalizedName: "Barnet",
    alternativeNames: ["Barnet FC", "The Bees"],
  },
  {
    normalizedName: "Harrogate Town",
    alternativeNames: ["Harrogate", "Town"],
  },
  {
    normalizedName: "Fleetwood Town",
    alternativeNames: ["Fleetwood", "The Cod Army"],
  },
  {
    normalizedName: "Barrow",
    alternativeNames: ["Barrow AFC", "The Bluebirds"],
  },
  {
    normalizedName: "Stockport County",
    alternativeNames: ["Stockport", "County", "The Hatters"],
  },
  {
    normalizedName: "Tranmere Rovers",
    alternativeNames: ["Tranmere", "Rovers"],
  },
  {
    normalizedName: "Salford City",
    alternativeNames: ["Salford", "The Ammies"],
  },
  {
    normalizedName: "Lincoln City",
    alternativeNames: ["Lincoln", "The Imps"],
  },
  {
    normalizedName: "Stevenage",
    alternativeNames: ["Stevenage FC", "Boro"],
  },
  {
    normalizedName: "Gillingham",
    alternativeNames: ["Gillingham FC", "The Gills"],
  },
  {
    normalizedName: "Newport County",
    alternativeNames: ["Newport", "The Exiles"],
  },
  {
    normalizedName: "AFC Wimbledon",
    alternativeNames: ["Wimbledon", "The Dons"],
  },
  {
    normalizedName: "Bromley",
    alternativeNames: ["Bromley FC", "The Ravens"],
  },
  {
    normalizedName: "Bristol Rovers",
    alternativeNames: ["Bristol Rov", "The Gas"],
  },
  {
    normalizedName: "Chesterfield",
    alternativeNames: ["Chesterfield FC", "The Spireites"],
  },
  {
    normalizedName: "Carlisle United",
    alternativeNames: ["Carlisle", "The Cumbrians"],
  },
  {
    normalizedName: "Walsall",
    alternativeNames: ["Walsall FC", "The Saddlers"],
  },
  {
    normalizedName: "Mansfield Town",
    alternativeNames: ["Mansfield", "The Stags"],
  },
  {
    normalizedName: "Crawley Town",
    alternativeNames: ["Crawley", "The Red Devils"],
  },
  {
    normalizedName: "Burton Albion",
    alternativeNames: ["Burton", "The Brewers"],
  },
  {
    normalizedName: "Notts County",
    alternativeNames: ["Notts Co", "The Magpies"],
  },
  {
    normalizedName: "Leyton Orient",
    alternativeNames: ["Orient", "The O's"],
  },
  {
    normalizedName: "Port Vale",
    alternativeNames: ["Port Vale FC", "The Valiants"],
  },
  {
    normalizedName: "Morecambe",
    alternativeNames: ["Morecambe FC", "The Shrimps"],
  },
  {
    normalizedName: "Wigan Athletic",
    alternativeNames: ["Wigan", "The Latics"],
  },
  {
    normalizedName: "Reading",
    alternativeNames: ["Reading FC", "The Royals"],
  },
  {
    normalizedName: "Barnsley",
    alternativeNames: ["Barnsley FC", "The Tykes"],
  },
  {
    normalizedName: "Sutton United",
    alternativeNames: ["Sutton", "The U's"],
  },
  {
    normalizedName: "Ebbsfleet United",
    alternativeNames: ["Ebbsfleet Utd", "Ebbsfleet", "The Fleet"],
  },
  {
    normalizedName: "Maidenhead United",
    alternativeNames: ["Maidenhead Utd"],
  },
  {
    normalizedName: "Dagenham & Redbridge",
    alternativeNames: ["Dag & Red"],
  },
  {
    normalizedName: "Maidstone United",
    alternativeNames: ["Maidstone Utd"],
  },
];

/**
 * Consolidated Italian team mappings (Serie A + Serie B)
 * Resolves conflicts between league-specific mappings for teams that move between divisions
 */
const italianTeamMapping: TeamNameMapping[] = [
  // Serie A teams
  {
    normalizedName: "Juventus",
    alternativeNames: [
      "Juventus FC",
      "Juventus Football Club",
      "Juve",
      "Bianconeri",
    ],
  },
  {
    normalizedName: "AC Milan",
    alternativeNames: [
      "Milan",
      "Associazione Calcio Milan",
      "ACM",
      "Rossoneri",
    ],
  },
  {
    normalizedName: "Inter Milan",
    alternativeNames: [
      "Inter",
      "Internazionale",
      "FC Internazionale Milano",
      "Nerazzurri",
    ],
  },
  {
    normalizedName: "Napoli",
    alternativeNames: [
      "SSC Napoli",
      "Società Sportiva Calcio Napoli",
      "Azzurri",
    ],
  },
  {
    normalizedName: "AS Roma",
    alternativeNames: [
      "Roma",
      "Associazione Sportiva Roma",
      "ASR",
      "Giallorossi",
    ],
  },
  {
    normalizedName: "Lazio",
    alternativeNames: ["SS Lazio", "Società Sportiva Lazio", "Biancocelesti"],
  },
  {
    normalizedName: "Atalanta",
    alternativeNames: [
      "Atalanta BC",
      "Atalanta Bergamasca Calcio",
      "Nerazzurri",
    ],
  },
  {
    normalizedName: "Fiorentina",
    alternativeNames: [
      "ACF Fiorentina",
      "Associazione Calcio Firenze Fiorentina",
      "Viola",
    ],
  },
  {
    normalizedName: "Torino",
    alternativeNames: ["Torino FC", "Torino Football Club", "Granata"],
  },
  {
    normalizedName: "Bologna",
    alternativeNames: [
      "Bologna FC",
      "Bologna Football Club",
      "Rossoblù",
      "Bologna FC 1909",
    ],
  },
  {
    normalizedName: "Sassuolo",
    alternativeNames: [
      "US Sassuolo",
      "Unione Sportiva Sassuolo Calcio",
      "I Neroverdi",
    ],
  },
  {
    normalizedName: "Udinese",
    alternativeNames: ["Udinese Calcio", "Bianconeri"],
  },
  {
    normalizedName: "Sampdoria",
    alternativeNames: [
      "UC Sampdoria",
      "Unione Calcio Sampdoria",
      "Samp",
      "Blucerchiati",
    ],
  },
  {
    normalizedName: "Genoa",
    alternativeNames: [
      "Genoa CFC",
      "Genoa Cricket and Football Club",
      "Rossoblu",
    ],
  },
  {
    normalizedName: "Hellas Verona",
    alternativeNames: ["Verona", "Hellas Verona FC", "Gialloblù"],
  },
  {
    normalizedName: "Spezia",
    alternativeNames: ["Spezia Calcio", "Aquilotti"],
  },
  {
    normalizedName: "Salernitana",
    alternativeNames: [
      "US Salernitana",
      "Unione Sportiva Salernitana",
      "Granata",
    ],
  },
  {
    normalizedName: "Cagliari",
    alternativeNames: ["Cagliari Calcio", "Rossoblu"],
  },
  {
    normalizedName: "Empoli",
    alternativeNames: [
      "Empoli FC",
      "Empoli Football Club",
      "Gli Azzurri",
      "FC Empoli",
    ],
  },
  {
    normalizedName: "Venezia",
    alternativeNames: ["Venezia FC", "Arancioneroverdi", "Lagunari"],
  },
  {
    normalizedName: "Monza",
    alternativeNames: ["AC Monza", "Associazione Calcio Monza", "Biancorossi"],
  },
  // Serie B teams
  {
    normalizedName: "Palermo",
    alternativeNames: ["Palermo FC", "US Palermo", "Rosanero"],
  },
  {
    normalizedName: "Frosinone",
    alternativeNames: ["Frosinone Calcio", "Canarini"],
  },
  {
    normalizedName: "Pisa",
    alternativeNames: ["Pisa SC", "Pisa Sporting Club", "Nerazzurri"],
  },
  {
    normalizedName: "Brescia",
    alternativeNames: ["Brescia Calcio", "Rondinelle"],
  },
  {
    normalizedName: "Cremonese",
    alternativeNames: ["US Cremonese", "Grigiorossi"],
  },
  {
    normalizedName: "Bari",
    alternativeNames: ["FC Bari", "SSC Bari", "Galletti"],
  },
  {
    normalizedName: "Parma",
    alternativeNames: ["Parma Calcio", "Crociati", "Parma Calcio 1913"],
  },
  {
    normalizedName: "Modena",
    alternativeNames: ["Modena FC", "Canarini"],
  },
  {
    normalizedName: "Reggina",
    alternativeNames: ["Reggina Calcio", "US Reggina", "Amaranto"],
  },
  {
    normalizedName: "Como",
    alternativeNames: ["Como 1907", "Lariani"],
  },
  {
    normalizedName: "Cittadella",
    alternativeNames: ["AS Cittadella", "Granata"],
  },
  {
    normalizedName: "Cosenza",
    alternativeNames: ["Cosenza Calcio", "Lupi"],
  },
  {
    normalizedName: "Cesena",
    alternativeNames: ["AC Cesena", "Cesena FC", "I Cavallucci Marini"],
  },
  {
    normalizedName: "Südtirol",
    alternativeNames: ["FC Südtirol", "Sudtirol", "FC Sudtirol", "Alto Adige"],
  },
  {
    normalizedName: "Carrarese",
    alternativeNames: [
      "Carrarese Calcio",
      "Marmiferi",
      "Azzurri",
      "Carrarese Calcio 1908",
    ],
  },
  {
    normalizedName: "Mantova",
    alternativeNames: ["Mantova FC", "Mantova 1911", "Virgiliani"],
  },
  {
    normalizedName: "Reggiana",
    alternativeNames: [
      "AC Reggiana",
      "Reggiana 1919",
      "Granata",
      "AC Reggiana 1919",
    ],
  },
  {
    normalizedName: "Lecce",
    alternativeNames: ["US Lecce", "Unione Sportiva Lecce", "Giallorossi"],
  },
  {
    normalizedName: "Avellino",
    alternativeNames: [
      "US Avellino",
      "US Avellino 1912",
      "Avellino Calcio",
      "Lupi",
    ],
  },
  {
    normalizedName: "Padova",
    alternativeNames: ["Calcio Padova", "Biancoscudati"],
  },
  {
    normalizedName: "Pescara",
    alternativeNames: ["Delfini", "Pescara Calcio", "Delfino Pescara 1936"],
  },
  {
    normalizedName: "Virtus Entella",
    alternativeNames: ["Entella", "Diavoli Neri"],
  },
  {
    normalizedName: "Juve Stabia",
    alternativeNames: ["SS Juve Stabia", "Vespe"],
  },
  {
    normalizedName: "Catanzaro",
    alternativeNames: [
      "Catanzaro",
      "US Catanzaro",
      "Aquile",
      "US Catanzaro 1929",
    ],
  },
  {
    normalizedName: "Benevento",
    alternativeNames: [
      "Benevento Calcio",
      "US Benevento",
      "Stregoni",
      "Giallorossi",
    ],
  },
  {
    normalizedName: "Ascoli",
    alternativeNames: [
      "Ascoli Picchio",
      "Ascoli Calcio",
      "US Ascoli",
      "Picchio",
      "Bianconeri",
    ],
  },
  {
    normalizedName: "Crotone",
    alternativeNames: [
      "FC Crotone",
      "Football Club Crotone",
      "US Crotone",
      "Pitagorici",
      "Rossoblù",
    ],
  },
  {
    normalizedName: "Perugia",
    alternativeNames: [
      "AC Perugia",
      "Perugia Calcio",
      "Associazione Calcistica Perugia",
      "Grifoni",
      "Biancorossi",
    ],
  },
  {
    normalizedName: "Ternana",
    alternativeNames: [
      "Ternana Calcio",
      "Ternana FC",
      "Rossoverdi",
      "Unicorni",
    ],
  },
  {
    normalizedName: "SPAL",
    alternativeNames: [
      "SPAL 2013",
      "Società Polisportiva Ars et Labor",
      "Spallini",
      "Biancazzurri",
    ],
  },
  {
    normalizedName: "Vicenza Virtus",
    alternativeNames: [
      "Vicenza",
      "LR Vicenza",
      "Lanerossi Vicenza",
      "Vicenza Calcio",
      "Biancorossi",
    ],
  },
  {
    normalizedName: "Alessandria",
    alternativeNames: [
      "US Alessandria",
      "Alessandria Calcio",
      "Unione Sportiva Alessandria",
      "Grigi",
    ],
  },
  {
    normalizedName: "Rimini",
    alternativeNames: ["Rimini FC", "AC Rimini", "Rimini Calcio"],
  },
];

/**
 * Country-based team mappings - the new centralized system
 */
export const countryTeamMappings: CountryTeamMappings = {
  England: englishTeamMapping,
  Italy: italianTeamMapping,
  Belgium: belgianTeamMapping,
  // Keep existing single-league mappings for countries without multiple divisions
  Netherlands: eredivisieMapping,
  Spain: laLigaMapping,
  France: ligue1Mapping,
  Mexico: ligaMXMapping,
  Portugal: primeiraLigaMapping,
  Brazil: brazilianSerieAMapping,
  Germany: bundesligaMapping,
  Argentina: argentinePrimeraMapping,
  Denmark: denmarkMapping,
  Turkey: turkeyMapping,
  Austria: austriaMapping,
  Ukraine: ukraineMapping,
  Bulgaria: bulgarianMapping,
  Slovenia: sloveniaMapping,
  Scotland: scotlandMapping,
  Moldova: moldovaMapping,
  Romania: romaniaMapping,
  Finland: finnishMapping,
  Gibraltar: gibraltarMapping,
  Poland: polandMapping,
};

/**
 * League to country mapping
 * Used to determine which team mappings to use
 * Note: European competitions (Champions League, Europa League, etc.) are marked as "Europe"
 * and are handled specially in normalizeTeamName
 */
const competitionCountryMap: Record<string, string> = {
  england_premier_league: "England",
  efl_championship: "England",
  efl_cup: "England",
  fa_cup: "England",
  coppa_italia: "Italy",
  italy_serie_a: "Italy",
  italy_serie_b: "Italy",
  belgium_first_div: "Belgium",
  belgium_second_division: "Belgium",
  spain_la_liga: "Spain",
  spain_segunda_division: "Spain",
  france_ligue_1: "France",
  france_ligue_2: "France",
  netherlands_eredivisie: "Netherlands",
  netherlands_eerste_divisie: "Netherlands",
  portugal_primeira_liga: "Portugal",
  portugal_segunda_liga: "Portugal",
  germany_bundesliga: "Germany",
  germany_2_bundesliga: "Germany",
  argentina_primeira_division: "Argentina",
  brazil_serie_a: "Brazil",
  mexico_liga_mx: "Mexico",
  // European competitions - cross-country
  champions_league: "Europe",
  europa_league: "Europe",
  europa_conference_league: "Europe",
};

/**
 * Find the normalized team name from any of its possible variations
 * Uses country-based mappings to support teams that move between leagues
 *
 * @param competitionId The ID of the competition the team belongs to
 * @param teamName The team name to normalize (could be any variation)
 * @returns The normalized team name if found, or the original name if not found
 */
export function normalizeTeamName(
  competitionId: string,
  teamName: string
): string {
  const country = competitionCountryMap[competitionId];

  if (!country) {
    console.warn(`No country mapping found for competition: ${competitionId}`);
    return teamName;
  }

  // European competitions have teams from multiple countries
  // Search across all country mappings
  if (country === "Europe") {
    for (const [countryName, mappings] of Object.entries(countryTeamMappings)) {
      // First check if this is already a normalized name
      const isNormalized = mappings.some(
        (mapping) => mapping.normalizedName === teamName
      );
      if (isNormalized) {
        return teamName;
      }

      // Check if it's an alternative name
      for (const mapping of mappings) {
        if (
          mapping.alternativeNames.some(
            (alt) => alt.toLowerCase() === teamName.toLowerCase()
          )
        ) {
          return mapping.normalizedName;
        }
      }
    }

    // If not found in any country mapping, return original name
    console.warn(
      `No mapping found for team "${teamName}" in European competition "${competitionId}"`
    );
    return teamName;
  }

  // Single-country competition - use country-specific mappings
  const mappings = countryTeamMappings[country];
  if (mappings) {
    // First check if this is already a normalized name
    const isNormalized = mappings.some(
      (mapping) => mapping.normalizedName === teamName
    );
    if (isNormalized) {
      return teamName;
    }

    // Check if it's an alternative name
    for (const mapping of mappings) {
      if (
        mapping.alternativeNames.some(
          (alt) => alt.toLowerCase() === teamName.toLowerCase()
        )
      ) {
        return mapping.normalizedName;
      }
    }
  }

  // If not found, return the original name
  console.warn(
    `No mapping found for team "${teamName}" in country "${country}"`
  );
  return teamName;
}
