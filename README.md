<!-- Banner Image -->
<div align="center">
  <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=1000&auto=format&fit=crop" width="100%" alt="ASCII OS Banner">
</div>

<h1 align="center">ASCII OS 🖥️</h1>
<h3 align="center">Live ASCII Wallpaper & Desktop Companion</h3>

<br>

<!-- Know About Project Section -->
<h2>🔍 About The Project</h2>

<table>
  <tr>
    <td valign="top" width="25%">
      <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/ASCII_Art_Computer.svg/300px-ASCII_Art_Computer.svg.png" alt="ASCII Brain" width="100%" style="border-radius: 10px;">
    </td>
    <td valign="top" width="75%">
      <h4>What is ASCII OS?</h4>
      <p><b>ASCII OS</b> adalah aplikasi Desktop Environment eksperimental dan Live Wallpaper interaktif yang dibangun menggunakan Electron dan Next.js. Aplikasi ini menampilkan karakter wajah ASCII yang beranimasi langsung di belakang ikon desktop Anda.</p>
      <p>Dengan integrasi MediaPipe, karakter ini dapat mendeteksi gerakan wajah secara <i>real-time</i>, berkedip, dan bereaksi. Dilengkapi dengan AI Chat (Gemini) dan Text-to-Speech, menjadikan desktop Anda hidup dan futuristik.</p>
      
      <h4>Tech Stack:</h4>
      <img src="https://img.shields.io/badge/Next.js-black?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js">
      <img src="https://img.shields.io/badge/Electron-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron">
      <img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React">
      <img src="https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript">
      <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white" alt="Tailwind">
    </td>
  </tr>
</table>

<br>

<!-- Top Features Section -->
<h2>🏆 Key Features</h2>

<table>
  <tr>
    <td valign="top" width="75%">
      <ul>
        <li>
          <b>Live ASCII Wallpaper:</b> Karakter wajah ASCII yang beranimasi menempel di belakang desktop (mendukung Linux X11).
        </li>
        <li>
          <b>Face & Body Tracking:</b> Deteksi gerakan wajah dan mata menggunakan MediaPipe.
        </li>
        <li>
          <b>AI Companion:</b> Ngobrol dengan karakter menggunakan Google Gemini API (BYOK).
        </li>
        <li>
          <b>Text-to-Speech (TTS):</b> Karakter dapat merespons dengan suara AI.
        </li>
        <li>
          <b>Cinematic Setup UI:</b> Antarmuka pengaturan minimalis bergaya SpaceX.
        </li>
      </ul>
    </td>
    <td valign="top" width="25%" align="center">
      <img src="https://cdn-icons-png.flaticon.com/512/179/179403.png" alt="Laptop" width="120">
    </td>
  </tr>
</table>

<br>

<!-- Installation Section -->
<h2>🚀 How to Run (Development)</h2>

> **Note:** Aplikasi ini dioptimalkan untuk Linux (X11). Jika Anda menggunakan Wayland, fitur Live Wallpaper tidak akan berfungsi.

```bash
# 1. Install dependencies sistem (Ubuntu/Debian)
sudo apt install wmctrl xdotool x11-utils scrot -y

# 2. Clone repositori
git clone https://github.com/NissanEx/ASCIIOS.git
cd ASCIIOS

# 3. Install node modules
npm install

# 4. Jalankan development mode
npm run electron:dev