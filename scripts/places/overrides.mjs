// Hand-checked corrections to the official LGD list. Every entry here was reviewed by a person.
// The generator (build.mjs) fails if an entry no longer matches the data, so a stale fix is noticed.

/** Towns the LGD list gives no district for. Value: the district name in that state. */
export const MISSING_DISTRICT = {
  Telangana: { Nandikonda: 'Nalgonda' },
  Tripura: {
    Badharghat: 'West Tripura',
    Gandhigram: 'West Tripura',
    Indranagar: 'West Tripura',
    Jogendranagar: 'West Tripura',
    Kunjaban: 'West Tripura',
    Narsingarh: 'West Tripura',
  },
  Uttarakhand: {
    Dineshpur: 'Udham Singh Nagar',
    Lambgaon: 'Tehri Garhwal',
    Sultanpur: 'Haridwar',
    Tharali: 'Chamoli',
    Ukhimath: 'Rudraprayag',
  },
}

/**
 * Towns whose LGD ward data puts them in the wrong district. Value: the district they are really in.
 * Jalalabad (Shamli) is a different town from Jalalabad (Bijnor), but its wards are filed under Bijnor.
 */
export const WRONG_DISTRICT = {
  'Uttar Pradesh': { 'Jalalabad(Shamli)': 'Shamli' },
}

/**
 * Several councils that together make one city people search for. The councils are dropped and one city replaces
 * them, covering all their districts. `allDistricts` covers every district of the state (Delhi).
 */
export const MERGED_CITIES = [
  {
    code: 'C-DELHI',
    name: 'Delhi',
    state: 'Delhi',
    // East, North and South Delhi Municipal Corporations were merged into one MCD in 2022; LGD still lists them.
    replaces: ['East Delhi Municipal Corporation', 'North Delhi Municipal Corporation', 'South Delhi Municipal Corporation'],
    allDistricts: true,
  },
  {
    code: 'C-BENGALURU',
    name: 'Bengaluru',
    state: 'Karnataka',
    // Greater Bengaluru Authority's five city corporations.
    replaces: [
      'Bengaluru Central City Corporation(Gba)',
      'Bengaluru East City Corporation',
      'Bengaluru North City Corporation (Gba)',
      'Bengaluru South City Corporation (Gba)',
      'Bengaluru West City Corporation (Gba)',
    ],
  },
]

/** Everyday names for big cities whose council name differs. Key: "State|cleaned name". */
export const RENAMED = {
  'Maharashtra|Greater Mumbai': 'Mumbai',
  'Tamil Nadu|Greater Chennai': 'Chennai',
  // LGD abbreviates Bakshi Ka Talab (Lucknow district); its local-language name spells it out.
  'Uttar Pradesh|Bkt': 'Bakshi Ka Talab',
}

/**
 * Cities already in the live database (libraries point at them). The migration keeps their ids and attaches each to
 * the official town named here, so no library loses its place.
 */
export const LIVE_CITIES = [
  { liveName: 'Lucknow', state: 'Uttar Pradesh', town: 'Lucknow' },
  { liveName: 'Kanpur', state: 'Uttar Pradesh', town: 'Kanpur' },
  { liveName: 'Imphal', state: 'Manipur', town: 'Imphal' },
  { liveName: 'Delhi', state: 'Delhi', town: 'Delhi' },
]
