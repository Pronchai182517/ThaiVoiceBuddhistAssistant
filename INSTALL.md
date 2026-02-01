# 📘 คู่มือติดตั้ง BAI Buddhist AI

## Thai Voice Buddhist Assistant - Installation Guide

---

## 📋 สารบัญ

1. [ความต้องการของระบบ](#-ความต้องการของระบบ)
2. [วิธีติดตั้งด้วย Docker (แนะนำ)](#-วิธีติดตั้งด้วย-docker-แนะนำ)
3. [วิธีติดตั้งแบบ Manual](#-วิธีติดตั้งแบบ-manual)
4. [การตั้งค่า HTTPS](#-การตั้งค่า-https-สำคัญ)
5. [การแก้ไขปัญหา](#-การแก้ไขปัญหา)

---

## 💻 ความต้องการของระบบ

### ขั้นต่ำ
- **CPU:** 1 Core
- **RAM:** 1 GB
- **Storage:** 2 GB
- **OS:** Ubuntu 20.04+ / Debian 11+ / CentOS 8+

### แนะนำ
- **CPU:** 2 Cores
- **RAM:** 2 GB
- **Storage:** 5 GB
- **Network:** เปิด Port 80, 443, 3001

### ซอฟต์แวร์ที่ต้องติดตั้ง
- Docker 24.0+
- Docker Compose 2.0+
- Git

---

## 🐳 วิธีติดตั้งด้วย Docker (แนะนำ)

### ขั้นตอนที่ 1: ติดตั้ง Docker

**Ubuntu/Debian:**
```bash
# อัพเดตระบบ
sudo apt update && sudo apt upgrade -y

# ติดตั้ง Docker
curl -fsSL https://get.docker.com | sh

# เพิ่มผู้ใช้เข้ากลุ่ม docker (ไม่ต้องใช้ sudo)
sudo usermod -aG docker $USER

# Logout แล้ว Login ใหม่ หรือรันคำสั่งนี้
newgrp docker

# ตรวจสอบการติดตั้ง
docker --version
docker compose version
```

**CentOS/RHEL:**
```bash
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo systemctl start docker
sudo systemctl enable docker
```

---

### ขั้นตอนที่ 2: Clone โปรเจค

```bash
# สร้างโฟลเดอร์ (แนะนำใช้ /opt)
cd /opt

# Clone จาก GitHub
git clone https://github.com/Pronchai182517/ThaiVoiceBuddhistAssistant.git

# เข้าไปในโฟลเดอร์
cd ThaiVoiceBuddhistAssistant
```

---

### ขั้นตอนที่ 3: ตั้งค่า API Key

```bash
# สร้างไฟล์ .env.local
nano .env.local
```

**เพิ่มเนื้อหานี้:**
```
GEMINI_API_KEY=your_gemini_api_key_here
```

**วิธีรับ API Key:**
1. ไปที่ https://aistudio.google.com/
2. คลิก "Get API Key"
3. สร้าง API Key ใหม่
4. คัดลอก Key มาใส่ในไฟล์

**บันทึกไฟล์:** กด `Ctrl+X` → `Y` → `Enter`

---

### ขั้นตอนที่ 4: Build และรัน Container

```bash
# Build Docker Image
docker compose build

# รัน Container (Background mode)
docker compose up -d

# ตรวจสอบสถานะ
docker ps
```

**ผลลัพธ์ที่ควรเห็น:**
```
CONTAINER ID   IMAGE                              STATUS         PORTS
abc123...      thai-voice-buddhist-assistant      Up 30 seconds  0.0.0.0:3001->80/tcp
```

---

### ขั้นตอนที่ 5: ทดสอบการทำงาน

```bash
# ตรวจสอบว่า Container ทำงาน
curl -I http://localhost:3001

# ดู Logs
docker compose logs -f
```

**เข้าใช้งาน:**
- **Local:** http://localhost:3001
- **Remote:** http://your-server-ip:3001

---

## 🔧 คำสั่งจัดการ Docker ที่ใช้บ่อย

| คำสั่ง | รายละเอียด |
|--------|------------|
| `docker compose up -d` | เริ่ม Container |
| `docker compose down` | หยุด Container |
| `docker compose restart` | รีสตาร์ท Container |
| `docker compose logs -f` | ดู Logs แบบ realtime |
| `docker compose build --no-cache` | Build ใหม่ทั้งหมด |
| `docker compose pull` | อัพเดต Images |

### อัพเดตเวอร์ชันใหม่
```bash
cd /opt/ThaiVoiceBuddhistAssistant
git pull
docker compose build --no-cache
docker compose up -d
```

---

## 📦 วิธีติดตั้งแบบ Manual

หากไม่ต้องการใช้ Docker:

```bash
# ติดตั้ง Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Clone โปรเจค
git clone https://github.com/Pronchai182517/ThaiVoiceBuddhistAssistant.git
cd ThaiVoiceBuddhistAssistant

# ติดตั้ง Dependencies
npm install

# ตั้งค่า API Key
echo "GEMINI_API_KEY=your_api_key" > .env.local

# รัน Development
npm run dev

# หรือ Build สำหรับ Production
npm run build
npm run preview
```

---

## 🔒 การตั้งค่า HTTPS (สำคัญ!)

> ⚠️ **หมายเหตุ:** เบราว์เซอร์ต้องการ HTTPS เพื่อเข้าถึงกล้องและไมโครโฟน

### วิธีที่ 1: Cloudflare Tunnel (ง่ายที่สุด)

```bash
# ติดตั้ง cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# สร้าง Tunnel
cloudflared tunnel login
cloudflared tunnel create bai-buddhist-ai

# รัน Tunnel
cloudflared tunnel run --url http://localhost:3001 bai-buddhist-ai
```

### วิธีที่ 2: Nginx + Let's Encrypt

```bash
# ติดตั้ง Nginx และ Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# สร้าง Config
sudo nano /etc/nginx/sites-available/bai-buddhist-ai
```

**เนื้อหา Nginx Config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# เปิดใช้งาน
sudo ln -s /etc/nginx/sites-available/bai-buddhist-ai /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# ติดตั้ง SSL
sudo certbot --nginx -d your-domain.com
```

---

## 🔧 การแก้ไขปัญหา

### ปัญหา: Port 3001 ถูกใช้งานแล้ว
```bash
# ตรวจสอบว่าอะไรใช้ Port
sudo lsof -i :3001

# หรือเปลี่ยน Port ใน docker-compose.yml
# แก้ไข "3001:80" เป็น "3002:80"
```

### ปัญหา: Container ไม่เริ่มทำงาน
```bash
# ดู Logs
docker compose logs

# ลบ Container เก่าและสร้างใหม่
docker compose down
docker compose up -d --force-recreate
```

### ปัญหา: ไม่สามารถเข้าถึงกล้อง/ไมค์
- ต้องใช้ **HTTPS** หรือ **localhost** เท่านั้น
- ตรวจสอบการอนุญาตในเบราว์เซอร์
- ลองใช้เบราว์เซอร์อื่น (Chrome, Firefox)

### ปัญหา: API Key ไม่ทำงาน
```bash
# ตรวจสอบไฟล์ .env.local
cat .env.local

# ต้องมีรูปแบบ:
# GEMINI_API_KEY=AIzaSy...

# หลังแก้ไข ต้อง rebuild
docker compose build --no-cache
docker compose up -d
```

### ปัญหา: Session Closed 1008
- Model ไม่รองรับ Live API
- ตรวจสอบว่าใช้ model: `gemini-2.5-flash-native-audio-preview-12-2025`

---

## 📞 การติดต่อและสนับสนุน

- **GitHub Issues:** [Report Bug](https://github.com/Pronchai182517/ThaiVoiceBuddhistAssistant/issues)
- **Repository:** https://github.com/Pronchai182517/ThaiVoiceBuddhistAssistant

---

## 📄 License

MIT License - สามารถนำไปใช้และดัดแปลงได้อย่างอิสระ

---

<div align="center">
  <p>🙏 Made with ❤️ for Thai Buddhist Community</p>
  <p>Version 1.0</p>
</div>
