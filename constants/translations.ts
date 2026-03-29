export type Language = 'en' | 'sw' | 'rw' | 'am';

export type TranslationKey =
  // Welcome screen
  | 'appTagline'
  | 'countryLabel'
  | 'languageLabel'
  | 'selectCountry'
  | 'selectLanguage'
  | 'iAmA'
  | 'iGiveRidesShort'
  | 'iNeedRidesShort'
  | 'selectCountryTitle'
  | 'selectLanguageTitle'
  // Auth / registration screen
  | 'createAccount'
  | 'fullName'
  | 'phoneNumber'
  | 'emailAddress'
  | 'confirmEmail'
  | 'vehicleDetails'
  | 'driver'
  | 'rider'
  | 'passenger'
  | 'iGiveRides'
  | 'iNeedRides'
  | 'continueBtn'
  | 'registerBtn'
  | 'fullNamePlaceholder'
  | 'phonePlaceholder'
  | 'vehicleMake'
  | 'vehicleModel'
  | 'licensePlate'
  | 'nationalId'
  | 'password'
  | 'emailsDoNotMatch'
  // Main app
  | 'requestARide'
  | 'confirmRequest'
  | 'accept'
  | 'reject'
  | 'bargain'
  | 'rides'
  | 'profile'
  | 'requests'
  | 'signOut'
  | 'waitingForDriver'
  | 'noRideRequests'
  | 'driverOnTheWay'
  | 'requestCancelled'
  | 'pickup'
  | 'destination'
  | 'priceOffer'
  | 'muted'
  | 'available'
  | 'dashboard'
  | 'earnings'
  | 'ridesCount'
  | 'kmDriven'
  | 'memberSince';

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en: {
    appTagline: 'Your ride, your price',
    countryLabel: 'Country',
    languageLabel: 'Language',
    selectCountry: 'Select country',
    selectLanguage: 'Select language',
    iAmA: 'I am a...',
    iGiveRidesShort: 'I give rides',
    iNeedRidesShort: 'I need rides',
    selectCountryTitle: 'Select Country',
    selectLanguageTitle: 'Select Language',
    createAccount: 'Create your account',
    fullName: 'Full Name',
    phoneNumber: 'Phone Number',
    emailAddress: 'Email address',
    confirmEmail: 'Confirm email address',
    vehicleDetails: 'Vehicle Details',
    driver: 'Driver/Rider',
    rider: 'Passenger',
    passenger: 'Passenger',
    iGiveRides: 'I give rides',
    iNeedRides: 'I need rides',
    continueBtn: 'Continue',
    registerBtn: 'Create Account',
    fullNamePlaceholder: 'e.g. Amara Osei',
    phonePlaceholder: 'e.g. +254 712 345 678',
    vehicleMake: 'Vehicle Make',
    vehicleModel: 'Vehicle Model',
    licensePlate: 'License Plate Number',
    nationalId: "National ID / Driver's License Number",
    password: 'Password',
    emailsDoNotMatch: 'Emails do not match',
    requestARide: 'Request a Ride',
    confirmRequest: 'Confirm Request',
    accept: 'Accept',
    reject: 'Reject',
    bargain: 'Bargain',
    rides: 'Rides',
    profile: 'Profile',
    requests: 'Requests',
    signOut: 'Sign Out',
    waitingForDriver: 'Waiting for a driver/rider...',
    noRideRequests: 'No ride requests nearby',
    driverOnTheWay: 'Driver/Rider is on the way!',
    requestCancelled: 'Request cancelled. Please try again.',
    pickup: 'Pickup Location',
    destination: 'Destination',
    priceOffer: 'Price Offer',
    muted: 'Muted',
    available: 'Available',
    dashboard: 'Dashboard',
    earnings: 'Total Earnings',
    ridesCount: 'Number of Rides',
    kmDriven: 'Kilometers Driven',
    memberSince: 'Member Since',
  },
  sw: {
    appTagline: 'Safari yako, bei yako',
    countryLabel: 'Nchi',
    languageLabel: 'Lugha',
    selectCountry: 'Chagua nchi',
    selectLanguage: 'Chagua lugha',
    iAmA: 'Mimi ni...',
    iGiveRidesShort: 'Natoa safari',
    iNeedRidesShort: 'Nahitaji safari',
    selectCountryTitle: 'Chagua Nchi',
    selectLanguageTitle: 'Chagua Lugha',
    createAccount: 'Fungua akaunti yako',
    fullName: 'Jina kamili',
    phoneNumber: 'Nambari ya simu',
    emailAddress: 'Anwani ya barua pepe',
    confirmEmail: 'Thibitisha barua pepe',
    vehicleDetails: 'Maelezo ya gari',
    driver: 'Dereva',
    rider: 'Abiria',
    passenger: 'Abiria',
    iGiveRides: 'Natoa safari',
    iNeedRides: 'Nahitaji safari',
    continueBtn: 'Endelea',
    registerBtn: 'Jisajili',
    fullNamePlaceholder: 'mfano: Amara Osei',
    phonePlaceholder: 'mfano: +254 712 345 678',
    vehicleMake: 'Chapa ya gari',
    vehicleModel: 'Mfano wa gari',
    licensePlate: 'Nambari ya usajili',
    nationalId: 'Kitambulisho cha taifa',
    password: 'Nenosiri',
    emailsDoNotMatch: 'Barua pepe hazifanani',
    requestARide: 'Omba Usafiri',
    confirmRequest: 'Thibitisha Ombi',
    accept: 'Kubali',
    reject: 'Kataa',
    bargain: 'Piga Bei',
    rides: 'Safari',
    profile: 'Wasifu',
    requests: 'Maombi',
    signOut: 'Toka',
    waitingForDriver: 'Kusubiri Dereva...',
    noRideRequests: 'Hakuna maombi ya safari karibu',
    driverOnTheWay: 'Dereva anakuja!',
    requestCancelled: 'Ombi limefutwa. Tafadhali jaribu tena.',
    pickup: 'Mahali pa Kuanzia',
    destination: 'Mahali pa Kwenda',
    priceOffer: 'Bei Uliyotoa',
    muted: 'Imezimwa',
    available: 'Inapatikana',
    dashboard: 'Dashibodi',
    earnings: 'Mapato Yote',
    ridesCount: 'Idadi ya Safari',
    kmDriven: 'Kilomita Zilizosafirishwa',
    memberSince: 'Mwanachama Tangu',
  },
  rw: {
    appTagline: 'Urugendo rwawe, igiciro cyawe',
    countryLabel: 'Igihugu',
    languageLabel: 'Ururimi',
    selectCountry: 'Hitamo igihugu',
    selectLanguage: 'Hitamo ururimi',
    iAmA: 'Ndi...',
    iGiveRidesShort: 'Ntwara abantu',
    iNeedRidesShort: 'Nkenera gutwara',
    selectCountryTitle: 'Hitamo Igihugu',
    selectLanguageTitle: 'Hitamo Ururimi',
    createAccount: 'Fungura konti yawe',
    fullName: 'Amazina yose',
    phoneNumber: 'Numero ya telefoni',
    emailAddress: 'Aderesi ya imeyili',
    confirmEmail: 'Emeza imeyili',
    vehicleDetails: "Amakuru y'imodoka",
    driver: 'Umushoferi',
    rider: 'Umugenzi',
    passenger: 'Umugenzi',
    iGiveRides: 'Ntwara abantu',
    iNeedRides: 'Nkenera gutwara',
    continueBtn: 'Komeza',
    registerBtn: 'Iyandikishe',
    fullNamePlaceholder: 'urugero: Amara Osei',
    phonePlaceholder: 'urugero: +250 788 123 456',
    vehicleMake: "Ubwoko bw'imodoka",
    vehicleModel: "Modeli y'imodoka",
    licensePlate: "Indangamuntu y'imodoka",
    nationalId: 'Indangamuntu',
    password: 'Ijambo banga',
    emailsDoNotMatch: 'Imeyili ntizihura',
    requestARide: 'Saba Urugendo',
    confirmRequest: 'Emeza Gusaba',
    accept: 'Emera',
    reject: 'Anga',
    bargain: 'Negociya',
    rides: 'Inzira',
    profile: 'Umwirondoro',
    requests: 'Izisabwa',
    signOut: 'Sohoka',
    waitingForDriver: 'Gutegereza umushoferi...',
    noRideRequests: 'Nta gusaba urugendo hafi',
    driverOnTheWay: 'Umushoferi ari mu nzira!',
    requestCancelled: 'Gusaba byahagaritswe. Ongera ugerageze.',
    pickup: 'Aho Uzafatirwa',
    destination: 'Aho Ugiye',
    priceOffer: 'Igiciro Watanze',
    muted: 'Yacecetse',
    available: 'Ahari',
    dashboard: 'Imbonerahamwe',
    earnings: 'Amafaranga Yose',
    ridesCount: 'Umubare w\'Inzira',
    kmDriven: 'Kilometero Zanyuze',
    memberSince: 'Umunyamuryango Kuva',
  },
  am: {
    appTagline: 'ጉዞዎ፣ ዋጋዎ',
    countryLabel: 'ሀገር',
    languageLabel: 'ቋንቋ',
    selectCountry: 'ሀገር ይምረጡ',
    selectLanguage: 'ቋንቋ ይምረጡ',
    iAmA: 'እኔ ነኝ...',
    iGiveRidesShort: 'ጉዞ እሰጣለሁ',
    iNeedRidesShort: 'ጉዞ እፈልጋለሁ',
    selectCountryTitle: 'ሀገር ይምረጡ',
    selectLanguageTitle: 'ቋንቋ ይምረጡ',
    createAccount: 'መለያ ይፍጠሩ',
    fullName: 'ሙሉ ስም',
    phoneNumber: 'ስልክ ቁጥር',
    emailAddress: 'ኢሜይል አድራሻ',
    confirmEmail: 'ኢሜይል ያረጋግጡ',
    vehicleDetails: 'የተሽከርካሪ ዝርዝሮች',
    driver: 'አሽከርካሪ',
    rider: 'ተሳፋሪ',
    passenger: 'ተሳፋሪ',
    iGiveRides: 'ጉዞ እሰጣለሁ',
    iNeedRides: 'ጉዞ እፈልጋለሁ',
    continueBtn: 'ቀጥል',
    registerBtn: 'ይመዝገቡ',
    fullNamePlaceholder: 'ለምሳሌ: አማራ ኦሴ',
    phonePlaceholder: 'ለምሳሌ: +251 912 345 678',
    vehicleMake: 'የተሽከርካሪ ዓይነት',
    vehicleModel: 'የተሽከርካሪ ሞዴል',
    licensePlate: 'የሰሌዳ ቁጥር',
    nationalId: 'ብሔራዊ መታወቂያ',
    password: 'የይለፍ ቃል',
    emailsDoNotMatch: 'ኢሜይሎች አይዛመዱም',
    requestARide: 'ጉዞ ይጠይቁ',
    confirmRequest: 'ጥያቄ ያረጋግጡ',
    accept: 'ተቀበል',
    reject: 'ውድቅ',
    bargain: 'ድርድር',
    rides: 'ጉዞዎች',
    profile: 'መገለጫ',
    requests: 'ጥያቄዎች',
    signOut: 'ውጣ',
    waitingForDriver: 'አሽከርካሪ እየጠበቅን...',
    noRideRequests: 'ቅርብ ጉዞ ጥያቄዎች የሉም',
    driverOnTheWay: 'አሽከርካሪ በመምጣት ላይ ነው!',
    requestCancelled: 'ጥያቄ ተሰርዟል። እባክዎ እንደገና ይሞክሩ።',
    pickup: 'መነሻ ቦታ',
    destination: 'መድረሻ',
    priceOffer: 'የዋጋ ቅናሽ',
    muted: 'ድምጽ ጠፍቷል',
    available: 'ይገኛል',
    dashboard: 'ዳሽቦርድ',
    earnings: 'ጠቅላላ ገቢ',
    ridesCount: 'የጉዞ ብዛት',
    kmDriven: 'የተጓዙ ኪሎሜትሮች',
    memberSince: 'አባል ከሆኑበት',
  },
};

/** Map a country name to its default language code */
export function countryToLanguage(country: string): Language {
  const map: Record<string, Language> = {
    kenya: 'sw',
    uganda: 'sw',
    tanzania: 'sw',
    rwanda: 'rw',
    ethiopia: 'am',
    burundi: 'fr' as Language, // fallback to en below
    'south sudan': 'en',
  };
  const code = map[country.toLowerCase()];
  if (code === ('fr' as Language)) return 'en'; // French not yet supported
  return code ?? 'en';
}
