export type Language = 'english' | 'swahili' | 'luganda';

export type TranslationKey =
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
  english: {
    requestARide: 'Request a Ride',
    confirmRequest: 'Confirm Request',
    accept: 'Accept',
    reject: 'Reject',
    bargain: 'Bargain',
    rides: 'Rides',
    profile: 'Profile',
    requests: 'Requests',
    signOut: 'Sign Out',
    waitingForDriver: 'Waiting for driver...',
    noRideRequests: 'No ride requests nearby',
    driverOnTheWay: 'Driver is on the way!',
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
  swahili: {
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
  luganda: {
    requestARide: 'Saba Entambula',
    confirmRequest: 'Kakasa Okusaba',
    accept: 'Kiriza',
    reject: 'Gaana',
    bargain: 'Sulula Omuwendo',
    rides: 'Entambula',
    profile: 'Ebimu',
    requests: 'Okusaba',
    signOut: 'Fuluma',
    waitingForDriver: 'Linda Omuyimbi...',
    noRideRequests: 'Tewali kusaba kwa entambula kumpi',
    driverOnTheWay: 'Omuyimbi ajja!',
    requestCancelled: 'Okusaba kwaggyibwako. Gezaako nate.',
    pickup: 'Obutonde bw\'Entandikwa',
    destination: 'Obutonde bw\'Okutuuka',
    priceOffer: 'Omuwendo Gw\'Okuwaayo',
    muted: 'Ekizimye',
    available: 'Kirabika',
    dashboard: 'Dashibodi',
    earnings: 'Ensimbi Zonna',
    ridesCount: 'Omuwendo gw\'Entambula',
    kmDriven: 'Kilometero Ezaayambulwa',
    memberSince: 'Munaffe Okuva',
  },
};
