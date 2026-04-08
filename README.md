# GauRaksha NGO FIR Extractor

A specialized tool built to automate the extraction of critical data from Maharashtra Police First Information Reports (FIR/IIF-I) PDFs. This system was specifically designed for the **GauRaksha NGO** to rapidly digitize complex, merged FIR documents regarding cases of illegal cow transport or slaughter into a structured Excel database.

## 🌟 Key Features

- **Perfect Devanagari (Marathi) OCR**: Because standard police PDFs are generated using custom encodings like the Mangal CID font, standard text extractors (like pdf.js) garble the output. This project solves that completely by using **Gemini's Vision AI** to visually read the PDF pages.
- **Bulk Processing**: Upload a large merged PDF containing anywhere from 1 to 50 FIR cases, and the system intelligently extracts every single incident into its own separate table row.
- **Critical Data Points**: Specifically tuned to extract context-aware fields like `Vehicle Registration Number`, `Animals Count`, and `IO Name` directly from messy property tables inside the document.
- **Excel Export**: Download all extracted cases to an Excel spreadsheet with a single click.

## 🚀 How to Run Locally

### 1. Requirements
- Install **Node.js** (v18+ recommended)
- A free **Google Gemini API Key** (Get one from [Google AI Studio](https://aistudio.google.com/app/apikey))

### 2. Setup
Clone the repository and enter the directory:
```bash
cd ngo_site
npm install
```

Create a file named `.env` in the root folder, and add your API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Start the Server
Start the backend Express server which handles the file uploads and Gemini communication securely:
```bash
node server.js
```

### 4. Open the Interface
Open your web browser and navigate to:
```
http://localhost:3000/extractor.html
```

Upload your merged FIR PDF, click **Extract Data**, wait a few seconds, and your structured data will instantly appear!

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML / CSS / JS (Custom glassmorphism design)
- **Backend API**: Node.js & Express
- **AI Engine**: `@google/genai` (utilizing `gemini-2.5-flash`)
- **Excel Parsing**: SheetJS (`xlsx`)
