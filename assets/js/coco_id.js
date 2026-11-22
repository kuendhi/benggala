/**
 * Benggala AI - Kamus 80 Kelas Objek COCO-SSD (Bahasa Indonesia)
 */

window.COCO_ID_MAP = {
  // Manusia & Kendaraan
  'person': 'Orang',
  'bicycle': 'Sepeda',
  'car': 'Mobil',
  'motorcycle': 'Motor',
  'airplane': 'Pesawat',
  'bus': 'Bus',
  'train': 'Kereta',
  'truck': 'Truk',
  'boat': 'Perahu',

  // Rambu & Ruang Publik
  'traffic light': 'Lampu Lalu Lintas',
  'fire hydrant': 'Hidran Pemadam',
  'stop sign': 'Rambu Stop',
  'parking meter': 'Meteran Parkir',
  'bench': 'Bangku',

  // Hewan
  'bird': 'Burung',
  'cat': 'Kucing',
  'dog': 'Anjing',
  'horse': 'Kuda',
  'sheep': 'Domba',
  'cow': 'Sapi',
  'elephant': 'Gajah',
  'bear': 'Beruang',
  'zebra': 'Zebra',
  'giraffe': 'Jerapah',

  // Aksesoris & Perlengkapan Pribadi
  'backpack': 'Ransel',
  'umbrella': 'Payung',
  'handbag': 'Tas Tangan',
  'tie': 'Dasi',
  'suitcase': 'Koper',

  // Olahraga & Rekreasi
  'frisbee': 'Piring Terbang',
  'skis': 'Ski',
  'snowboard': 'Papan Salju',
  'sports ball': 'Bola',
  'kite': 'Layang-layang',
  'baseball bat': 'Tongkat Bisbol',
  'baseball glove': 'Sarung Tangan Bisbol',
  'skateboard': 'Papan Luncur',
  'surfboard': 'Papan Selancar',
  'tennis racket': 'Raket Tenis',

  // Peralatan Makan & Dapur
  'bottle': 'Botol',
  'wine glass': 'Gelas Anggur',
  'cup': 'Gelas',
  'fork': 'Garpu',
  'knife': 'Pisau',
  'spoon': 'Sendok',
  'bowl': 'Mangkuk',

  // Makanan
  'banana': 'Pisang',
  'apple': 'Apel',
  'sandwich': 'Roti Lapis',
  'orange': 'Jeruk',
  'broccoli': 'Brokoli',
  'carrot': 'Wortel',
  'hot dog': 'Hot Dog',
  'pizza': 'Piza',
  'donut': 'Donat',
  'cake': 'Kue',

  // Perabotan Rumah Tangga
  'chair': 'Kursi',
  'couch': 'Sofa',
  'sofa': 'Sofa',
  'potted plant': 'Tanaman Pot',
  'pottedplant': 'Tanaman Pot',
  'bed': 'Tempat Tidur',
  'dining table': 'Meja Makan',
  'diningtable': 'Meja Makan',
  'toilet': 'Toilet',

  // Elektronik & Gadget
  'tv': 'TV',
  'tvmonitor': 'TV',
  'laptop': 'Laptop',
  'mouse': 'Mouse (Tetikus)',
  'remote': 'Remote',
  'keyboard': 'Keyboard',
  'cell phone': 'HP',
  'mobile phone': 'HP',
  'microwave': 'Microwave',
  'oven': 'Oven',
  'toaster': 'Pemanggang Roti',
  'sink': 'Wastafel',
  'refrigerator': 'Kulkas',

  // Barang Sehari-hari
  'book': 'Buku',
  'clock': 'Jam',
  'vase': 'Vas Bunga',
  'scissors': 'Gunting',
  'teddy bear': 'Boneka Beruang',
  'hair drier': 'Pengering Rambut',
  'hair dryer': 'Pengering Rambut',
  'toothbrush': 'Sikat Gigi'
};

/**
 * Helper untuk menerjemahkan label kelas COCO ke Bahasa Indonesia
 * @param {string} label Label asli bahasa Inggris dari COCO-SSD
 * @returns {string} Terjemahan Bahasa Indonesia atau label asli jika tidak ditemukan
 */
window.translateLabel = function(label) {
  if (!label) return '';
  const key = String(label).toLowerCase().trim();
  return window.COCO_ID_MAP[key] || label;
};
