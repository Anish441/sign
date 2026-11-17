# Signature Extractor

A responsive web application to extract transparent signatures from photos of paper or cards. Runs 100% in the client browser using HTML5 Canvas and adaptive local thresholding.

## Features
- **Adaptive Contrast Thresholding**: Automatically removes shadows, gradients, and paper texture (works on white, cream, or colored paper).
- **Interactive Crop Box**: Drag & resize to select signature strokes.
- **Multiple Export Formats**: Transparent PNG, White JPG, SVG vector, or direct Copy to Clipboard.
- **Mobile & Desktop**: Works with device camera, webcam, drag-and-drop, or file upload.

---

## Deploying to Vercel

Since the entire application runs client-side (no backend required), it deploys directly to Vercel in seconds:

### Method 1: Using GitHub & Vercel Dashboard (Recommended)
1. Push this folder to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<repo-name>.git
   git push -u origin main
   ```
2. Go to [vercel.com](https://vercel.com) and log in.
3. Click **Add New...** -> **Project**.
4. Import your GitHub repository.
5. Leave all build settings at their defaults (Framework Preset: **Other**, Root Directory: `./`).
6. Click **Deploy**.

---

### Method 2: Using the Vercel CLI
1. Open PowerShell or Terminal in this folder:
   ```bash
   npm i -g vercel
   vercel
   ```
2. Follow the interactive prompts (accept defaults).
3. For production deployment:
   ```bash
   vercel --prod
   ```

---

## Local Development
To run locally:
- Double-click `start.bat`, or
- Run `python server.py` and open `http://localhost:8000`
