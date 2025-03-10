document.addEventListener("DOMContentLoaded", function () {
    console.log("PDF Name:", window.pdfName);
    const fileName = window.pdfName;
    const language = window.language || 'en'; // Default to English if not set
    console.log("Detected language on client side:", language);
    const pdfPath = `/pdfs/${fileName}`;
    const chatContainer = document.getElementById("chat-container");
    const chatSubmit = document.getElementById("chat-submit");
    // const languageSelect = document.getElementById('language-select');
    let isFirstMessage = true;
    let extractedTextByPage = {};
    // let currentLanguage = localStorage.getItem('language') || 'en';
    let translations = {};

    document.addEventListener("mousedown", function (event) {
        event.stopPropagation();
    }, true);



    console.log(`Loading PDF from: ${pdfPath}`);

    const pdfContainer = document.getElementById("pdf-container");
    const chatIcon = document.getElementById("chat-icon");
    pdfContainer.style.display = "block";
    chatIcon.style.display = "block";

    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.10.377/pdf.worker.min.js";

        pdfjsLib.getDocument({ url: pdfPath }).promise.then((pdf) => {
            const renderPage = (pageNum) => {
                pdf.getPage(pageNum).then((page) => {
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement("canvas");
                    const context = canvas.getContext("2d");
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    page.render({
                        canvasContext: context,
                        viewport: viewport,
                    }).promise.then(() => {
                        pdfContainer.appendChild(canvas);
                        if (pageNum < pdf.numPages) {
                            renderPage(pageNum + 1);
                        }
                    }).catch((error) => {
                        console.error(`Error rendering page ${pageNum}:`, error);
                    });
                    page.getTextContent().then((textContent) => {
                        let text = textContent.items.map(item => item.str).join(' ');
                        extractedTextByPage[pageNum] = text;
                    }).catch((error) => {
                        console.error(`Error extracting text from page ${pageNum}:`, error);
                    });
                }).catch((error) => {
                    console.error(`Error fetching page ${pageNum}:`, error);
                });
            };
            renderPage(1);
        }).catch((error) => {
            console.error("Error loading PDF:", error);
        });

        const responses = {
            en: {
                noContent: "No relevant content found. Please rephrase your question.",
                error: "Sorry, there was an error getting a response.",
                initialMessages: [
                    "Hi there! Need any help with the content on this page?",
                    "Hello! How can I assist you with this page?",
                    "Hey! Do you have any questions about what you're reading?",
                    "Greetings! Is there something you'd like to know more about?",
                    "Hi! Need any clarification on this topic?"
                ]
            },
            tr: {
                noContent: "İlgili içerik bulunamadı. Lütfen sorunuzu yeniden ifade edin.",
                error: "Üzgünüz, yanıt alınırken bir hata oluştu.",
                initialMessages: [
                    "Merhaba! Bu sayfadaki içerikle ilgili yardıma mı ihtiyacınız var?",
                    "Merhaba! Bu sayfada size nasıl yardımcı olabilirim?",
                    "Merhaba! Okuduğunuz konuyla ilgili herhangi bir sorunuz var mı?",
                    "Selamlar! Bilmek istediğiniz bir şey var mı?",
                    "Merhaba! Bu konuda herhangi bir açıklama yapmamı ister misiniz?"
                ]
            }
        };
        function getResponses(language) {
            return responses[language] || responses.en; // Fallback to English if language is not supported
        }
        const chatResponses = getResponses(language);
        function displayMessage(message, className) {
            const chatMessages = document.getElementById("chat-messages");
            const messageElement = document.createElement("div");
            messageElement.classList.add("chat-message", className);
            messageElement.innerHTML = message;
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }
        function displayInitialMessage() {
            const initialMessages = chatResponses.initialMessages;
            const initialMessage = initialMessages[Math.floor(Math.random() * initialMessages.length)];
            displayMessage(initialMessage, 'response-message');
        }
        chatIcon.addEventListener("click", () => {
            chatContainer.classList.toggle("hidden");
            if (isFirstMessage) {
                displayInitialMessage();
                isFirstMessage = false;
            }
        });

        // Trigger the click event automatically when the page is loaded
        chatIcon.dispatchEvent(new MouseEvent('click'));

        // Predefined responses for small talk and greetings
        const predefinedResponses = {
            "hello": "Hello! How can I assist you?",
            "hey": "Hello! How can I assist you?",
            "hi": "Hi there! What would you like to know?",
            "how are you": "I'm just a chatbot, but I'm here to help you!",
            "good morning": "Good morning! What can I do for you?",
            "good evening": "Good evening! Need any assistance?",
            "what's up": "Not much, just here to help you with your queries!"
        };

        function getPredefinedResponse(userInput) {
            const normalizedInput = userInput.toLowerCase().trim();
            return predefinedResponses[normalizedInput] || null;
        }
        // Store the conversation history in a local array
        let conversationHistory = [];

        // chatSubmit.addEventListener("click", async () => {
        //     const userInput = document.getElementById("chat-textarea").value.trim();

        //     if (userInput !== "") {
        //         displayMessage(userInput, 'user-message');
        //         document.getElementById("chat-textarea").value = "";

        //         // Add user's input to conversation history
        //         conversationHistory.push({ role: 'user', content: userInput });

        //         setTimeout(async () => {
        //             try {
        //                 // Check for predefined response first
        //                 const predefinedResponse = getPredefinedResponse(userInput);
        //                 if (predefinedResponse) {
        //                      displayMessage(predefinedResponse, 'response-message');
        //                      conversationHistory.push({ role: 'assistant', content: predefinedResponse });
        //                     return;
        //                 }
        //                 // Search for the query in the extracted text
        //                 const matchedSection = searchForQuery(userInput, extractedTextByPage);
        //                 console.log("Matched Section:", matchedSection); // Add this line to log matchedSection

        //                 let responseMessage; //


        //                 if (!matchedSection) {
        //                     const responseMessage = translations['no-relevant-content'] || "I couldn't find relevant content from the document.";
        //                     displayMessage(responseMessage, 'response-message');
        //                     conversationHistory.push({ role: 'assistant', content: responseMessage });
        //                     return;
        //                 }

        //                 const responseMessage = await generateResponse(userInput, matchedSection, conversationHistory);
        //                 const formattedResponse = formatResponse(responseMessage);
        //                 displayMessage(formattedResponse, 'response-message');

        //                 // Save AI response to conversation history
        //                 conversationHistory.push({ role: 'assistant', content: responseMessage });

        //             } catch (error) {
        //                 const errorMessage = translations['error-response'] || "Sorry, there was an error getting a response.";
        //                 displayMessage(errorMessage, 'response-message');
        //                 conversationHistory.push({ role: 'assistant', content: errorMessage });
        //             }
        //         }, 1000);
        //     } else {
        //         alert(translations['empty-message-alert'] || "Please enter a message.");
        //     }
        //     console.log("Conversation History:", conversationHistory);
        // });

        chatSubmit.addEventListener("click", async () => { 
            const userInput = document.getElementById("chat-textarea").value.trim();
        
            if (userInput !== "") {
                displayMessage(userInput, 'user-message');
                document.getElementById("chat-textarea").value = "";
        
                // Add user's input to conversation history
                conversationHistory.push({ role: 'user', content: userInput });
        
                setTimeout(async () => {
                    try {
                        // Check for predefined response first
                        const predefinedResponse = getPredefinedResponse(userInput);
                        if (predefinedResponse) {
                            displayMessage(predefinedResponse, 'response-message');
                            conversationHistory.push({ role: 'assistant', content: predefinedResponse });
                            return;
                        }
        
                        // Search for relevant PDF content
                        const matchedSection = searchForQuery(userInput, extractedTextByPage);
                        console.log("Matched Section:", matchedSection); 
        
                        let responseMessage;
                        
                        if (matchedSection) {
                            // Found relevant PDF content
                            responseMessage = await generateResponse(userInput, matchedSection, conversationHistory);
                        } else {
                            // No relevant content found, but continue the conversation
                            console.log("No matched section found, using conversation history...");
                            responseMessage = await generateResponse(userInput, null, conversationHistory);
                        }
        
                        // Format & display response
                        const formattedResponse = formatResponse(responseMessage);
                        displayMessage(formattedResponse, 'response-message');
        
                        // Save AI response to conversation history
                        conversationHistory.push({ role: 'assistant', content: responseMessage });
        
                    } catch (error) {
                        const errorMessage = translations['error-response'] || "Sorry, there was an error getting a response.";
                        displayMessage(errorMessage, 'response-message');
                        conversationHistory.push({ role: 'assistant', content: errorMessage });
                    }
                }, 1000);
            } else {
                alert(translations['empty-message-alert'] || "Please enter a message.");
            }
            console.log("Conversation History:", conversationHistory);
        });
        

        async function generateResponse(message, matchedSection, conversationHistory) {
            try {
                const response = await fetch('/generate-response?pdfName=' + window.pdfName, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ prompt: message, matchedSection, conversationHistory })
                });
                if (!response.ok) {
                    const errorResponse = await response.json(); // Get the error response body
                    console.error(`Error response: ${response.status} ${response.statusText}`, errorResponse);
                    throw new Error(`Server responded with ${response.status}`);
                }
                const data = await response.json();
                return data.reply;
            } catch (error) {
                console.error('Fetch error:', error);
                throw error;
            }
        }

        function searchForQuery(query, textByPage) {
            const cleanQueryString = cleanQuery(query);
            console.log("Searching for cleaned query:", cleanQueryString);

            if (!cleanQueryString) {
                console.log("Query is empty after cleaning.");
                return null;
            }

            const queryLower = cleanQueryString.toLowerCase();
            let bestMatch = '';
            let highestScore = 0;
            let bestPage = null;

            Object.keys(textByPage).forEach(pageNum => {
                const text = textByPage[pageNum];
                const sentences = text.split(/(?<=[.!?-])\s+/);

                sentences.forEach((sentence, index) => {
                    const sentenceLower = sentence.toLowerCase();

                    const words = queryLower.split(' ');
                    let score = 0;

                    words.forEach(word => {
                        const wordCount = (sentenceLower.match(new RegExp(`\\b${word}\\b`, 'g')) || []).length;
                        score += isNaN(word) ? wordCount * 1.5 : wordCount;
                    });

                    if (score > highestScore) {
                        highestScore = score;
                        bestMatch = sentence;
                        bestPage = pageNum;

                        const contextBefore = sentences.slice(Math.max(0, index - 2), index).join(' ');
                        const contextAfter = sentences.slice(index + 1, index + 3).join(' ');
                        bestMatch = `${contextBefore} ${sentence} ${contextAfter}`;
                    }
                });
            });

            console.log("Best match:", bestMatch);
            console.log("Highest score:", highestScore);
            console.log("Best page:", bestPage);

            return highestScore > 0 ? { text: bestMatch, page: bestPage } : null;
        }

        const stopWords = [
            "the", "are", "buy", "im", "what", "is", "in", "at", "of", "and", "a", "to", "for", "on", "with", "as", "by", "or", "why", "it", "this",
            "i", "me", "my", "we", "our", "you", "your", "he", "his", "she", "her", "they", "them", "their", "which", "that", "these", "those", "there", "here",
            "has", "have", "had", "do", "does", "did", "be", "been", "being", "will", "shall", "can", "could", "may", "might", "should", "would", "must",
            "-", ",", ".", "+", "!", "`", "~", "?", ":", ";", "(", ")", "[", "]", "{", "}", "|", "\\", "/", "<", ">", "&", "#", "$", "%", "^", "*", "_", "=", "'", "\"", "@"
        ];

        function removeStopWords(query) {
            const words = query.split(/\s+/);
            return words.filter(word => !stopWords.includes(word.toLowerCase())).join(' ');
        }

        function cleanQuery(query) {
            // Remove symbols and punctuation
            const cleanedQuery = query.replace(/[^\w\s]/gi, '').replace(/\s+/g, ' ').trim();
            return removeStopWords(cleanedQuery);
        }

        function formatResponse(response) {
            let formatted = response.replace(/(\.|\?|!)([A-Za-z])/g, '$1 $2');
            formatted = formatted.split(/(?<=[.!?])\s+/).map(sentence => {
                sentence = sentence.trim();
                let words = sentence.split(' ');
                let firstFewWords = words.slice(0, 5).join(' ');
                if (/^[A-Z]/.test(sentence) && !/^.{0,25}:/.test(firstFewWords)) {
                    return `\n\n<p>${sentence}</p>\n\n`;
                }

                return `${sentence}. `;
            }).join('');

            return formatted.trim();
        }
    } else {
        console.error("pdfjsLib is not defined. PDF.js library may not be loaded correctly.");
    }
    const chatCloseButton = document.getElementById("chat-close");
    chatCloseButton.addEventListener('click', () => {
        chatContainer.classList.add('hidden');
    });
});
