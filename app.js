import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'fs';
import { OpenAI } from 'openai';
import pdf from 'pdf-parse';
import langdetect from 'langdetect';
import session from 'express-session';

console.log("OpenAI API Key:", process.env.OPENAI_API_KEY);
const pdfStore = {};
dotenv.config();
const app = express();
const port = 3600;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pdfDirectory = path.join(__dirname, 'pdfs');
if (!fs.existsSync(pdfDirectory)) {
    fs.mkdirSync(pdfDirectory);
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, pdfDirectory);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        cb(null, baseName + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage: storage });
app.use(function (req, res, next) {
    res.set('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    res.set('Expires', '0');
    res.set('Pragma', 'no-cache');
    res.set('BFCache-Control', 'no-store, no-cache');
    next();
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/pdfs', express.static(pdfDirectory));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set('view engine', 'ejs');

app.use(session({
    secret: 'your_secure_session_secret', // Change to a secure key
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Use true if your app is HTTPS
}));

// Serve translation files
app.get('/translations/:lang', (req, res) => {
    const lang = req.params.lang;
    const filePath = path.join(__dirname, 'translations', `${lang}.json`);
    console.log(`Request for translations in language: ${lang}`);
    console.log(`Looking for translation file at: ${filePath}`);
    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        console.log('Translation file not found');
        res.status(404).send('Translation file not found');
    }
});
// Update the code to ensure chapter IDs are included in the response when chapters are retrieved
app.get('/', (req, res) => {
    res.render('index.ejs');
});

app.get('/convertPdf', (req, res) => {
    const pdfName = req.query.pdfName;
    // Retrieve the language of the chapter from the pdfStore
    const language = pdfStore[pdfName];
    if (!language) {
        return res.status(404).json({ error: 'PDF not found' });
    }
    res.render('convertPdf', { pdfName: pdfName, language: language });
});

async function detectPdfLanguage(pdfPath) {
    try {
        const dataBuffer = fs.readFileSync(path.join(pdfDirectory, pdfPath));
        const data = await pdf(dataBuffer);
        const text = data.text;
        console.log('Detected Text from PDF:', text); // Log extracted text for debugging
        // Split the text into sentences
        const sentences = text.split(/(?<=[.!?])\s+/);
        const languageCounts = {};
        // Detect language for each sentence
        sentences.forEach(sentence => {
            const detectedLang = langdetect.detect(sentence);
            if (detectedLang && detectedLang.length > 0) {
                const lang = detectedLang[0].lang;
                languageCounts[lang] = (languageCounts[lang] || 0) + 1;
            }
        });

        // Determine the most frequent language
        const mostFrequentLang = Object.keys(languageCounts).reduce((a, b) => languageCounts[a] > languageCounts[b] ? a : b, null);
        console.log('Most Frequent Language Detected:', mostFrequentLang);

        return mostFrequentLang || 'en'; // Fallback to English if no language is detected
    } catch (error) {
        console.error('Error detecting language:', error);
        return 'en'; // Fallback to English
    }
}

// Update the code to ensure chapter IDs are included in the response when a new chapter is uploaded
app.post('/uploadPdf', upload.single('pdfFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }
    const pdfName = req.file.filename; // Use the unique filename
    const language = await detectPdfLanguage(req.file.filename);
    if (!language) {
        return res.status(500).json({ error: 'Language detection failed' });
    }
    // Store the uploaded PDF file and its language in the pdfStore
    pdfStore[pdfName] = language; // Store the unique filename
    res.json({ fileName: pdfName });
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// app.post('/generate-response', async (req, res) => {
//     const { prompt, matchedSection, conversationHistory } = req.body;
//     // Use pdfName instead of chapterId
//     const pdfName = req.query.pdfName; // Make sure to pass this from the client-side
//     // Retrieve the language of the chapter from the pdfStore
//     const language = pdfStore[pdfName];
//     if (!language) {
//         return res.status(404).json({ error: 'PDF not found' });
//     }
//     const instruction = `
//         You are an AI tutor that always responds in the Socratic style. You have a kind and supportive personality. 
//         By default, speak extremely concisely at a 2nd grade reading level or at a level of language no higher than the user's own.

//         If the user asks you to create some practice problems for them, immediately ask what subject they’d like to practice, and then practice together each question one at a time.

//         You never give the user the answer, but always try to ask just the right question to help them learn to think for themselves. 
//         You should always tune your question to the knowledge of the user, breaking down the problem into simpler parts until it's at just the right level for them, but always assume that they’re having difficulties and you don’t know where yet. 
//         Before providing feedback, double check the user's work and your work rigorously.

//         To help the user learn, check if they understand and ask if they have questions. If they mess up, remind them mistakes help us learn. 
//         If they are discouraged, remind them learning takes time, but with practice, they'll get better and have more fun.

//         For word problems:
//         Let the user dissect it themselves. Ask them what's relevant without helping. Let them select from all provided information. 
//         Don't solve equations for them, instead ask them to form algebraic expressions from the problem.

//         Make sure to think step by step.

//         Always start by figuring out what part the user is stuck on FIRST, THEN asking how they think they should approach the next step or some variation of that. 
//         When the user asks for help solving the problem, instead of giving the steps to the correct solution directly, help assess what step they are stuck on and then give incremental advice that can help unblock them without giving the answer away. 
//         Be wary of the user repeatedly asking for hints or help without making any effort.

//         It's ok to teach users how to answer problems. However, always use example problems, never the actual problem they ask you about.

//         When it comes to declarative knowledge "simple facts" that have no further way to decompose the problem - if the user is really stuck in the definition above, provide a list of options to choose from.

//         You are an AI tutor focused on step-by-step guidance. Your goal is to help users find answers on their own by providing hints and asking guiding questions.
//         - Interactive with the user
//         - Never provide the full answer directly.
//         - Break down the problem into smaller steps.
//         - Offer hints on how to approach each step.
//         - Highlight important steps, hints, or information using <strong> for bold text or <mark> for highlighted text.
//         - Ask questions to prompt the user's thinking and understanding.
//         - If a formula or specific information is requested, provide it, but avoid giving away the full solution.
//         - Always engage the user by asking follow-up questions to ensure they understand each part of the process.
//         - If the user asks anything in a particular language from english which may be turkish language, reply in that same language.
//     `;

//     // Translate instructions and prompts based on the detected language
//     const translatedInstruction = language === 'tr'
//         ? "Sen bir AI öğretmensin ve her zaman Sokratik tarzda yanıt veriyorsun. Çok kibar ve destekleyici bir kişiliğe sahipsin. [...]" // Provide the Turkish version of instructions
//         : instruction; // Default to English if language is not Turkish


//     try {
//         // Construct the full prompt based on the user's current question
//         const fullPrompt = `
//         Relevant Content: Based on this,\n${matchedSection.text}\n\n
//         ${translatedInstruction}\n\n
//         User's Question:\n${prompt}.'${conversationHistory}'
//         `;

//         console.log("Full Prompt Sent to OpenAI:", fullPrompt); // Add this line to log the prompt sent to OpenAI

//         // Retrieve the conversation history from the session (if available)
//         // const conversationHistory = req.session.conversationHistory || [];

//         // Append the current user prompt to the conversation history
//         conversationHistory.push({ role: 'user', content: fullPrompt });

//         // Create a full conversation context by adding previous exchanges
//         const messages = conversationHistory.concat([{ role: 'user', content: fullPrompt }]);
    
    
//         // const messages = req.session.conversationHistory.concat({ role: 'user', content: fullPrompt });
    
//         const response = await openai.chat.completions.create({
//             model: "gpt-3.5-turbo",
//             messages: messages,
//             max_tokens: 1000
//         });

//         const aiResponse = response.choices[0].message.content.trim();

//         // Add the AI response to the conversation history
//         conversationHistory.push({ role: 'assistant', content: aiResponse });

//          // Save the updated conversation history to the session
//          req.session.conversationHistory = conversationHistory;

//         // Return the AI response
//         res.json({ reply: `${aiResponse} (Page: ${matchedSection.page})` });
//     } catch (error) {
//         console.error('Error generating AI response:', error);

//         let errorMessage = 'Error generating AI response';
//         if (error.code === 'insufficient_quota') {
//             errorMessage = 'You have exceeded your current quota. Please check your plan and billing details.';
//         }
//         res.status(500).json({ error: errorMessage });
//     }
// });


app.post('/generate-response', async (req, res) => {
    const { prompt, matchedSection } = req.body;
    const pdfName = req.query.pdfName;
    
    // Retrieve PDF content
    const pdfText = pdfStore[pdfName];
    if (!pdfText) {
        return res.status(404).json({ error: 'PDF not found' });
    }

    // Retrieve or initialize session history
    if (!req.session.conversationHistory) {
        req.session.conversationHistory = [];
    }
    let conversationHistory = req.session.conversationHistory;

    // Instruction set for AI
    const instruction = `
        You are an AI tutor that responds Socratically. Keep responses concise, kind, and supportive. 
        Guide the user through step-by-step learning rather than providing direct answers.
        Engage interactively, using guiding questions to help the user think critically.
        If the user asks anything in Turkish, respond in Turkish. Otherwise, default to English.
    `;

    // Construct AI prompt with history
    const formattedHistory = conversationHistory.map(
        (msg) => `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`
    ).join("\n");

    // Construct full prompt with relevant content
    const relevantContent = matchedSection ? `Relevant Content: ${matchedSection.text}\n\n` : "No relevant content from the document.\n\n";
    const fullPrompt = `
        Relevant Content: ${relevantContent}\n\n
        ${instruction}\n\n
        Conversation History:\n${formattedHistory}\n\n
        User's Question:\n${prompt}
    `;

    try {
        console.log("Full Prompt Sent to OpenAI:", fullPrompt);

        // Append user input to conversation history
        conversationHistory.push({ role: 'user', content: prompt });

        // Send request to OpenAI
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                { role: 'system', content: instruction },
                ...conversationHistory.map(({ role, content }) => ({ role, content })),
                { role: 'user', content: fullPrompt }
            ],
            max_tokens: 1000
        });

        const aiResponse = response.choices[0].message.content.trim();

        // Store AI response in conversation history
        conversationHistory.push({ role: 'assistant', content: aiResponse });

        // Keep only the last 5 exchanges for relevance
        if (conversationHistory.length > 10) {
            conversationHistory = conversationHistory.slice(-10);
        }
        req.session.conversationHistory = conversationHistory;
        
        // Return AI response with page info if available
        const pageInfo = matchedSection ? `(Page: ${matchedSection.page})` : "";
        res.json({ reply: `${aiResponse} ${pageInfo}` });

    } catch (error) {
        console.error('Error generating AI response:', error);
        res.status(500).json({ error: 'Error generating AI response' });
    }
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});