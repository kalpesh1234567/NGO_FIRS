const express = require('express');
const cors = require('cors');
const multer = require('multer');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

// Load environment variables
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Serve static files from the current directory (for the frontend)
app.use(express.static(__dirname));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize Gemini Client
// We verify that the GEMINI_API_KEY is present
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const INSTRUCTION = `
You are a data extraction engine.

Your task is to extract structured FIR (First Information Report) data from the given text.

Instructions:

Extract only relevant FIR details.
Return output strictly in VALID JSON format.
Do NOT include any explanation, notes, or extra text.
If a field is missing, return an empty string "".
Ensure consistency across all records.

Extract the following fields:

FIR_Number
Date
Police_Station
District
State
Complainant_Name
Accused_Name
Sections (law sections mentioned)
Description (brief summary of incident in 1-2 lines)
Vehicle (any vehicle registration numbers or types mentioned)
Animals (count of animals involved, e.g. Cows, Bulls)
IO_Name (Investigating Officer name)

Rules:

Normalize dates to DD-MM-YYYY if possible.
Remove extra spaces and line breaks.
Combine multi-line fields into single-line text.
If multiple FIRs exist in the text, return multiple objects in "records" array.
Do NOT hallucinate missing data.

Ignore OCR errors and extract best possible structured data.
Be flexible with field labels (e.g., FIR No, Crime No, Case No all mean FIR_Number)
`;

app.post('/api/extract', upload.single('pdf'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No PDF file uploaded.' });
  }

  if (!process.env.GEMINI_API_KEY) {
     return res.status(500).json({ error: 'GEMINI_API_KEY is not set in the .env file.' });
  }

  try {
    console.log(`[API] Uploading ${req.file.filename} to Gemini File API...`);
    
    // Upload the file to Gemini
    let uploadResult = await ai.files.upload({
      file: req.file.path,
      config: { mimeType: 'application/pdf' },
    });

    console.log(`[API] File uploaded successfully as: ${uploadResult.name}. Waiting for processing...`);
    
    // Poll until file is active
    while (uploadResult.state === 'PROCESSING') {
        process.stdout.write('.');
        await new Promise(r => setTimeout(r, 2000));
        uploadResult = await ai.files.get({ name: uploadResult.name });
    }
    
    if (uploadResult.state === 'FAILED') {
        throw new Error('Gemini failed to process the PDF document.');
    }
    console.log(`\n[API] File ready! Sending to gemini-2.5-flash...`);

    // Call the model with structured JSON output instructions
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
            uploadResult,
            INSTRUCTION
        ],
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    records: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                FIR_Number: { type: Type.STRING },
                                Date: { type: Type.STRING },
                                Police_Station: { type: Type.STRING },
                                District: { type: Type.STRING },
                                State: { type: Type.STRING },
                                Complainant_Name: { type: Type.STRING },
                                Accused_Name: { type: Type.STRING },
                                Sections: { type: Type.STRING },
                                Description: { type: Type.STRING },
                                Vehicle: { type: Type.STRING },
                                Animals: { type: Type.STRING },
                                IO_Name: { type: Type.STRING }
                            }
                        }
                    }
                }
            }
        }
    });

    console.log(`[API] Generation complete. Parsing results...`);
    
    // Clean up local temp file as we don't need it anymore
    fs.unlinkSync(req.file.path);

    // The response is strict JSON matching the schema
    const dataText = response.text;
    console.log(`\n--- [DEBUG] RAW GEMINI RESPONSE ---`);
    console.log(dataText);
    console.log(`-----------------------------------\n`);
    const jsonParsed = JSON.parse(dataText);
    const geminiRecords = jsonParsed.records || [];

    // Map to frontend expected format
    const records = geminiRecords.map(r => ({
        firNo: r.FIR_Number || '',
        date: r.Date || '',
        policeStation: r.Police_Station || '',
        district: r.District || '',
        accused: r.Accused_Name || r.Complainant_Name || '',
        vehicle: r.Vehicle || r.Description || '',
        animals: r.Animals || '',
        sections: r.Sections || '',
        io: r.IO_Name || '',
        fileName: req.file.originalname,
        source: 'gemini'
    }));

    console.log(`[API] Success! Extracted ${records.length} records.`);
    res.json(records);

  } catch (error) {
    console.error('[API Error]:', error);
    // Cleanup local file on error too
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'Failed to process document with Gemini: ' + error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 FIR Extraction Server running at http://localhost:${port}`);
  console.log(`📄 Open http://localhost:${port}/extractor.html in your browser.`);
});
