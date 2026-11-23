/**
 * Benggala OS - Database Profil Detail Objek Instan (Lokal + Integrasi Custom Objects)
 * Modul kamus lengkap 80 kelas COCO-SSD, integrasi memori custom_objects, dan AI Session Cache.
 */

(function() {
  'use strict';

  // =========================================================================
  // 1. Kamus Lengkap 80 Kelas COCO-SSD (Bahasa Indonesia Ringkas & Terstruktur)
  // =========================================================================
  const PROFILES = {
    // --- Manusia & Mobilitas ---
    'person': {
      title: 'Orang',
      category: 'MANUSIA',
      utility: 'Subjek manusia berakal, operator sistem, atau pejalan kaki.',
      detail: 'Postur bipedal dinamis, memiliki ekspresi wajah dan bahasa tubuh.',
      safety: 'aman',
      safetyNote: 'Jaga jarak aman saat berinteraksi di ruang publik.'
    },
    'bicycle': {
      title: 'Sepeda',
      category: 'KENDARAAN',
      utility: 'Kendaraan roda dua bertenaga kayuhan manusia ramah lingkungan.',
      detail: 'Rangka logam atau serat karbon dilengkapi stang dan pedal.',
      safety: 'aman',
      safetyNote: 'Gunakan helm pelindung dan waspadai rem blong.'
    },
    'car': {
      title: 'Mobil',
      category: 'KENDARAAN',
      utility: 'Transportasi darat berpenumpang 4-8 orang bermesin motor.',
      detail: 'Bodi beroda empat dengan sistem kemudi setir bundar.',
      safety: 'waspada',
      safetyNote: 'Waspadai titik buta spion dan laju kecepatan tinggi.'
    },
    'motorcycle': {
      title: 'Motor',
      category: 'KENDARAAN',
      utility: 'Kendaraan bermotor roda dua untuk mobilitas cepat perkotaan.',
      detail: 'Mesin pembakaran atau listrik dengan suspensi depan garpu.',
      safety: 'waspada',
      safetyNote: 'Gunakan helm SNI dan waspadai permukaan licin/basah.'
    },
    'airplane': {
      title: 'Pesawat',
      category: 'KENDARAAN',
      utility: 'Transportasi udara jarak jauh berkecepatan jelajah tinggi.',
      detail: 'Badan aerodinamis bersayap lebar dengan mesin turbofan jet.',
      safety: 'waspada',
      safetyNote: 'Hindari area propeler dan lintasan lepas landas.'
    },
    'bus': {
      title: 'Bus',
      category: 'KENDARAAN',
      utility: 'Transportasi umum massal pengangkut puluhan penumpang kota.',
      detail: 'Dimensi bodi panjang, kabin tinggi beroda ganda belakang.',
      safety: 'waspada',
      safetyNote: 'Jaga jarak aman saat bus bermanuver putar balik.'
    },
    'train': {
      title: 'Kereta',
      category: 'KENDARAAN',
      utility: 'Angkutan rel massal berkapasitas sangat besar antar kota.',
      detail: 'Rangkaian gerbong baja melaju di atas bantalan rel khusus.',
      safety: 'bahaya',
      safetyNote: 'Dilarang melintas rel saat palang pintu tertutup!'
    },
    'truck': {
      title: 'Truk',
      category: 'KENDARAAN',
      utility: 'Pengangkut muatan barang, logistik, atau material konstruksi berat.',
      detail: 'Sasis kokoh berdiferensial kuat dengan bak kargo luas.',
      safety: 'waspada',
      safetyNote: 'Jauhi area blind spot sopir di sisi samping dan belakang.'
    },
    'boat': {
      title: 'Perahu',
      category: 'KENDARAAN',
      utility: 'Transportasi air penyeberangan sungai, danau, atau perikanan laut.',
      detail: 'Lambung apung kayu, serat kaca, atau logam bermotor tempel.',
      safety: 'waspada',
      safetyNote: 'Wajib kenakan jaket pelampung selama di perairan.'
    },

    // --- Rambu & Fasilitas Publik ---
    'traffic light': {
      title: 'Lampu Lalu Lintas',
      category: 'BARANG',
      utility: 'Pengatur ritme arus persimpangan jalan secara berkala.',
      detail: 'Lampu tiga warna standar (merah, kuning, hijau) di tiang.',
      safety: 'aman',
      safetyNote: 'Patuhi rambu untuk mencegah kecelakaan fatal persimpangan.'
    },
    'fire hydrant': {
      title: 'Hidran Pemadam',
      category: 'BARANG',
      utility: 'Koneksi pasokan air darurat bagi petugas pemadam kebakaran.',
      detail: 'Pipa katup besi cor merah bertekanan tinggi trotoar jalan.',
      safety: 'aman',
      safetyNote: 'Dilarang menghalangi hidran dengan parkir sembarangan.'
    },
    'stop sign': {
      title: 'Rambu Stop',
      category: 'BARANG',
      utility: 'Perintah berhenti sejenak sebelum melintasi persimpangan jalan raya.',
      detail: 'Plat oktagon merah mencolok bertuliskan kata STOP putih.',
      safety: 'aman',
      safetyNote: 'Berhenti penuh dan tengok kiri-kanan sebelum melaju.'
    },
    'parking meter': {
      title: 'Meteran Parkir',
      category: 'BARANG',
      utility: 'Alat penghitung durasi dan pemungut tarif parkir pinggir jalan.',
      detail: 'Tiang logam berlayar digital atau slot koin/kartu pintar.',
      safety: 'aman',
      safetyNote: 'Hati-hati terbentur saat membuka pintu kendaraan.'
    },
    'bench': {
      title: 'Bangku',
      category: 'DEKORASI',
      utility: 'Tempat duduk umum bersantai di taman, trotoar, atau koridor.',
      detail: 'Konstruksi kayu, beton, atau besi cor tanpa sandaran roda.',
      safety: 'aman',
      safetyNote: 'Periksa kebersihan dan paku menonjol sebelum menduduki.'
    },

    // --- Satwa & Binatang ---
    'bird': {
      title: 'Burung',
      category: 'HEWAN',
      utility: 'Unggas bersayap penjaga keseimbangan ekosistem dan penyebar biji alami.',
      detail: 'Tubuh berbulu dengan paruh ringan dan kemampuan terbang.',
      safety: 'aman',
      safetyNote: 'Waspadai kotoran atau parasit jika burung liar.'
    },
    'cat': {
      title: 'Kucing',
      category: 'HEWAN',
      utility: 'Hewan peliharaan karnivora kecil, predator alami tikus rumah.',
      detail: 'Habitat domestik, aktif senja/malam, indra pendengaran sangat tajam.',
      safety: 'aman',
      safetyNote: 'Umumnya jinak; waspadai cakaran mendadak saat terancam.'
    },
    'dog': {
      title: 'Anjing',
      category: 'HEWAN',
      utility: 'Hewan penjaga rumah, pelacak aparat, atau teman setia keluarga.',
      detail: 'Mamalia karnivora domestik berdaya penciuman dan pendengaran kuat.',
      safety: 'waspada',
      safetyNote: 'Jangan membuat gerakan mendadak di dekat anjing asing.'
    },
    'horse': {
      title: 'Kuda',
      category: 'HEWAN',
      utility: 'Ternak penunggang, penarik dokar, atau atlet olahraga pacuan.',
      detail: 'Berkaki empat berkuku tunggal dengan stamina lari kencang.',
      safety: 'waspada',
      safetyNote: 'Jangan berdiri tepat di belakang ekor kuda karena rawan tendangan.'
    },
    'sheep': {
      title: 'Domba',
      category: 'HEWAN',
      utility: 'Ternak penghasil wol tebal, daging bergizi, dan susu alami.',
      detail: 'Ruminansia berbulu keriting tebal, hidup berkelompok di padang.',
      safety: 'aman',
      safetyNote: 'Hati-hati tandukan pejantan dominan saat musim kawin.'
    },
    'cow': {
      title: 'Sapi',
      category: 'HEWAN',
      utility: 'Ternak besar penghasil susu, daging sapi, dan pupuk organik.',
      detail: 'Mamalia ruminansia bertubuh padat berbobot ratusan kilogram.',
      safety: 'waspada',
      safetyNote: 'Jaga jarak dari sepakan kaki belakang atau serudukan tanduk.'
    },
    'elephant': {
      title: 'Gajah',
      category: 'HEWAN',
      utility: 'Herbivora besar penjelajah hutan, penyeimbang habitat rimba tropis.',
      detail: 'Mamalia darat terbesar berkulit tebal, berbelalai dan bergading.',
      safety: 'bahaya',
      safetyNote: 'Sangat berbahaya jika mengamuk; segera evakuasi diri!'
    },
    'bear': {
      title: 'Beruang',
      category: 'HEWAN',
      utility: 'Predator omnivora puncak di ekosistem hutan dan kutub.',
      detail: 'Tubuh kekar berbulu lebat bercakar tajam dan penciuman tajam.',
      safety: 'bahaya',
      safetyNote: 'Sangat berbahaya; jangan mendekat atau memicu rasa terancam.'
    },
    'zebra': {
      title: 'Zebra',
      category: 'HEWAN',
      utility: 'Herbivora liar sabana pembentuk rantai makanan alami Afrika.',
      detail: 'Kuda liar berpola loreng belang hitam-putih khas kamuflase.',
      safety: 'waspada',
      safetyNote: 'Gigitan dan sepakan kaki zebra liar sangat bertenaga.'
    },
    'giraffe': {
      title: 'Jerapah',
      category: 'HEWAN',
      utility: 'Mamalia peramban dedaunan puncak pohon tinggi di sabana.',
      detail: 'Hewan tertinggi di bumi dengan leher panjang bercorak totol.',
      safety: 'aman',
      safetyNote: 'Waspadai ayunan leher dan tendangan kaki jika panik.'
    },

    // --- Aksesoris & Perlengkapan Pribadi ---
    'backpack': {
      title: 'Ransel',
      category: 'BARANG',
      utility: 'Tas punggung pembawa laptop, buku, dan perlengkapan bepergian.',
      detail: 'Bahan nilon/kanvas bertali ganda empuk disandang di bahu.',
      safety: 'aman',
      safetyNote: 'Bagi beban merata untuk mencegah cidera tulang belakang.'
    },
    'umbrella': {
      title: 'Payung',
      category: 'BARANG',
      utility: 'Pelindung tubuh portabel dari curahan hujan dan terik matahari.',
      detail: 'Kanopi kain kedap air yang dapat dilipat pada rangka kawat.',
      safety: 'aman',
      safetyNote: 'Hati-hati ujung jari-jari kawat saat membuka di keramaian.'
    },
    'handbag': {
      title: 'Tas Tangan',
      category: 'BARANG',
      utility: 'Wadah aksesoris harian penyimpan dompet, ponsel, dan kosmetik.',
      detail: 'Bahan kulit sintetis atau kain berpegangan tali jinjing pendek.',
      safety: 'aman',
      safetyNote: 'Waspadai penjambretan saat berjalan di sisi jalan raya.'
    },
    'tie': {
      title: 'Dasi',
      category: 'BARANG',
      utility: 'Aksesoris busana formal pelengkap kemeja kerah pria/wanita.',
      detail: 'Kain panjang sutra atau poliester terikat rapi di leher.',
      safety: 'aman',
      safetyNote: 'Lepas dasi saat mengoperasikan mesin berputar agar tidak terbelit.'
    },
    'suitcase': {
      title: 'Koper',
      category: 'BARANG',
      utility: 'Wadah kaku pakaian dan barang bawaan perjalanan jauh.',
      detail: 'Kotak polikarbonat beroda putar dengan tuas tarik teleskopik.',
      safety: 'aman',
      safetyNote: 'Kunci ritsleting dengan kombinasi TSA untuk mencegah pencurian.'
    },

    // --- Olahraga & Rekreasi ---
    'frisbee': {
      title: 'Piring Terbang',
      category: 'BARANG',
      utility: 'Alat permainan lempar tangkap aerodinamis rekreasi pantai/taman.',
      detail: 'Piringan plastik ringan dengan bibir melengkung penahan udara.',
      safety: 'aman',
      safetyNote: 'Perhatikan arah lemparan agar tidak mengenai kepala orang lain.'
    },
    'skis': {
      title: 'Ski',
      category: 'BARANG',
      utility: 'Papan luncur kaki untuk bergerak cepat di permukaan salju.',
      detail: 'Sepasang papan sempit panjang berbahan komposit berujung melengkung.',
      safety: 'waspada',
      safetyNote: 'Gunakan rem dan pengikat sepatu ski standar keamanan.'
    },
    'snowboard': {
      title: 'Papan Salju',
      category: 'BARANG',
      utility: 'Papan luncur salju gaya bebas untuk kedua kaki bertaut satu.',
      detail: 'Papan tunggal lebar berbahan fiberglass bertepi baja peluncur.',
      safety: 'waspada',
      safetyNote: 'Wajib gunakan helm pelindung kepala dan bantalan pergelangan.'
    },
    'sports ball': {
      title: 'Bola',
      category: 'BARANG',
      utility: 'Perlengkapan utama olahraga sepak bola, basket, atau voli.',
      detail: 'Benda bulat elastis berbahan kulit atau karet berisi udara.',
      safety: 'aman',
      safetyNote: 'Jaga tekanan angin agar pantulan bola stabil dan aman.'
    },
    'kite': {
      title: 'Layang-layang',
      category: 'BARANG',
      utility: 'Permainan terbang tali memanfaatkan tenaga angin di ruang terbuka.',
      detail: 'Rangka bambu dibalut kertas/plastik diterbangkan dengan benang.',
      safety: 'aman',
      safetyNote: 'Jangan terbangkan di dekat kabel listrik atau jalan raya.'
    },
    'baseball bat': {
      title: 'Tongkat Bisbol',
      category: 'BARANG',
      utility: 'Pemukul bola pada pertandingan bisbol atau sofbol.',
      detail: 'Silinder mengerucut berbahan kayu padat atau paduan aluminium keras.',
      safety: 'waspada',
      safetyNote: 'Pegang erat grip pemukul agar tidak terlempar mengenai penonton.'
    },
    'baseball glove': {
      title: 'Sarung Tangan Bisbol',
      category: 'BARANG',
      utility: 'Sarung tangan tebal penangkap bola bisbol berkecepatan tinggi.',
      detail: 'Bahan kulit sapi berlapis bantalan empuk dengan jaring antar jari.',
      safety: 'aman',
      safetyNote: 'Pastikan ukuran pas di tangan agar pergelangan tidak terkilir.'
    },
    'skateboard': {
      title: 'Papan Luncur',
      category: 'KENDARAAN',
      utility: 'Alat seluncur darat dan atraksi akrobatik perkotaan.',
      detail: 'Papan kayu lapis beroda poliuretan kecil berporos suspensi.',
      safety: 'waspada',
      safetyNote: 'Gunakan helm serta pelindung siku dan lutut.'
    },
    'surfboard': {
      title: 'Papan Selancar',
      category: 'BARANG',
      utility: 'Papan luncur air penunggang ombak laut bagi peselancar.',
      detail: 'Struktur busa dilapisi resin fiberglass ringan dengan sirip sirip.',
      safety: 'waspada',
      safetyNote: 'Kaitkan tali leash ke pergelangan kaki agar papan tidak hilang.'
    },
    'tennis racket': {
      title: 'Raket Tenis',
      category: 'BARANG',
      utility: 'Alat pemukul bola berpegas senar pada permainan tenis lapangan.',
      detail: 'Bingkai serat karbon oval beranyaman senar nilon tegang.',
      safety: 'aman',
      safetyNote: 'Lakukan pemanasan pergelangan tangan untuk mencegah cedera otot.'
    },

    // --- Wadah & Peralatan Makan ---
    'bottle': {
      title: 'Botol',
      category: 'BARANG',
      utility: 'Wadah penyimpan air mineral, minuman kemasan, atau cairan kimia.',
      detail: 'Berleher sempit bertutup ulir, berbahan plastik PET atau kaca.',
      safety: 'aman',
      safetyNote: 'Periksa segel kemasan dan hindari penggunaan berulang plastik tipis.'
    },
    'wine glass': {
      title: 'Gelas Anggur',
      category: 'BARANG',
      utility: 'Gelas bertangkai penyaji minuman anggur atau jamuan formal.',
      detail: 'Mangkuk kaca tipis bertangkai sempit dengan dasar bulat datar.',
      safety: 'waspada',
      safetyNote: 'Sangat rapuh; pegang pada tangkai dan hati-hati saat mencuci.'
    },
    'cup': {
      title: 'Gelas',
      category: 'BARANG',
      utility: 'Wadah minum teh, kopi, atau air putih harian.',
      detail: 'Cangkir keramik bertangkai atau gelas kaca bening silindris.',
      safety: 'aman',
      safetyNote: 'Waspadai suhu panas cairan agar bibir tidak melepuh.'
    },
    'fork': {
      title: 'Garpu',
      category: 'BARANG',
      utility: 'Alat makan penusuk dan penahan makanan padat di piring.',
      detail: 'Gagang logam baja tahan karat berujung tiga hingga empat gerigi.',
      safety: 'waspada',
      safetyNote: 'Ujung gerigi tajam; jauhkan dari jangkauan balita.'
    },
    'knife': {
      title: 'Pisau',
      category: 'BARANG',
      utility: 'Alat pemotong bahan masakan, daging, buah, atau keperluan meja.',
      detail: 'Bilah baja pipih bermata pisau sangat tajam dengan gagang kokoh.',
      safety: 'bahaya',
      safetyNote: 'Benda tajam berbahaya; selalu arahkan mata pisau menjauhi tubuh.'
    },
    'spoon': {
      title: 'Sendok',
      category: 'BARANG',
      utility: 'Alat makan penyiduk kuah, sup, nasi, atau pengaduk minuman.',
      detail: 'Cekungan lonjong dari logam atau kayu bergagang pipih panjang.',
      safety: 'aman',
      safetyNote: 'Pastikan higienis dan bebas karat sebelum digunakan.'
    },
    'bowl': {
      title: 'Mangkuk',
      category: 'BARANG',
      utility: 'Wadah saji makanan berkuah seperti bakso, sup, atau sereal.',
      detail: 'Cekungan setengah bola berbahan keramik, kaca, kayu, atau plastik.',
      safety: 'aman',
      safetyNote: 'Gunakan alas kain saat mengangkat mangkuk berisi sup panas.'
    },

    // --- Makanan & Buah ---
    'banana': {
      title: 'Pisang',
      category: 'MAKANAN',
      utility: 'Buah tropis bergizi tinggi sumber energi kalium instan.',
      detail: 'Kulit kuning mudah dikupas dengan daging buah manis lembut.',
      safety: 'aman',
      safetyNote: 'Buang kulit pisang ke tempat sampah agar tidak terpeleset.'
    },
    'apple': {
      title: 'Apel',
      category: 'MAKANAN',
      utility: 'Buah segar kaya serat dan antioksidan untuk camilan sehat.',
      detail: 'Bentuk bulat berkulit merah/hijau renyah berair manis sedikit asam.',
      safety: 'aman',
      safetyNote: 'Cuci bersih sebelum dikonsumsi langsung untuk menghilangkan lilin/pestisida.'
    },
    'sandwich': {
      title: 'Roti Lapis',
      category: 'MAKANAN',
      utility: 'Makanan cepat saji praktis untuk sarapan atau bekal perjalanan.',
      detail: 'Dua lapis roti berisi potongan daging, telur, keju, dan sayuran.',
      safety: 'aman',
      safetyNote: 'Konsumsi selagi segar agar isian sayur/mayones tidak basi.'
    },
    'orange': {
      title: 'Jeruk',
      category: 'MAKANAN',
      utility: 'Buah sitrus kaya vitamin C untuk menjaga daya tahan tubuh.',
      detail: 'Bentuk bulat berkulit oranye berpori dengan bulir air manis segar.',
      safety: 'aman',
      safetyNote: 'Kupas kulit luar dan buang biji sebelum dikonsumsi anak-anak.'
    },
    'broccoli': {
      title: 'Brokoli',
      category: 'MAKANAN',
      utility: 'Sayuran hijau kaya kalsium, serat, dan nutrisi pencegah penyakit.',
      detail: 'Kuntum bunga rapat berwarna hijau tua menyerupai miniatur pohon.',
      safety: 'aman',
      safetyNote: 'Rendam air garam sebelum dimasak untuk membersihkan ulat/kotoran.'
    },
    'carrot': {
      title: 'Wortel',
      category: 'MAKANAN',
      utility: 'Sayuran umbi kaya beta-karoten yang baik untuk kesehatan mata.',
      detail: 'Umbi kerucut berwarna oranye terang bertekstur renyah padat.',
      safety: 'aman',
      safetyNote: 'Kupas kulit tipis dan cuci bersih sebelum diolah masakan.'
    },
    'hot dog': {
      title: 'Hot Dog',
      category: 'MAKANAN',
      utility: 'Roti sosis praktis berlumur saus tomat dan mostar gurih.',
      detail: 'Roti panjang terbelah memuat sosis panggang empuk di tengahnya.',
      safety: 'aman',
      safetyNote: 'Batasi konsumsi sosis olahan berpengawet secara berlebihan.'
    },
    'pizza': {
      title: 'Piza',
      category: 'MAKANAN',
      utility: 'Roti pipih panggang khas Italia bertabur keju leleh lezat.',
      detail: 'Adonan gandum bulat bertabur keju mozarela, saus tomat, dan topping.',
      safety: 'aman',
      safetyNote: 'Hati-hati suhu keju leleh panas yang baru keluar oven.'
    },
    'donut': {
      title: 'Donat',
      category: 'MAKANAN',
      utility: 'Kudapan manis teman minum kopi atau teh sore hari.',
      detail: 'Adonan roti goreng berlubang cincin bertabur gula atau meses cokelat.',
      safety: 'aman',
      safetyNote: 'Kandungan gula dan kalori cukup tinggi; konsumsi sewajarnya.'
    },
    'cake': {
      title: 'Kue',
      category: 'MAKANAN',
      utility: 'Kue bolu manis perayaan ulang tahun, pesta, atau hidangan penutup.',
      detail: 'Tekstur spons lembut dilapisi krim mentega dekoratif aneka rasa.',
      safety: 'aman',
      safetyNote: 'Simpan di lemari pendingin jika mengandung krim susu basah.'
    },

    // --- Perabotan & Tanaman ---
    'chair': {
      title: 'Kursi',
      category: 'DEKORASI',
      utility: 'Perabot penopang duduk satu orang untuk bekerja atau bersantai.',
      detail: 'Rangka berkaki empat berbahan kayu, logam, atau plastik berkontur.',
      safety: 'aman',
      safetyNote: 'Pastikan kaki kursi kokoh dan tidak goyah sebelum mendudukinya.'
    },
    'couch': {
      title: 'Sofa',
      category: 'DEKORASI',
      utility: 'Tempat duduk santai empuk untuk beberapa orang di ruang keluarga.',
      detail: 'Rangka kayu berspons tebal berlapis kain atau kulit lembut.',
      safety: 'aman',
      safetyNote: 'Bersihkan sela-sela lipatan sofa dari debu dan benda jatuh.'
    },
    'potted plant': {
      title: 'Tanaman Pot',
      category: 'TUMBUHAN',
      utility: 'Tanaman hias penghijau ruangan dan pembersih udara alami.',
      detail: 'Tanaman hidup ditanam dalam wadah pot berisi media tanah gembur.',
      safety: 'aman',
      safetyNote: 'Periksa apakah getah atau daun tanaman beracun bagi hewan peliharaan.'
    },
    'bed': {
      title: 'Tempat Tidur',
      category: 'DEKORASI',
      utility: 'Dipan kasur empuk untuk beristirahat dan tidur memulihkan stamina.',
      detail: 'Rangka tempat tidur beralas kasur pegas atau busa bertutup sprei.',
      safety: 'aman',
      safetyNote: 'Ganti sprei berkala untuk mencegah tungau debu dan alergi kulit.'
    },
    'dining table': {
      title: 'Meja Makan',
      category: 'DEKORASI',
      utility: 'Meja utama tempat menyajikan hidangan dan bersantap bersama keluarga.',
      detail: 'Permukaan datar luas berkaki empat berbahan kayu atau kaca tebal.',
      safety: 'aman',
      safetyNote: 'Gunakan tatakan panas agar permukaan meja kayu/kaca tidak rusak.'
    },
    'toilet': {
      title: 'Toilet',
      category: 'BARANG',
      utility: 'Sanitasi pembuangan kotoran tubuh manusia dengan sistem bilas air.',
      detail: 'Mangkuk keramik berpenutup dilengkapi tangki air penggelontor.',
      safety: 'aman',
      safetyNote: 'Lantai toilet rawan licin; gunakan sandal anti-selip.'
    },

    // --- Elektronik & Gadget ---
    'tv': {
      title: 'TV',
      category: 'ELEKTRONIK',
      utility: 'Perangkat hiburan penampil siaran audio visual dan informasi berita.',
      detail: 'Panel layar datar LED/OLED tipis berbingkai minimalis bertombol/remote.',
      safety: 'aman',
      safetyNote: 'Pastikan braket dinding terpasang kuat agar TV tidak roboh menimpa.'
    },
    'laptop': {
      title: 'Laptop',
      category: 'ELEKTRONIK',
      utility: 'Komputer portabel untuk komputasi, kerja kantor, dan pemrograman.',
      detail: 'Desain lipat mengintegrasikan layar, keyboard, baterai, dan touchpad.',
      safety: 'aman',
      safetyNote: 'Hindari meletakkan laptop di atas kasur agar sirkulasi kipas tidak tertutup.'
    },
    'mouse': {
      title: 'Mouse (Tetikus)',
      category: 'ELEKTRONIK',
      utility: 'Alat pengendali kursor dan navigasi antarmuka sistem komputer.',
      detail: 'Perangkat genggam ergonomis beroda gulir dan sensor optik bawah.',
      safety: 'aman',
      safetyNote: 'Gunakan mousepad empuk untuk mencegah ketegangan urat carpal tunnel.'
    },
    'remote': {
      title: 'Remote',
      category: 'ELEKTRONIK',
      utility: 'Pengendali nirkabel jarak jauh untuk TV, AC, atau perangkat audio.',
      detail: 'Kotak plastik kecil bertombol karet pemancar sinar inframerah/Bluetooth.',
      safety: 'aman',
      safetyNote: 'Ganti baterai yang bocor untuk mencegah korosi papan sirkuit.'
    },
    'keyboard': {
      title: 'Keyboard',
      category: 'ELEKTRONIK',
      utility: 'Papan ketik tombol input teks, angka, dan perintah komputer.',
      detail: 'Papan berisi tata letak tombol QWERTY bersaklar membran atau mekanikal.',
      safety: 'aman',
      safetyNote: 'Jauhkan dari tumpahan cairan yang dapat menyebabkan korsleting tombol.'
    },
    'cell phone': {
      title: 'HP',
      category: 'ELEKTRONIK',
      utility: 'Ponsel pintar untuk komunikasi, navigasi peta, dan akses internet.',
      detail: 'Layar sentuh kaca dengan bodi tipis berdaya baterai lithium-ion.',
      safety: 'aman',
      safetyNote: 'Jangan gunakan ponsel saat sedang mengisi daya berdekatan bantal tidur.'
    },
    'microwave': {
      title: 'Microwave',
      category: 'ELEKTRONIK',
      utility: 'Pemanas makanan cepat saji memanfaatkan radiasi gelombang mikro.',
      detail: 'Kabinet logam berpintu kaca bertombol digital timer dan piringan putar.',
      safety: 'waspada',
      safetyNote: 'Dilarang keras memasukkan wadah logam atau aluminium foil ke microwave!'
    },
    'oven': {
      title: 'Oven',
      category: 'ELEKTRONIK',
      utility: 'Pemanggang kue, roti, dan daging memanfaatkan elemen panas tertutup.',
      detail: 'Ruang insulasi berpintu kaca tahan panas bertingkat rak panggangan.',
      safety: 'waspada',
      safetyNote: 'Permukaan oven sangat panas; wajib gunakan sarung tangan tahan panas.'
    },
    'toaster': {
      title: 'Pemanggang Roti',
      category: 'ELEKTRONIK',
      utility: 'Alat pemanggang roti tawar cepat dengan mekanisme lontar pegas.',
      detail: 'Slot vertikal logam bertenaga elemen kawat pemanas berpemandu timer.',
      safety: 'waspada',
      safetyNote: 'Jangan mencongkel roti macet menggunakan garpu/pisau logam!'
    },
    'sink': {
      title: 'Wastafel',
      category: 'BARANG',
      utility: 'Tempat mencuci tangan, wajah, atau piring dengan saluran pembuangan.',
      detail: 'Bak cekung keramik atau baja tahan karat berpancuran kran air.',
      safety: 'aman',
      safetyNote: 'Jaga kebersihan saringan pembuangan agar pipa tidak tersumbat minyak.'
    },
    'refrigerator': {
      title: 'Kulkas',
      category: 'ELEKTRONIK',
      utility: 'Penyimpan dan pengawet kesegaran bahan makanan dengan sistem pendingin.',
      detail: 'Lemari insulasi berfreon bertemperatur rendah dengan kompartemen beku.',
      safety: 'aman',
      safetyNote: 'Tutup pintu kulkas rapat-rapat untuk menjaga efisiensi listrik.'
    },

    // --- Barang Sehari-hari ---
    'book': {
      title: 'Buku',
      category: 'BARANG',
      utility: 'Media baca penyimpan ilmu pengetahuan, sastra, atau catatan tertulis.',
      detail: 'Kumpulan lembaran kertas bertuliskan dijilid dengan sampul pelindung.',
      safety: 'aman',
      safetyNote: 'Simpan di tempat kering agar kertas tidak lembap atau berjamur.'
    },
    'clock': {
      title: 'Jam',
      category: 'BARANG',
      utility: 'Penunjuk waktu detik, menit, dan jam untuk manajemen aktivitas.',
      detail: 'Dial bundar berjarum analog atau tampilan angka digital bertenaga baterai.',
      safety: 'aman',
      safetyNote: 'Pasang gantung jam dinding dengan paku kokoh agar tidak jatuh.'
    },
    'vase': {
      title: 'Vas Bunga',
      category: 'DEKORASI',
      utility: 'Wadah penampung air & penopang tanaman hias atau bunga potong.',
      detail: 'Umumnya dari kaca, keramik, atau tanah liat cetak/tiup dekoratif.',
      safety: 'waspada',
      safetyNote: 'Rawan pecah jika berbahan kaca/keramik; letakkan di meja stabil.'
    },
    'scissors': {
      title: 'Gunting',
      category: 'BARANG',
      utility: 'Alat pemotong kertas, kain, tali, atau kemasan berbahan ringan.',
      detail: 'Dua bilah logam tajam berpaut poros silang bertangkai pegangan jari.',
      safety: 'waspada',
      safetyNote: 'Benda tajam; serahkan gunting dengan memegang bilah kepada orang lain.'
    },
    'teddy bear': {
      title: 'Boneka Beruang',
      category: 'BARANG',
      utility: 'Mainan boneka kain lembut penghibur anak-anak atau dekorasi kamar.',
      detail: 'Kain beludru berbentuk beruang diisi kapas busa lembut berjahit rapi.',
      safety: 'aman',
      safetyNote: 'Cuci berkala untuk mencegah penumpukan debu bagi penderita asma.'
    },
    'hair drier': {
      title: 'Pengering Rambut',
      category: 'ELEKTRONIK',
      utility: 'Alat pengering rambut basah memanfaatkan hembusan udara hangat.',
      detail: 'Blower portabel bermotor kipas dengan kawat pemanas listrik berisolasi.',
      safety: 'waspada',
      safetyNote: 'Jangan gunakan di dekat bak mandi atau genangan air (bahaya sengatan listrik).'
    },
    'toothbrush': {
      title: 'Sikat Gigi',
      category: 'BARANG',
      utility: 'Alat pembersih plak gigi, sela-sela gigi, dan menjaga kesehatan gusi.',
      detail: 'Gagang plastik ergonomis berujung bulu sikat nilon halus rapat.',
      safety: 'aman',
      safetyNote: 'Ganti sikat gigi setiap 3 bulan sekali atau saat bulu telah mekar.'
    }
  };

  // Sinonim / varian penulisan COCO-SSD
  PROFILES['sofa'] = PROFILES['couch'];
  PROFILES['pottedplant'] = PROFILES['potted plant'];
  PROFILES['diningtable'] = PROFILES['dining table'];
  PROFILES['tvmonitor'] = PROFILES['tv'];
  PROFILES['mobile phone'] = PROFILES['cell phone'];
  PROFILES['hair dryer'] = PROFILES['hair drier'];

  // =========================================================================
  // 2. Helper Cache Sesi AI (Map in-memory dengan masa berlaku 10 menit)
  // =========================================================================
  const aiCacheMap = new Map();
  const CACHE_TTL_MS = 10 * 60 * 1000; // 10 menit

  function setAiCache(label, aiData) {
    if (!label || !aiData) return;
    const key = String(label).replace(/^★\s*/, '').trim().toLowerCase();
    aiCacheMap.set(key, {
      data: aiData,
      timestamp: Date.now()
    });
  }

  function getAiCache(label) {
    if (!label) return null;
    const key = String(label).replace(/^★\s*/, '').trim().toLowerCase();
    const entry = aiCacheMap.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      aiCacheMap.delete(key);
      return null;
    }
    return entry.data;
  }

  // =========================================================================
  // 3. Resolver Pintar Profil Objek
  // =========================================================================
  function getProfile(rawLabel, customMeta) {
    if (!rawLabel) {
      return {
        title: 'Objek Tidak Dikenal',
        category: 'UMUM',
        utility: 'Objek belum teridentifikasi dalam database visual.',
        detail: 'Periksa fokus lensa atau ubah sudut pandang kamera.',
        safety: 'aman',
        safetyNote: 'Objek belum dikenali; amati dengan cermat.',
        source: 'LOKAL'
      };
    }

    const clean = String(rawLabel).replace(/^★\s*/, '').trim();
    const cleanLower = clean.toLowerCase();

    // Prioritas 1: Cache AI Live (jika baru saja dianalisis di sesi ini)
    const cachedAi = getAiCache(cleanLower);
    if (cachedAi) {
      return {
        title: cachedAi.title || clean,
        category: cachedAi.category || 'AI ENRICHED',
        utility: cachedAi.utility || cachedAi.analysis || 'Hasil analisis konteks visual AI real-time.',
        detail: cachedAi.detail || 'Diperkaya oleh Gemini Vision / DeepSeek LLM.',
        safety: cachedAi.safety || 'aman',
        safetyNote: cachedAi.safetyNote || 'Data analisis real-time terkini.',
        source: 'AI LIVE'
      };
    }

    // Prioritas 2: Objek Latih custom_objects (dari parameter customMeta atau window.BenggalaKnowledge)
    let meta = customMeta;
    if (!meta && window.BenggalaKnowledge && typeof window.BenggalaKnowledge.getKnowledgeList === 'function') {
      const list = window.BenggalaKnowledge.getKnowledgeList() || [];
      meta = list.find(item => item && item.label_name && item.label_name.toLowerCase().trim() === cleanLower);
    }

    if (meta && (meta.label_name || meta.category)) {
      const cat = (meta.category || 'UMUM').toUpperCase();
      const notes = (meta.notes && meta.notes.trim()) ? meta.notes.trim() : `Objek terverifikasi tersimpan dalam database kategori ${cat}.`;
      return {
        title: meta.label_name || clean,
        category: cat,
        utility: notes,
        detail: `Terlatih pada MobileNet v2 KNN (${meta.image_path ? 'tersedia foto referensi' : 'memori vektor'}).`,
        safety: 'aman',
        safetyNote: 'Objek lokal terverifikasi oleh pengguna pada database MySQL.',
        source: 'MEMORI DB'
      };
    }

    // Prioritas 3: Kamus Lengkap 80 Kelas COCO-SSD (key Inggris atau match title Indonesia)
    let profile = PROFILES[cleanLower];
    if (!profile) {
      // Coba cari kecocokan berdasarkan title Bahasa Indonesia
      for (const k in PROFILES) {
        if (PROFILES[k].title && PROFILES[k].title.toLowerCase() === cleanLower) {
          profile = PROFILES[k];
          break;
        }
      }
    }

    if (profile) {
      return {
        ...profile,
        source: 'LOKAL'
      };
    }

    // Fallback Aman jika objek belum ada di kamus
    return {
      title: clean,
      category: 'TERDETEKSI',
      utility: 'Objek teridentifikasi visual; tekan Detail AI untuk profil mendalam.',
      detail: 'Siap dianalisis dengan Gemini Vision.',
      safety: 'aman',
      safetyNote: 'Belum ada catatan khusus; periksa visual secara cermat.',
      source: 'LOKAL'
    };
  }

  // =========================================================================
  // 4. Expose Global Module
  // =========================================================================
  window.BenggalaObjectProfiles = {
    PROFILES,
    getProfile,
    setAiCache,
    getAiCache,
    clearCache: () => aiCacheMap.clear()
  };

})();
