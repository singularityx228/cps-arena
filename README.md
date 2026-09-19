# ⚡ CPS ARENA - Ultra Hızlı CPS Testi & 1v1 Online Kapışma Arenası

Tüm işletim sistemlerinde (Windows, macOS, Linux, iOS, Android) sorunsuz ve yüksek performansla çalışan modern neon & cyberpunk tasarımlı CPS (Clicks Per Second) test ve gerçek zamanlı 1v1 kapışma platformu.

![CPS Arena](https://raw.githubusercontent.com/sdfsgedsfhstjhfghfda/cps-arena/main/preview.png)

---

## 🎮 Özellikler

### 1. ⚡ Solo CPS Testi (1 - 60 Saniye Serbest Seçim)
- **1s, 3s, 5s, 10s, 15s, 30s, 60s** hazır hızlı butonlar veya **1-60s özel süre kaydırıcısı**.
- Milisaniye hassasiyetinde CPS ve tepe (peak) hız takibi.
- Web Audio API ile gecikmesiz mekanik switch tıklama sesleri ve neon parçacık efektleri.

### 2. 🏆 Özel Skor Değerlendirme Sistemi
- **$\le 7.0$ CPS**: `"ÇIK SİTEDEN BİR DAHA GELME"` 💀
- **$8.0 - 9.0$ CPS**: `"GÜZEL"` ⚡
- **$9.01 - 13.0$ CPS**: `"AFERİN LA"` 🔥
- **$13.0+$ CPS**: `"I AM BETTER"` 👑 *(Özel God Mode animasyonları ve şampiyon konfetisi)*

### 3. ⚔️ 1v1 Online Realtime VS Arena
- **1 - 7 Saniye Dinamik Süre**: Sistem her maçta hileleri önlemek ve heyecanı artırmak için 1 ile 7 saniye arasında otomatik bir süre belirler.
- **10 Saniyelik Başlama Penceresi**:
  - Oyuncular hazır olduğunda sayaç 10 saniye geri sayar.
  - Ekstra butona gerek olmadan **tıklama alanına dokunulduğu an** yarış başlar.
  - 10 saniye içinde tıklamayan oyuncu otomatik hükmen mağlup sayılır.
- **Hassas Puanlama**: Ondalık basamak hassasiyetiyle (örn: `13.1 CPS` vs `13.0 CPS` -> 13.1 yapan kazanır).
- **Modlar**: Hızlı Rastgele Eşleşme, 6 Haneli Özel Oda Kodu ile Arkadaş Daveti ve AI Cyber Bot ile Pratik.

### 4. 👤 Şifresiz Kullanıcı Adı ile Giriş & Kalıcı Profil
- Sadece kullanıcı adı ile anında başlama.
- Tarayıcıda kalıcı oturum (`localStorage` + Supabase entegrasyonu).
- Profil menüsünden **her an kullanıcı adı değiştirebilme**.

---

## 🔒 Güvenlik & Supabase Kurulumu

Tüm hassas API anahtarları `.env.local` dosyasında gizli tutulur ve GitHub'a yüklenmez.

1. Depoyu klonlayın:
```bash
git clone https://github.com/sdfsgedsfhstjhfghfda/cps-arena.git
cd cps-arena
```

2. Paketleri yükleyin:
```bash
npm install
```

3. `.env.example` dosyasını `.env.local` olarak kopyalayıp Supabase bilgilerinizi girin:
```bash
cp .env.example .env.local
```

4. Geliştirme sunucusunu başlatın:
```bash
npm run dev
```

---

## 📜 Supabase SQL Tabloları
Supabase SQL editöründe çalıştırmak için `supabase/schema.sql` dosyasındaki SQL komutlarını kullanabilirsiniz.
