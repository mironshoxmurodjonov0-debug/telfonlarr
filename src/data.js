export const DEFAULT_CHANNEL_ID = '-1003957660682';

export const ORDER_STATUSES = [
  'Yangi',
  'Tasdiqlandi',
  "Yo'lda",
  'Yetkazildi',
  'Bekor qilindi',
];

export const CATEGORY_LABELS = {
  all: 'Barchasi',
  Smartfonlar: 'Smartfonlar',
  Quloqchinlar: 'Quloqchinlar',
  Soatlar: 'Soatlar',
  Aksessuarlar: 'Aksessuarlar',
};

export const IMAGE_PRESETS = [
  {
    label: 'Qora Flagman Smartfon',
    value: '/src/assets/images/product_phone_black_1795241778296.jpg',
  },
  {
    label: 'Olovrang 5G Smartfon',
    value: '/src/assets/images/product_phone_orange_1795241778356.jpg',
  },
  {
    label: 'Simsiz Quloqchinlar',
    value: '/src/assets/images/product_audio_buds_1795241777386.jpg',
  },
  {
    label: 'Titan Aqlli Soat',
    value: '/src/assets/images/product_smartwatch_1795241777841.jpg',
  },
  {
    label: 'Studiya Flagman (Hero)',
    value: '/src/assets/images/hero_flagship_phone_1795241777804.jpg',
  },
];

export const INITIAL_PRODUCTS = [
  {
    id: 'olov-pro-16',
    name: 'Olov Pro 16 Titanium',
    category: 'Smartfonlar',
    price: 14500000,
    specs: '6.8" LTPO AMOLED 120Hz · 5000 mA·soat · Snapdragon 8 Gen 4',
    description:
      'Titan korpusli flagman smartfon. Uch karra optik zoom, tungi suratga olish rejimi va 100W tezkor quvvatlash imkoniyati bilan.',
    variants: ['256 GB', '512 GB', '1 TB'],
    colors: ['Obsidian Qora', 'Olovrang Titan', 'Oq Kvars'],
    image: '/src/assets/images/product_phone_black_1795241778296.jpg',
    inStock: true,
    featured: true,
  },
  {
    id: 'flame-5g-edition',
    name: 'Flame 5G Max',
    category: 'Smartfonlar',
    price: 9800000,
    specs: '6.7" OLED 120Hz · 108 MP OIS Kamera · 67W Tezkor quvvat',
    description:
      "Olovrang anodlangan alyuminiy ramka va silliq shisha orqa panel. Kun bo'yi uzluksiz ishlash uchun optimallashtirilgan.",
    variants: ['128 GB', '256 GB', '512 GB'],
    colors: ['Olovrang', 'Qora', 'Kumush Oq'],
    image: '/src/assets/images/product_phone_orange_1795241778356.jpg',
    inStock: true,
    featured: true,
  },
  {
    id: 'apex-ultra-512',
    name: 'Apex Ultra S25',
    category: 'Smartfonlar',
    price: 15900000,
    specs: '6.9" Dynamic AMOLED · 200 MP Kamera · IP68 Himoya',
    description:
      'Professional mobil fotografiya va og‘ir o‘yinlar uchun yaratilgan maksimal unumdorlikka ega model.',
    variants: ['256 GB', '512 GB'],
    colors: ['Mat Qora', 'Oq'],
    image: '/src/assets/images/hero_flagship_phone_1795241777804.jpg',
    inStock: true,
    featured: true,
  },
  {
    id: 'pulse-buds-pro',
    name: 'Pulse Buds Pro ANC',
    category: 'Quloqchinlar',
    price: 1450000,
    specs: '48 dB Faol shovqin bosish · 36 soat batareya · Bluetooth 5.4',
    description:
      'Shahar shovqinidan to‘liq ajratuvchi gibrid ANC tizimi va chuqur bass uzatuvchi 11 mm dinamik drayverlar.',
    variants: ['Standart to‘plam'],
    colors: ['Mat Qora / Olovrang', 'Oq'],
    image: '/src/assets/images/product_audio_buds_1795241777386.jpg',
    inStock: true,
    featured: true,
  },
  {
    id: 'chrono-watch-4',
    name: 'Chrono Titan Watch 4',
    category: 'Soatlar',
    price: 3900000,
    specs: '1.5" Sapfir AMOLED · Ikki chastotali GPS · 14 kun quvvat',
    description:
      'Yengil titan korpus va sport uchun mo‘ljallangan olovrang ftoroelastomer tasma bilan jihozlangan aqlli soat.',
    variants: ['46 mm Titan', '42 mm Titan'],
    colors: ['Qora / Olovrang tasma', 'To‘liq Qora'],
    image: '/src/assets/images/product_smartwatch_1795241777841.jpg',
    inStock: true,
    featured: true,
  },
  {
    id: 'nova-lite-5g',
    name: 'Nova Air 5G',
    category: 'Smartfonlar',
    price: 5400000,
    specs: '6.5" AMOLED 90Hz · 50 MP Sony Sensor · 168g yengil korpus',
    description:
      'Kundalik foydalanish uchun qulay o‘lcham, yorqin ekran va tezkor 5G aloqa moduli.',
    variants: ['128 GB', '256 GB'],
    colors: ['Olovrang', 'Qora', 'Oq'],
    image: '/src/assets/images/product_phone_orange_1795241778356.jpg',
    inStock: true,
    featured: false,
  },
  {
    id: 'magcharge-100w',
    name: 'MagCharge 100W GaN To‘plam',
    category: 'Aksessuarlar',
    price: 650000,
    specs: '100W GaN Adapter · 2 ta USB-C port · 2m Kevlar kabel',
    description:
      'Smartfon va noutbuklarni bir vaqtning o‘zida qizib ketmasdan maksimal tezlikda quvvatlaydi.',
    variants: ['EU Vilka (100W)'],
    colors: ['Qora / Olovrang'],
    image: '/src/assets/images/product_audio_buds_1795241777386.jpg',
    inStock: true,
    featured: false,
  },
  {
    id: 'aramid-case-pro',
    name: 'Aramid MagSafe Himoya G‘ilofi',
    category: 'Aksessuarlar',
    price: 420000,
    specs: '0.9 mm Aramid tola · MagSafe magnit halqa · Zarbadan himoya',
    description:
      'Smartfon dizaynini yashirmaydigan ultra yupqa, tirnalishga chidamli va magnit quvvatlagichga mos g‘ilof.',
    variants: ['Olov Pro 16', 'Apex Ultra S25', 'Flame 5G Max'],
    colors: ['Karbon Qora', 'Qora / Olovrang halqa'],
    image: '/src/assets/images/product_phone_black_1795241778296.jpg',
    inStock: true,
    featured: false,
  },
];

export function formatPriceUZS(amount) {
  const num = Number(amount) || 0;
  return `${num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} so'm`;
}
