/**
 * Comprehensive, exam-oriented Indian Geography dataset
 * Includes Rivers, Mountains & Peaks, Mountain Passes, National Parks,
 * Lakes & Waterfalls, Tropic of Cancer, and Rapid Map Quiz.
 * Position coordinates (x, y) represent percentage [0-100] on the calibrated India map viewBox (700x800).
 */

export const GEO_CATEGORIES = [
  { id: 'rivers', labelEn: 'Rivers & Dams', labelHi: 'नदियाँ व बांध', icon: 'Waves' },
  { id: 'mountains', labelEn: 'Peaks & Ranges', labelHi: 'पर्वत व चोटियाँ', icon: 'Mountain' },
  { id: 'passes', labelEn: 'Mountain Passes', labelHi: 'महत्वपूर्ण दर्रे', icon: 'Compass' },
  { id: 'parks', labelEn: 'National Parks', labelHi: 'राष्ट्रीय उद्यान', icon: 'Trees' },
  { id: 'lakes', labelEn: 'Lakes & Falls', labelHi: 'झीलें व जलप्रपात', icon: 'Droplets' },
  { id: 'meridians', labelEn: 'Tropic & IST', labelHi: 'कर्क रेखा व 82.5°E', icon: 'Globe' }
];

export const REGIONS_FILTER = [
  { id: 'all', labelEn: 'All India', labelHi: 'सम्पूर्ण भारत' },
  { id: 'north', labelEn: 'North (Himalayas)', labelHi: 'उत्तर (हिमालयी क्षेत्र)', bounds: { minY: 0, maxY: 35 } },
  { id: 'central', labelEn: 'Central & Plains', labelHi: 'मध्य व गंगा मैदान', bounds: { minY: 32, maxY: 65, minX: 25, maxX: 75 } },
  { id: 'south', labelEn: 'Peninsular South', labelHi: 'दक्षिण भारत (प्रायद्वीप)', bounds: { minY: 65, maxY: 100 } },
  { id: 'east_ne', labelEn: 'North-East & East', labelHi: 'पूर्वोत्तर व पूर्व', bounds: { minX: 60, maxX: 100, minY: 20, maxY: 65 } },
  { id: 'west', labelEn: 'West (Desert & Coast)', labelHi: 'पश्चिम (थार व तटीय)', bounds: { minX: 0, maxX: 38, minY: 30, maxY: 70 } }
];

export const RIVERS_DATA = [
  {
    id: 'ganga',
    nameEn: 'Ganga River',
    nameHi: 'गंगा नदी',
    originEn: 'Gangotri Glacier (as Bhagirathi), Uttarkashi, Uttarakhand',
    originHi: 'गंगोत्री हिमनद (भागीरथी के रूप में), उत्तरकाशी, उत्तराखंड',
    outflowEn: 'Bay of Bengal (Meghna estuary in Bangladesh)',
    outflowHi: 'बंगाल की खाड़ी (बांग्लादेश में मेघना मुहाना)',
    lengthKm: 2525,
    states: ['Uttarakhand', 'Uttar Pradesh', 'Bihar', 'West Bengal'],
    leftTributaries: ['Ramganga', 'Gomti', 'Ghaghara', 'Gandak', 'Kosi (Sorrow of Bihar)', 'Mahananda'],
    rightTributaries: ['Yamuna (Largest)', 'Son', 'Tons', 'Damodar (via Hooghly)'],
    dams: ['Tehri Dam (Bhagirathi - Highest in India)', 'Farakka Barrage (West Bengal)'],
    examFacts: [
      'National River of India declared in 2008.',
      'Devprayag is where Bhagirathi and Alaknanda unite to become Ganga.',
      'World’s largest delta is formed by Ganga and Brahmaputra (Sundarban Delta).'
    ],
    x: 47.3,
    y: 41.7
  },
  {
    id: 'yamuna',
    nameEn: 'Yamuna River',
    nameHi: 'यमुना नदी',
    originEn: 'Yamunotri Glacier (Bandarpunch Peak), Uttarakhand',
    originHi: 'यमुनोत्री हिमनद (बंदरपूंछ चोटी), उत्तराखंड',
    outflowEn: 'Confluence with Ganga at Prayagraj (Triveni Sangam)',
    outflowHi: 'प्रयागराज में गंगा से संगम (त्रिवेणी संगम)',
    lengthKm: 1376,
    states: ['Uttarakhand', 'Himachal Pradesh', 'Haryana', 'Delhi', 'Uttar Pradesh'],
    leftTributaries: ['Hindon', 'Tons'],
    rightTributaries: ['Chambal', 'Sindh', 'Betwa', 'Ken'],
    dams: ['Lakhwar Dam', 'Hathnikund Barrage (Haryana)'],
    examFacts: [
      'Largest tributary of River Ganga in India.',
      'Chambal, Betwa, and Ken are peninsular tributaries that join Yamuna from the south.'
    ],
    x: 34.0,
    y: 35.4
  },
  {
    id: 'indus',
    nameEn: 'Indus River (Sindhu)',
    nameHi: 'सिंधु नदी',
    originEn: 'Near Lake Mansarovar (Bokhar Chu glacier), Tibet',
    originHi: 'मानसरोवर झील के निकट (बोखार चू हिमनद), तिब्बत',
    outflowEn: 'Arabian Sea (near Karachi, Pakistan)',
    outflowHi: 'अरब सागर (कराची के निकट, पाकिस्तान)',
    lengthKm: 3180,
    states: ['Ladakh (UT)'],
    leftTributaries: ['Zanskar', 'Jhelum', 'Chenab', 'Ravi', 'Beas', 'Sutlej (Panjnad)'],
    rightTributaries: ['Shyok', 'Gilgit', 'Kabul', 'Gomal'],
    dams: ['Nimoo Bazgo (Ladakh)'],
    examFacts: [
      'Indus Water Treaty was signed in 1960 between India and Pakistan with World Bank mediation.',
      'Enters India through Ladakh between Ladakh Range and Zanskar Range.'
    ],
    x: 32.2,
    y: 14.2
  },
  {
    id: 'brahmaputra',
    nameEn: 'Brahmaputra River',
    nameHi: 'ब्रह्मपुत्र नदी',
    originEn: 'Chemayungdung Glacier near Mansarovar, Tibet (known as Yarlung Tsangpo)',
    originHi: 'मानसरोवर के निकट चेमायुंगडुंग हिमनद, तिब्बत (त्सांगपो के नाम से)',
    outflowEn: 'Bay of Bengal (joins Padma and Meghna in Bangladesh)',
    outflowHi: 'बंगाल की खाड़ी (बांग्लादेश में पद्मा व मेघना से मिलकर)',
    lengthKm: 2900,
    states: ['Arunachal Pradesh (Siang/Dihang)', 'Assam'],
    leftTributaries: ['Dibang', 'Lohit', 'Dhansiri', 'Kolong'],
    rightTributaries: ['Subansiri (Largest)', 'Kameng', 'Manas', 'Sankosh', 'Teesta'],
    dams: ['Ranganadi Dam (Arunachal Pradesh)'],
    examFacts: [
      'Hosts Majuli, the world’s largest inhabited river island in Assam.',
      'Enters India near Namcha Barwa through a deep gorge as Dihang.'
    ],
    x: 79.2,
    y: 39.1
  },
  {
    id: 'godavari',
    nameEn: 'Godavari (Dakshin Ganga)',
    nameHi: 'गोदावरी (दक्षिण गंगा / वृद्ध गंगा)',
    originEn: 'Trimbakeshwar near Nashik, Western Ghats, Maharashtra',
    originHi: 'त्र्यंबकेश्वर, नासिक के निकट (पश्चिमी घाट), महाराष्ट्र',
    outflowEn: 'Bay of Bengal (near Yanam / Rajahmundry)',
    outflowHi: 'बंगाल की खाड़ी (राजमुंदरी के पास)',
    lengthKm: 1465,
    states: ['Maharashtra', 'Telangana', 'Andhra Pradesh', 'Chhattisgarh', 'Odisha'],
    leftTributaries: ['Purna', 'Penganga', 'Wainganga', 'Wardha (Pranhita)', 'Indravati', 'Sabari'],
    rightTributaries: ['Pravara', 'Manjira', 'Maner'],
    dams: ['Polavaram Project', 'Jayakwadi Dam (Maharashtra)', 'Sriram Sagar (Telangana)'],
    examFacts: [
      'Longest river of Peninsular India (hence called Dakshin Ganga or Vriddha Ganga).',
      'Second longest river in India after the Ganga.'
    ],
    x: 35.2,
    y: 60.9
  },
  {
    id: 'krishna',
    nameEn: 'Krishna River',
    nameHi: 'कृष्णा नदी',
    originEn: 'Mahabaleshwar, Western Ghats, Maharashtra',
    originHi: 'महाबलेश्वर, पश्चिमी घाट, महाराष्ट्र',
    outflowEn: 'Bay of Bengal (Hamsaladeevi, Andhra Pradesh)',
    outflowHi: 'बंगाल की खाड़ी (आंध्र प्रदेश)',
    lengthKm: 1400,
    states: ['Maharashtra', 'Karnataka', 'Telangana', 'Andhra Pradesh'],
    leftTributaries: ['Bhima (Largest)', 'Musi (Hyderabad is on its bank)', 'Munneru'],
    rightTributaries: ['Koyna', 'Panchganga', 'Dudhganga', 'Ghataprabha', 'Malaprabha', 'Tungabhadra'],
    dams: ['Nagarjuna Sagar Dam', 'Srisailam Dam', 'Almatti Dam (Lal Bahadur Shastri)'],
    examFacts: [
      'Second largest east-flowing peninsular river.',
      'Krishna-Godavari basin is rich in natural gas (KG-D6).'
    ],
    x: 33.4,
    y: 68.0
  },
  {
    id: 'kaveri',
    nameEn: 'Cauvery (Kaveri) River',
    nameHi: 'कावेरी नदी',
    originEn: 'Talakaveri, Brahmagiri Range, Kodagu, Karnataka',
    originHi: 'तालकावेरी, ब्रह्मगिरि पर्वत, कोडागू, कर्नाटक',
    outflowEn: 'Bay of Bengal (Poompuhar, Tamil Nadu)',
    outflowHi: 'बंगाल की खाड़ी (तमिलनाडु)',
    lengthKm: 800,
    states: ['Karnataka', 'Tamil Nadu', 'Kerala', 'Puducherry'],
    leftTributaries: ['Harangi', 'Hemavati', 'Shimsha', 'Arkavathi'],
    rightTributaries: ['Lakshmana Tirtha', 'Kabini', 'Suvarnavathi', 'Bhavani', 'Noyyal', 'Amaravati'],
    dams: ['Mettur Dam (Tamil Nadu)', 'Krishna Raja Sagara / KRS Dam (Karnataka)'],
    examFacts: [
      'Perennial river of South India because it gets rain from both South-West and North-East monsoons.',
      'Famous for Shivasamudram Waterfalls (second largest in India).'
    ],
    x: 36.4,
    y: 83.4
  },
  {
    id: 'narmada',
    nameEn: 'Narmada River',
    nameHi: 'नर्मदा नदी',
    originEn: 'Amarkantak Plateau, Anuppur, Madhya Pradesh',
    originHi: 'अमरकंटक पठार, अनूपपुर, मध्य प्रदेश',
    outflowEn: 'Gulf of Khambhat (Arabian Sea)',
    outflowHi: 'खंभात की खाड़ी (अरब सागर)',
    lengthKm: 1312,
    states: ['Madhya Pradesh', 'Maharashtra', 'Gujarat'],
    leftTributaries: ['Tawa (Longest)', 'Shakkar', 'Dudh', 'Ganjal'],
    rightTributaries: ['Hiran', 'Orsang', 'Barna', 'Kolar'],
    dams: ['Sardar Sarovar Dam (Gujarat)', 'Indira Sagar Dam (MP)', 'Omkareshwar Dam'],
    examFacts: [
      'Flows westwards in a Rift Valley between Vindhya and Satpura ranges.',
      'Forms the famous Dhuandhar Waterfalls and Marble Rocks at Bhedaghat (Jabalpur).'
    ],
    x: 34.3,
    y: 49.5
  },
  {
    id: 'tapti',
    nameEn: 'Tapti (Tapi) River',
    nameHi: 'ताप्ती नदी',
    originEn: 'Multai, Betul district, Satpura Range, Madhya Pradesh',
    originHi: 'मुलताई, बैतूल जिला, सतपुड़ा पर्वत, मध्य प्रदेश',
    outflowEn: 'Gulf of Khambhat (Arabian Sea near Surat)',
    outflowHi: 'खंभात की खाड़ी (सूरत के पास अरब सागर)',
    lengthKm: 724,
    states: ['Madhya Pradesh', 'Maharashtra', 'Gujarat'],
    leftTributaries: ['Purna', 'Girna', 'Bori', 'Panjhra'],
    rightTributaries: ['Vaki', 'Gomai', 'Arunavati'],
    dams: ['Ukai Dam (Vallabh Sagar)', 'Kakrapar Dam (Gujarat)'],
    examFacts: [
      'Known as the "Twin or Handmaid" of Narmada.',
      'Flows in a rift valley parallel to Narmada, south of Satpura range.'
    ],
    x: 29.2,
    y: 53.9
  },
  {
    id: 'mahanadi',
    nameEn: 'Mahanadi River',
    nameHi: 'महानदी',
    originEn: 'Sihawa foothills, Dhamtari, Dandakaranya, Chhattisgarh',
    originHi: 'सिहावा पर्वत, धमतरी, दंडकारण्य, छत्तीसगढ़',
    outflowEn: 'Bay of Bengal (near False Point, Odisha)',
    outflowHi: 'बंगाल की खाड़ी (ओडिशा)',
    lengthKm: 851,
    states: ['Chhattisgarh', 'Odisha'],
    leftTributaries: ['Seonath', 'Hasdeo', 'Mand', 'Ib'],
    rightTributaries: ['Ong', 'Tel', 'Jonk'],
    dams: ['Hirakud Dam (Longest major earthen dam in India - Odisha)'],
    examFacts: [
      'Historically known as the "Sorrow of Odisha" before the construction of Hirakud Dam.',
      'Its basin is known as the "Rice Bowl of Central India" (Chhattisgarh plain).'
    ],
    x: 52.2,
    y: 55.4
  }
];

export const MOUNTAINS_PEAKS_DATA = [
  {
    id: 'k2',
    nameEn: 'K2 (Godwin-Austen)',
    nameHi: 'K2 (गॉडविन ऑस्टिन)',
    elevationM: 8611,
    rangeEn: 'Karakoram Range, Trans-Himalayas',
    rangeHi: 'काराकोरम पर्वतमाला, ट्रांस-हिमालय',
    stateEn: 'Ladakh (POK - Gilgit-Baltistan)',
    stateHi: 'लद्दाख (पीओके)',
    examFacts: [
      'Second highest mountain in the world after Mount Everest (8848.86 m).',
      'Highest point of Indian territory claim.'
    ],
    x: 31.3,
    y: 8.6
  },
  {
    id: 'kanchenjunga',
    nameEn: 'Kanchenjunga',
    nameHi: 'कंचनजंगा',
    elevationM: 8586,
    rangeEn: 'Eastern Himalayas',
    rangeHi: 'पूर्वी हिमालय',
    stateEn: 'Sikkim (India-Nepal border)',
    stateHi: 'सिक्किम (भारत-नेपाल सीमा)',
    examFacts: [
      'Highest mountain peak located within undisputed Indian territory.',
      'Third highest mountain in the world.',
      'Hosts Khangchendzonga National Park (India’s only UNESCO Mixed World Heritage site).'
    ],
    x: 66.2,
    y: 34.8
  },
  {
    id: 'nanda-devi',
    nameEn: 'Nanda Devi',
    nameHi: 'नंदा देवी',
    elevationM: 7816,
    rangeEn: 'Garhwal Himalayas',
    rangeHi: 'गढ़वाल हिमालय',
    stateEn: 'Chamoli, Uttarakhand',
    stateHi: 'चमोली, उत्तराखंड',
    examFacts: [
      'Highest peak located entirely within India without border disputes.',
      'Surrounded by Nanda Devi Biosphere Reserve and Valley of Flowers.'
    ],
    x: 41.7,
    y: 26.5
  },
  {
    id: 'anamudi',
    nameEn: 'Anamudi Peak',
    nameHi: 'अनाईमुडी चोटी',
    elevationM: 2695,
    rangeEn: 'Annamalai Hills, Western Ghats',
    rangeHi: 'अन्नामलाई पहाड़ियाँ, पश्चिमी घाट',
    stateEn: 'Idukki, Kerala',
    stateHi: 'इदुक्की, केरल',
    examFacts: [
      'Highest mountain peak in South India and the Western Ghats (called "Everest of South India").',
      'Located inside Eravikulam National Park (home to Nilgiri Tahr).'
    ],
    x: 33.0,
    y: 85.4
  },
  {
    id: 'doddabetta',
    nameEn: 'Doddabetta',
    nameHi: 'दोद्दाबेट्टा',
    elevationM: 2637,
    rangeEn: 'Nilgiri Hills, Western Ghats',
    rangeHi: 'नीलगिरि पहाड़ियाँ, पश्चिमी घाट',
    stateEn: 'Nilgiris, Tamil Nadu',
    stateHi: 'नीलगिरि, तमिलनाडु',
    examFacts: [
      'Highest peak of the Nilgiri Hills.',
      'Second highest peak in South India after Anamudi.'
    ],
    x: 32.0,
    y: 82.0
  },
  {
    id: 'guru-shikhar',
    nameEn: 'Guru Shikhar',
    nameHi: 'गुरु शिखर',
    elevationM: 1722,
    rangeEn: 'Aravalli Range',
    rangeHi: 'अरावली पर्वतमाला',
    stateEn: 'Mount Abu, Sirohi, Rajasthan',
    stateHi: 'माउंट आबू, सिरोही, राजस्थान',
    examFacts: [
      'Highest peak of the ancient Aravalli Range (one of the oldest fold mountains in the world).',
      'Located 15 km from Mount Abu hill station.'
    ],
    x: 20.2,
    y: 44.0
  },
  {
    id: 'dhupgarh',
    nameEn: 'Mount Dhupgarh',
    nameHi: 'धूपगढ़',
    elevationM: 1352,
    rangeEn: 'Satpura Range (Mahadeo Hills)',
    rangeHi: 'सतपुड़ा पर्वतमाला (महादेव पहाड़ियाँ)',
    stateEn: 'Pachmarhi, Madhya Pradesh',
    stateHi: 'पचमढ़ी, मध्य प्रदेश',
    examFacts: [
      'Highest point of the Satpura Range and Madhya Pradesh.',
      'Located in Pachmarhi hill station (Queen of Satpura).'
    ],
    x: 36.9,
    y: 50.6
  },
  {
    id: 'sadbhawna-shikhar',
    nameEn: 'Kalumar Peak (Sadbhawna Shikhar)',
    nameHi: 'सद्भावना शिखर (कालुमार चोटी)',
    elevationM: 752,
    rangeEn: 'Vindhya Range (Bhander plateau)',
    rangeHi: 'विंध्याचल पर्वतमाला (भांडेर पठार)',
    stateEn: 'Damoh, Madhya Pradesh',
    stateHi: 'दमोह, मध्य प्रदेश',
    examFacts: [
      'Highest peak of the Vindhya Range.',
      'Vindhyas act as the traditional geographical divide between Northern and Southern India.'
    ],
    x: 41.0,
    y: 47.3
  },
  {
    id: 'aroma-konda',
    nameEn: 'Arma Konda (Jindhagada Peak)',
    nameHi: 'जिंधागड़ा चोटी / अरमा कोंडा',
    elevationM: 1680,
    rangeEn: 'Eastern Ghats',
    rangeHi: 'पूर्वी घाट',
    stateEn: 'Araku Valley, Andhra Pradesh',
    stateHi: 'अराकू घाटी, आंध्र प्रदेश',
    examFacts: [
      'Highest mountain peak of the Eastern Ghats.',
      'Eastern Ghats are discontinuous and dissected by major east-flowing rivers.'
    ],
    x: 49.9,
    y: 62.8
  }
];

export const MOUNTAIN_PASSES_DATA = [
  {
    id: 'zoji-la',
    nameEn: 'Zoji La Pass',
    nameHi: 'जोजिला दर्रा',
    elevationM: 3528,
    stateEn: 'Ladakh / Jammu & Kashmir',
    stateHi: 'लद्दाख / जम्मू व कश्मीर',
    connectsEn: 'Connects Srinagar with Kargil and Leh (NH-1)',
    connectsHi: 'श्रीनगर को कारगिल व लेह से जोड़ता है (NH-1)',
    examFacts: [
      'Strategic Himalayan pass connecting Kashmir Valley with Ladakh.',
      'Zojila Tunnel (14.2 km) is under construction to provide all-weather connectivity.'
    ],
    x: 28.3,
    y: 13.9
  },
  {
    id: 'banihal-pass',
    nameEn: 'Banihal Pass (Jawahar Tunnel)',
    nameHi: 'बनिहाल दर्रा (जवाहर सुरंग)',
    elevationM: 2832,
    stateEn: 'Jammu & Kashmir (Pir Panjal Range)',
    stateHi: 'जम्मू व कश्मीर (पीर पंजाल पर्वत)',
    connectsEn: 'Connects Jammu with Srinagar',
    connectsHi: 'जम्मू को श्रीनगर से जोड़ता है',
    examFacts: [
      'Jawahar Tunnel under this pass was built in 1956.',
      'Recently supplemented by the Banihal Qazigund Road Tunnel.'
    ],
    x: 27.4,
    y: 16.5
  },
  {
    id: 'rohtang-pass',
    nameEn: 'Rohtang Pass (Atal Tunnel)',
    nameHi: 'रोहतांग दर्रा (अटल टनल)',
    elevationM: 3978,
    stateEn: 'Himachal Pradesh (Pir Panjal Range)',
    stateHi: 'हिमाचल प्रदेश',
    connectsEn: 'Connects Kullu Valley with Lahaul and Spiti Valleys',
    connectsHi: 'कुल्लू घाटी को लाहौल व स्पीति घाटी से जोड़ता है',
    examFacts: [
      'Atal Tunnel (9.02 km) under Rohtang Pass is the longest highway single-tube tunnel above 10,000 ft.',
      'Source of the Beas River (Beas Kund is near Rohtang).'
    ],
    x: 33.5,
    y: 20.1
  },
  {
    id: 'shipki-la',
    nameEn: 'Shipki La Pass',
    nameHi: 'शिपकी ला दर्रा',
    elevationM: 3930,
    stateEn: 'Kinnaur, Himachal Pradesh (Indo-China border)',
    stateHi: 'किन्नौर, हिमाचल प्रदेश (भारत-चीन सीमा)',
    connectsEn: 'Connects Himachal Pradesh with Tibet',
    connectsHi: 'हिमाचल प्रदेश को तिब्बत से जोड़ता है',
    examFacts: [
      'River Sutlej enters India through this pass from Tibet.',
      'One of India’s designated border trade posts with China.'
    ],
    x: 38.0,
    y: 21.9
  },
  {
    id: 'nathu-la',
    nameEn: 'Nathu La Pass',
    nameHi: 'नाथू ला दर्रा',
    elevationM: 4310,
    stateEn: 'East Sikkim (Indo-China border)',
    stateHi: 'पूर्वी सिक्किम (भारत-चीन सीमा)',
    connectsEn: 'Connects Sikkim with Tibet Autonomous Region (Chumbi Valley)',
    connectsHi: 'सिक्किम को तिब्बत (चुंबी घाटी) से जोड़ता है',
    examFacts: [
      'Part of the historic ancient Silk Route.',
      'One of the three open trading border posts between China and India (reopened in 2006).'
    ],
    x: 68.2,
    y: 35.8
  },
  {
    id: 'lipulekh',
    nameEn: 'Lipulekh Pass',
    nameHi: 'लिपुलेख दर्रा',
    elevationM: 5200,
    stateEn: 'Pithoragarh, Uttarakhand (Tri-junction of India-Nepal-China)',
    stateHi: 'पिथौरागढ़, उत्तराखंड (भारत-नेपाल-चीन ट्राइजंक्शन)',
    connectsEn: 'Connects Kumaon with Tibet (Kailash-Mansarovar Yatra route)',
    connectsHi: 'कुमाऊँ को तिब्बत (कैलाश-मानसरोवर मार्ग) से जोड़ता है',
    examFacts: [
      'Primary route for Kailash Mansarovar Pilgrimage.',
      'Subject of recent boundary discussions between India and Nepal.'
    ],
    x: 44.9,
    y: 27.0
  },
  {
    id: 'thal-ghat',
    nameEn: 'Thal Ghat (Kasara Ghat)',
    nameHi: 'थाल घाट (कसारा घाट)',
    elevationM: 585,
    stateEn: 'Maharashtra (Western Ghats / Sahyadri)',
    stateHi: 'महाराष्ट्र (पश्चिमी घाट)',
    connectsEn: 'Connects Mumbai with Nashik and Kolkata (NH-3)',
    connectsHi: 'मुंबई को नासिक व कोलकाता से जोड़ता है',
    examFacts: [
      'Key road and railway link carrying the Central Railway between Mumbai and North/East India.'
    ],
    x: 22.4,
    y: 58.6
  },
  {
    id: 'bhor-ghat',
    nameEn: 'Bhor Ghat',
    nameHi: 'भोर घाट',
    elevationM: 610,
    stateEn: 'Maharashtra (Western Ghats)',
    stateHi: 'महाराष्ट्र (पश्चिमी घाट)',
    connectsEn: 'Connects Mumbai with Pune and Chennai (NH-4 / Mumbai-Pune Expressway)',
    connectsHi: 'मुंबई को पुणे व चेन्नई से जोड़ता है',
    examFacts: [
      'Historic mountain passage connecting the Konkan coast to the Deccan Plateau.'
    ],
    x: 21.9,
    y: 61.3
  },
  {
    id: 'pal-ghat',
    nameEn: 'Palakkad Gap (Pal Ghat)',
    nameHi: 'पालक्काड़ दर्रा (पाल घाट)',
    elevationM: 140,
    stateEn: 'Kerala / Tamil Nadu',
    stateHi: 'केरल / तमिलनाडु',
    connectsEn: 'Connects Palakkad (Kerala) with Coimbatore (Tamil Nadu)',
    connectsHi: 'पालक्काड़ (केरल) को कोयंबटूर (तमिलनाडु) से जोड़ता है',
    examFacts: [
      'Major natural depression gap in the Western Ghats between Nilgiri Hills (north) and Annamalai Hills (south).',
      'Facilitates monsoon winds to penetrate into western Tamil Nadu.'
    ],
    x: 31.7,
    y: 83.7
  }
];

export const NATIONAL_PARKS_DATA = [
  {
    id: 'jim-corbett',
    nameEn: 'Jim Corbett National Park',
    nameHi: 'जिम कॉर्बेट राष्ट्रीय उद्यान',
    stateEn: 'Nainital & Pauri Garhwal, Uttarakhand',
    stateHi: 'उत्तराखंड',
    established: 1936,
    keySpeciesEn: 'Bengal Tiger, Asian Elephant, Spotted Deer',
    keySpeciesHi: 'बंगाल टाइगर, एशियाई हाथी, चीतल',
    examFacts: [
      'Oldest National Park in India (originally named Hailey National Park in 1936).',
      'First national park to come under Project Tiger initiative in 1973.',
      'Ramganga river flows through this park.'
    ],
    x: 38.1,
    y: 29.1
  },
  {
    id: 'kaziranga',
    nameEn: 'Kaziranga National Park',
    nameHi: 'काजीरंगा राष्ट्रीय उद्यान',
    stateEn: 'Golaghat & Nagaon, Assam',
    stateHi: 'असम',
    established: 1974,
    keySpeciesEn: 'Great Indian One-Horned Rhinoceros, Tiger, Wild Water Buffalo',
    keySpeciesHi: 'एक सींग वाला गैंडा (One-Horned Rhino), जंगली भैंसा',
    examFacts: [
      'UNESCO World Heritage Site since 1985.',
      'Hosts roughly two-thirds of the world’s great one-horned rhinoceros population.',
      'Bordered by the Brahmaputra River to the north.'
    ],
    x: 81.2,
    y: 38.2
  },
  {
    id: 'gir',
    nameEn: 'Gir National Park',
    nameHi: 'गिर राष्ट्रीय उद्यान',
    stateEn: 'Junagadh & Amreli, Gujarat',
    stateHi: 'गुजरात',
    established: 1965,
    keySpeciesEn: 'Asiatic Lion (Only wild habitat in the world)',
    keySpeciesHi: 'एशियाई शेर (Asiatic Lion)',
    examFacts: [
      'The only natural refuge of the Asiatic Lion (Panthera leo persica) globally.'
    ],
    x: 14.2,
    y: 54.5
  },
  {
    id: 'sundarbans',
    nameEn: 'Sundarbans National Park',
    nameHi: 'सुंदरबन राष्ट्रीय उद्यान',
    stateEn: 'South 24 Parganas, West Bengal',
    stateHi: 'पश्चिम बंगाल',
    established: 1984,
    keySpeciesEn: 'Royal Bengal Tiger, Saltwater Crocodile, Gangetic Dolphin',
    keySpeciesHi: 'रॉयल बंगाल टाइगर, खारे पानी का मगरमच्छ, सुंदरी वृक्ष',
    examFacts: [
      'Largest mangrove forest in the world.',
      'UNESCO World Heritage site and Ramsar Wetland site.',
      'Named after the abundant Sundari mangrove trees (Heritiera fomes).'
    ],
    x: 68.3,
    y: 52.0
  },
  {
    id: 'kanha',
    nameEn: 'Kanha Tiger Reserve',
    nameHi: 'कान्हा राष्ट्रीय उद्यान',
    stateEn: 'Mandla & Balaghat, Madhya Pradesh',
    stateHi: 'मध्य प्रदेश',
    established: 1955,
    keySpeciesEn: 'Barasingha (Hardground Swamp Deer - State animal of MP), Tiger',
    keySpeciesHi: 'बारहसिंगा (दलदली हिरण), बाघ',
    examFacts: [
      'Inspiration for Rudyard Kipling’s "The Jungle Book".',
      'First tiger reserve in India to officially introduce a mascot ("Bhoorsingh the Barasingha").'
    ],
    x: 43.6,
    y: 50.9
  },
  {
    id: 'bandipur',
    nameEn: 'Bandipur National Park',
    nameHi: 'बांदीपुर राष्ट्रीय उद्यान',
    stateEn: 'Chamarajanagar, Karnataka',
    stateHi: 'कर्नाटक',
    established: 1974,
    keySpeciesEn: 'Indian Elephant, Tiger, Gaur (Indian Bison)',
    keySpeciesHi: 'भारतीय हाथी, बाघ, गौर',
    examFacts: [
      'Forms part of the Nilgiri Biosphere Reserve along with Nagarhole, Wayanad, and Mudumalai.'
    ],
    x: 31.7,
    y: 81.3
  },
  {
    id: 'keoladeo',
    nameEn: 'Keoladeo Ghana National Park (Bharatpur)',
    nameHi: 'केवलादेव घाना राष्ट्रीय उद्यान (भरतपुर)',
    stateEn: 'Bharatpur, Rajasthan',
    stateHi: 'राजस्थान',
    established: 1981,
    keySpeciesEn: 'Siberian Crane (Migratory), Waterfowl, Heronries',
    keySpeciesHi: 'साइबेरियन क्रेन, प्रवासी पक्षी',
    examFacts: [
      'Formerly known as the Bharatpur Bird Sanctuary.',
      'Declared UNESCO World Heritage Site and Montreux Record Ramsar site.'
    ],
    x: 34.3,
    y: 36.5
  },
  {
    id: 'hemis',
    nameEn: 'Hemis National Park',
    nameHi: 'हेमिस राष्ट्रीय उद्यान',
    stateEn: 'Leh district, Ladakh',
    stateHi: 'लद्दाख',
    established: 1981,
    keySpeciesEn: 'Snow Leopard (Highest density in the world), Tibetan Wolf',
    keySpeciesHi: 'हिम तेंदुआ (Snow Leopard)',
    examFacts: [
      'Largest national park in India by area (~4,400 sq km).',
      'Only national park in India north of the Himalayas.'
    ],
    x: 34.6,
    y: 15.1
  }
];

export const LAKES_WATERFALLS_DATA = [
  {
    id: 'chilika-lake',
    nameEn: 'Chilika Lake',
    nameHi: 'चिल्का झील',
    stateEn: 'Puri, Khordha & Ganjam, Odisha',
    stateHi: 'ओडिशा',
    typeEn: 'Brackish Water Lagoon (Ramsar Site)',
    typeHi: 'खारे पानी की लैगून झील (रामसर स्थल)',
    examFacts: [
      'Largest brackish water lagoon in India and Asia.',
      'First Indian wetland of international importance designated under the Ramsar Convention (1981).',
      'Major wintering ground for migratory birds and home to the endangered Irrawaddy dolphin.'
    ],
    x: 57.8,
    y: 58.5
  },
  {
    id: 'wular-lake',
    nameEn: 'Wular Lake',
    nameHi: 'वुलर झील',
    stateEn: 'Bandipora, Jammu & Kashmir',
    stateHi: 'जम्मू व कश्मीर',
    typeEn: 'Freshwater Tectonic Lake',
    typeHi: 'मीठे पानी की टेक्टॉनिक झील',
    examFacts: [
      'Largest freshwater lake in India.',
      'Fed by the Jhelum River; formed due to tectonic activity.'
    ],
    x: 25.5,
    y: 13.7
  },
  {
    id: 'loktak-lake',
    nameEn: 'Loktak Lake',
    nameHi: 'लोकटक झील',
    stateEn: 'Moirang, Bishnupur, Manipur',
    stateHi: 'मणिपुर',
    typeEn: 'Freshwater Lake with Floating Phumdis',
    typeHi: 'तैरते हुए फुमदी (Phumdis) युक्त मीठे पानी की झील',
    examFacts: [
      'Hosts Keibul Lamjao National Park - the only floating national park in the world.',
      'Last natural refuge of the endangered Sangai (dancing deer of Manipur).'
    ],
    x: 83.1,
    y: 44.3
  },
  {
    id: 'vembanaad-lake',
    nameEn: 'Vembanad Lake',
    nameHi: 'वेम्बनाड झील',
    stateEn: 'Kottayam & Alappuzha, Kerala',
    stateHi: 'केरल',
    typeEn: 'Brackish Wetland Lagoon',
    typeHi: 'कयाल (लैगून) आर्द्रभूमि',
    examFacts: [
      'Longest lake in India (~96.5 km).',
      'Famous for the Nehru Trophy Boat Race (Vallam Kali) at Punnamada.'
    ],
    x: 31.0,
    y: 87.0
  },
  {
    id: 'sambhar-lake',
    nameEn: 'Sambhar Salt Lake',
    nameHi: 'सांभर झील',
    stateEn: 'Jaipur & Nagaur, Rajasthan',
    stateHi: 'राजस्थान',
    typeEn: 'Inland Salt Lake',
    typeHi: 'अंतःस्थलीय खारे पानी की झील',
    examFacts: [
      'India’s largest inland saline lake.',
      'Produces a significant percentage of India’s total salt production.'
    ],
    x: 27.0,
    y: 37.3
  },
  {
    id: 'lonar-lake',
    nameEn: 'Lonar Crater Lake',
    nameHi: 'लोनार झील',
    stateEn: 'Buldhana, Maharashtra',
    stateHi: 'महाराष्ट्र',
    typeEn: 'Meteorite Impact Crater (Saline & Alkaline)',
    typeHi: 'उल्कापिंड टकराव क्रेटर झील',
    examFacts: [
      'Created by a meteorite impact during the Pleistocene Epoch in basaltic rock.',
      'Declared a Ramsar wetland site in 2020.'
    ],
    x: 31.3,
    y: 57.8
  },
  {
    id: 'dhuandhar-falls',
    nameEn: 'Dhuandhar Falls (Marble Rocks)',
    nameHi: 'धुआंधार जलप्रपात',
    stateEn: 'Bhedaghat, Jabalpur, Madhya Pradesh',
    stateHi: 'जबलपुर, मध्य प्रदेश',
    typeEn: 'Narmada River Waterfall',
    typeHi: 'नर्मदा नदी का जलप्रपात',
    examFacts: [
      'Formed by River Narmada cutting through world-famous white marble rocks.',
      'The mist created looks like smoke, hence named "Dhuandhar" (Smoke cascade).'
    ],
    x: 41.2,
    y: 48.6
  },
  {
    id: 'jog-falls',
    nameEn: 'Jog Falls (Gerosoppa)',
    nameHi: 'जोग / गरसोप्पा जलप्रपात',
    stateEn: 'Shimoga, Karnataka',
    stateHi: 'कर्नाटक',
    typeEn: 'Sharavathi River Waterfall (253 m)',
    typeHi: 'शरावती नदी पर जलप्रपात',
    examFacts: [
      'Created by the Sharavathi River dropping 253 m without touching the rockface.',
      'Consists of four distinct cascades: Raja, Roarer, Rocket, and Rani.'
    ],
    x: 26.2,
    y: 74.1
  }
];

export const TROPIC_MERIDIAN_DATA = [
  {
    id: 'tropic-of-cancer',
    nameEn: 'Tropic of Cancer (23.5° N Latitude)',
    nameHi: 'कर्क रेखा (23.5° N अक्षांश)',
    descriptionEn: 'Passes through 8 Indian States from West to East:',
    descriptionHi: 'पश्चिम से पूर्व भारत के 8 राज्यों से होकर गुजरती है:',
    states: [
      { en: 'Gujarat', hi: 'गुजरात' },
      { en: 'Rajasthan (Banswara & Dungarpur)', hi: 'राजस्थान (बांसवाड़ा व डूंगरपुर)' },
      { en: 'Madhya Pradesh (Longest stretch)', hi: 'मध्य प्रदेश (सर्वाधिक लम्बाई)' },
      { en: 'Chhattisgarh', hi: 'छत्तीसगढ़' },
      { en: 'Jharkhand (Ranchi is closest city)', hi: 'झारखंड (राँची निकटतम राजधानी)' },
      { en: 'West Bengal', hi: 'पश्चिम बंगाल' },
      { en: 'Tripura (Udaipur)', hi: 'त्रिपुरा' },
      { en: 'Mizoram (Champhai)', hi: 'मिजोरम' }
    ],
    mnemonicEn: 'Mnemonic: Mi-Tra Par Gam-Chha Jhar (Mizoram, Tripura, W.Bengal, Rajasthan, Gujarat, MP, Chhattisgarh, Jharkhand)',
    mnemonicHi: 'याद रखने की ट्रिक: "मित्र पर गमछा झार" (मि-मिजोरम, त्र-त्रिपुरा, प-प.बंगाल, र-राजस्थान, ग-गुजरात, म-म.प्र., छा-छत्तीसगढ़, झार-झारखंड)',
    examFacts: [
      'Mahi River is the ONLY river in India that cuts the Tropic of Cancer twice (in MP and Gujarat).',
      'Ranchi is the only state capital located almost exactly on the Tropic of Cancer.',
      'Divides India into roughly two equal climatic halves (Subtropical in North, Tropical in South).'
    ],
    x: 49.3,
    y: 47.5
  },
  {
    id: 'indian-standard-meridian',
    nameEn: 'Indian Standard Time (82.5° E Longitude)',
    nameHi: 'भारतीय मानक समय रेखा (82.5° E देशान्तर)',
    descriptionEn: 'Standard meridian of India passing through 5 states (UTC +5:30):',
    descriptionHi: 'भारत की मानक याम्योत्तर रेखा, जो 5 राज्यों से गुजरती है (UTC +5:30):',
    states: [
      { en: 'Uttar Pradesh (Mirzapur / Shankargarh, Prayagraj)', hi: 'उत्तर प्रदेश (मिर्जापुर / शंकरगढ़, प्रयागराज)' },
      { en: 'Madhya Pradesh', hi: 'मध्य प्रदेश' },
      { en: 'Chhattisgarh', hi: 'छत्तीसगढ़' },
      { en: 'Odisha', hi: 'ओडिशा' },
      { en: 'Andhra Pradesh', hi: 'आंध्र प्रदेश' }
    ],
    mnemonicEn: 'Mnemonic: "UP-MP-CH-OD-AP" (North to South sequence)',
    mnemonicHi: 'क्रम (उत्तर से दक्षिण): उत्तर प्रदेश ➔ मध्य प्रदेश ➔ छत्तीसगढ़ ➔ ओडिशा ➔ आंध्र प्रदेश',
    examFacts: [
      'The Tropic of Cancer (23.5° N) and IST Meridian (82.5° E) intersect in Koriya district, Chhattisgarh.',
      'IST is exactly 5 hours and 30 minutes ahead of Greenwich Mean Time (GMT).',
      'Time difference between extreme east (Dong, Arunachal Pradesh) and extreme west (Ghuar Mota, Gujarat) is roughly 2 hours (30° of longitude).'
    ],
    x: 49.3,
    y: 47.5
  }
];

export const MAP_QUIZ_QUESTIONS = [
  {
    id: 'q1',
    questionEn: 'Which is the only river in India that cuts the Tropic of Cancer twice?',
    questionHi: 'भारत की एकमात्र ऐसी कौन सी नदी है जो कर्क रेखा को दो बार काटती है?',
    optionsEn: ['Narmada River', 'Mahi River', 'Chambal River', 'Sabarmati River'],
    optionsHi: ['नर्मदा नदी', 'माही नदी', 'चंबल नदी', 'साबरमती नदी'],
    correctIndex: 1,
    explanationEn: 'Mahi River rises in Madhya Pradesh, crosses into Rajasthan and then enters Gujarat, cutting the Tropic of Cancer twice.',
    explanationHi: 'माही नदी मध्य प्रदेश के धार जिले से निकलकर राजस्थान और फिर गुजरात में बहते हुए कर्क रेखा को दो बार पार करती है।'
  },
  {
    id: 'q2',
    questionEn: 'Which mountain peak is the highest in South India?',
    questionHi: 'दक्षिण भारत की सबसे ऊंची पर्वत चोटी कौन सी है?',
    optionsEn: ['Doddabetta', 'Anamudi', 'Guru Shikhar', 'Kalsubai'],
    optionsHi: ['दोद्दाबेट्टा', 'अनाईमुडी', 'गुरु शिखर', 'कलसूबाई'],
    correctIndex: 1,
    explanationEn: 'Anamudi (2,695 m) in the Annamalai Hills (Kerala) is the highest peak in South India and the Western Ghats.',
    explanationHi: 'अनाईमुडी (2695 मी) केरल के इदुक्की जिले में अन्नामलाई पर्वत पर स्थित दक्षिण भारत व पश्चिमी घाट की सर्वोच्च चोटी है।'
  },
  {
    id: 'q3',
    questionEn: 'Through which mountain pass does the historic Atal Tunnel pass?',
    questionHi: 'प्रसिद्ध अटल सुरंग (Atal Tunnel) किस हिमालयी दर्रे के नीचे स्थित है?',
    optionsEn: ['Zoji La Pass', 'Rohtang Pass', 'Shipki La Pass', 'Nathu La Pass'],
    optionsHi: ['जोजिला दर्रा', 'रोहतांग दर्रा', 'शिपकी ला दर्रा', 'नाथू ला दर्रा'],
    correctIndex: 1,
    explanationEn: 'Atal Tunnel (9.02 km) is built under the Rohtang Pass on the Leh-Manali Highway in Himachal Pradesh.',
    explanationHi: 'अटल सुरंग (9.02 किमी) हिमाचल प्रदेश में पीर पंजाल पर्वत श्रेणी के रोहतांग दर्रे के नीचे बनाई गई है।'
  },
  {
    id: 'q4',
    questionEn: 'Where do the Tropic of Cancer (23.5° N) and IST Meridian (82.5° E) intersect in India?',
    questionHi: 'भारत में कर्क रेखा और 82.5° E भारतीय मानक समय रेखा एक-दूसरे को कहाँ काटती हैं?',
    optionsEn: ['Jabalpur (MP)', 'Koriya (Chhattisgarh)', 'Ranchi (Jharkhand)', 'Mirzapur (UP)'],
    optionsHi: ['जबलपुर (मध्य प्रदेश)', 'कोरिया (छत्तीसगढ़)', 'राँची (झारखंड)', 'मिर्जापुर (उत्तर प्रदेश)'],
    correctIndex: 1,
    explanationEn: 'The intersection point of 23.5° N (Tropic of Cancer) and 82.5° E (IST meridian) lies in Koriya district, Chhattisgarh.',
    explanationHi: 'कर्क रेखा और भारतीय मानक समय रेखा (82.5° E) का मिलन बिंदु छत्तीसगढ़ के कोरिया / सूरजपुर जिले में है।'
  },
  {
    id: 'q5',
    questionEn: 'Which is the world’s only floating national park?',
    questionHi: 'विश्व का एकमात्र तैरता हुआ राष्ट्रीय उद्यान कौन सा है?',
    optionsEn: ['Sundarbans', 'Keibul Lamjao (Loktak)', 'Kaziranga', 'Hemis'],
    optionsHi: ['सुंदरबन', 'केइबुल लामजाओ (लोकटक)', 'काजीरंगा', 'हेमिस'],
    correctIndex: 1,
    explanationEn: 'Keibul Lamjao National Park on Loktak Lake in Manipur is the world’s only floating sanctuary, home to the dancing deer (Sangai).',
    explanationHi: 'मणिपुर की लोकटक झील पर स्थित केइबुल लामजाओ विश्व का एकमात्र तैरता हुआ नेशनल पार्क है, जो संगाई हिरण का घर है।'
  }
];
