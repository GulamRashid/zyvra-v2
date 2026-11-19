/**
 * Comprehensive, exam-oriented Indian Geography dataset
 * Includes Rivers, Mountains & Peaks, Mountain Passes, and National Parks
 * Position coordinates (x, y) represent percentage [0-100] on the standard India map viewBox.
 */

export const GEO_CATEGORIES = [
  { id: 'rivers', labelEn: 'Rivers & Dams', labelHi: 'नदियाँ व प्रमुख बांध', icon: 'Waves' },
  { id: 'mountains', labelEn: 'Peaks & Ranges', labelHi: 'पर्वत व चोटियाँ', icon: 'Mountain' },
  { id: 'passes', labelEn: 'Mountain Passes', labelHi: 'महत्वपूर्ण दर्रे', icon: 'Compass' },
  { id: 'parks', labelEn: 'National Parks', labelHi: 'राष्ट्रीय उद्यान', icon: 'Trees' }
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
    x: 48,
    y: 35
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
    x: 42,
    y: 38
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
    x: 28,
    y: 18
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
    x: 82,
    y: 32
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
    x: 44,
    y: 62
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
    x: 43,
    y: 70
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
    x: 41,
    y: 82
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
    x: 35,
    y: 52
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
    x: 36,
    y: 55
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
    x: 58,
    y: 56
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
    x: 29,
    y: 12
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
    x: 69,
    y: 35
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
    x: 43,
    y: 28
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
    x: 39,
    y: 86
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
    x: 41,
    y: 84
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
    x: 30,
    y: 45
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
    x: 43,
    y: 53
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
    x: 46,
    y: 49
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
    x: 54,
    y: 65
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
    x: 31,
    y: 19
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
    x: 30,
    y: 22
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
    x: 35,
    y: 24
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
    x: 38,
    y: 26
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
    x: 70,
    y: 35
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
    x: 45,
    y: 30
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
    x: 34,
    y: 61
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
    x: 35,
    y: 64
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
    x: 40,
    y: 84
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
    x: 42,
    y: 31
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
    x: 84,
    y: 36
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
    x: 24,
    y: 53
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
    x: 68,
    y: 49
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
    x: 48,
    y: 52
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
    x: 40,
    y: 81
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
    x: 39,
    y: 40
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
    x: 33,
    y: 15
  }
];
