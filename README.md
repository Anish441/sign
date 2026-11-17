# 🖋️ SignExtract — Card Holder Signature Extractor

A fast, privacy-first web application designed for **Mobile** and **Laptop** to automatically find, extract, clean, and download the card holder's signature from the back side (left hand side) of an ID card.

---

## 🌟 How It Works

1. **Card Holder Signature Focus**:
   - The user provides the **left hand side / back side** of the ID card (where the Card Holder Signature resides).
   - If an image contains both sides, the app automatically isolates the left card and ignores the right side.
   - The computer vision algorithm automatically scans the lower portion of the card, finds the handwritten signature right above *"Signature of the Card Holder"*, and isolates it.

2. **Automatic Background Removal**:
   - The card's plastic/paper background is turned into **100% transparent alpha**.
   - Removes background noise, texture grain, smudges, and caption text.
   - Smooth anti-aliasing preserves natural pen ink curves.

3. **Multi-Format Instant Download**:
   - 💾 **Transparent PNG** (2x high resolution, ready for digital signing, PDFs, and official forms)
   - 🖼️ **White JPG** (Clean signature centered on a crisp white background)
   - 📐 **SVG Vector** (Scalable vector format for infinite scaling)
   - 📋 **Copy to Clipboard** (1-click copy to paste directly into Word, Docs, or email)

4. **Mobile & Laptop Capture**:
   - 📸 **Mobile Camera**: Direct rear camera capture (`capture="environment"`).
   - 💻 **Laptop Webcam**: Live webcam viewfinder modal with alignment box.
   - 📁 **File Upload**: Browse gallery or local image files.
   - 📋 **Paste**: Press `Ctrl+V` anywhere to paste from clipboard.
   - 🌟 **Try Example**: 1-click test with **Anish S** ID card (back side).

---

## 🚀 Quick Start

### On Laptop (Windows)
Double-click **`start.bat`** or run:
```powershell
python server.py
```
This automatically opens `http://localhost:8000` in your browser.

### On Mobile Phone
1. Connect your smartphone to the same Wi-Fi network as your laptop.
2. In your phone's browser, open the URL printed in the console (e.g. `http://10.10.194.54:8000`).
3. Tap **"Take Photo"** to snap the back of your ID card, and download the transparent signature directly!

### Offline Direct Open
You can also directly double-click **`index.html`** in Windows Explorer. It runs 100% offline inside your browser without any server needed.
