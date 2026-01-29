import { GoogleGenerativeAI } from "@google/generative-ai";

  // API Keys (Replace with your actual keys)
  const GEMINI_API_KEY = "YOUR_GEMINI_API_KEY";
  const GROQ_API_KEY = "YOUR_GROQ_API_KEY";

  // Parenting-specific instructions
  const parentingInfo = `
    Parenting Assistant Instructions:
    - You are NurtureAI, a warm, empathetic, and expert parenting assistant.
    - Begin with empathy, e.g., "I know how challenging this can be!" or "You're doing amazing!"
    - Provide concise (50-100 words), step-by-step advice on topics like parenting, child development, sleep, nutrition, behavior, milestones, tantrums, discipline, potty training, sibling rivalry, and communication.
    - Include a practical example in each response, e.g., "Try this: sing a lullaby, then dim the lights for bedtime."
    - Tailor advice to the child's age if provided (e.g., 0-1, 1-3 years); if not, ask gently, e.g., "How old is your little one?"
    - Use simple, friendly language, avoiding jargon. Explain terms if needed, e.g., "A milestone is a skill like crawling."
    - Suggest professional help for serious issues, e.g., "For persistent issues, a pediatrician can guide you."
    - End with encouragement, e.g., "You've got this! Want more tips?"
    - Example: "Tantrums are tough! Try staying calm, get to their level, and offer a hug. For example, say, 'I see you're upset, let's breathe together.' This worked for my friend’s 2-year-old. You've got this!"
  `;

  // Initialize Gemini API
  let genAI, geminiModel;
  try {
    genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({ 
      model: "gemini-1.5-pro",
      systemInstruction: parentingInfo
    });
  } catch (error) {
    console.error("Gemini API Initialization Error:", error);
  }

  // Maintain conversation history and saved tips
  let messagesHistory = { gemini: [], groq: [] };
  let savedTips = JSON.parse(localStorage.getItem('savedTips') || '[]');
  let userMood = '';
  let childAge = '';
  let selectedModel = 'gemini'; // Default model

  // Helper function to update progress bar
  function updateProgressBar(progress) {
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
      progressBar.style.width = `${progress}%`;
    }
  }

  // Helper function to get related suggestions based on user message
  function getRelatedSuggestions(message) {
    const lowerMsg = message.toLowerCase();
    if (lowerMsg.includes('sleep') || lowerMsg.includes('bedtime')) {
      return ['Nighttime routines?', 'Nap schedules?', 'Sleep regression?'];
    } else if (lowerMsg.includes('eat') || lowerMsg.includes('food')) {
      return ['Picky eater tips?', 'Meal planning?', 'Healthy snacks?'];
    } else if (lowerMsg.includes('tantrum') || lowerMsg.includes('behavior')) {
      return ['Calming techniques?', 'Discipline ideas?', 'Sibling conflicts?'];
    } else {
      return ['Milestones?', 'Potty training?', 'Parenting stress?'];
    }
  }

  // Helper function to add messages to the chat
  function addMessage(text, sender, relatedSuggestions = []) {
    const messagesDiv = document.getElementById('chatMessages');
    if (!messagesDiv) {
      console.error("Chat messages container not found");
      return;
    }
    const messageContainer = document.createElement('div');
    messageContainer.className = `message-bubble ${sender === 'user' ? 'user' : 'bot'}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = sender === 'user' ? '<i class="fas fa-user text-orange-600"></i>' : '<i class="fas fa-heart text-orange-600"></i>';
    const msgContent = document.createElement('div');
    msgContent.className = `message-content ${sender === 'user' ? 'user' : 'bot'}`;
    msgContent.innerHTML = text + `<div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
    
    if (sender === 'bot' && relatedSuggestions.length) {
      const suggestionsDiv = document.createElement('div');
      suggestionsDiv.className = 'related-suggestions';
      relatedSuggestions.forEach(suggestion => {
        const btn = document.createElement('button');
        btn.textContent = suggestion;
        btn.setAttribute('aria-label', `Ask about ${suggestion}`);
        suggestionsDiv.appendChild(btn);
      });
      msgContent.appendChild(suggestionsDiv);
    }

    if (sender === 'bot') {
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      actionsDiv.innerHTML = `
        <button class="save-tip" aria-label="Save this tip"><i class="fas fa-bookmark"></i></button>
        <button class="share-tip" aria-label="Share this tip"><i class="fas fa-share"></i></button>
      `;
      msgContent.appendChild(actionsDiv);
    }

    messageContainer.appendChild(sender === 'user' ? msgContent : avatar);
    messageContainer.appendChild(sender === 'user' ? avatar : msgContent);
    messagesDiv.appendChild(messageContainer);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }

  // Save tip to localStorage
  function saveTip(text) {
    savedTips.push({ text, timestamp: new Date().toISOString() });
    localStorage.setItem('savedTips', JSON.stringify(savedTips));
    addMessage('Tip saved! Check it in Saved Tips.', 'bot');
  }

  // Share tip using Web Share API
  function shareTip(text) {
    if (navigator.share) {
      navigator.share({
        title: 'NurtureAI Parenting Tip',
        text: text,
        url: window.location.href
      }).catch(() => addMessage('Sharing not supported on this device.', 'bot'));
    } else {
      addMessage('Copy this tip: ' + text, 'bot');
    }
  }

  // Send message using selected model
  async function sendMessage(userMessage, retry = false) {
    if (!navigator.onLine) {
      const lastResponse = JSON.parse(localStorage.getItem('lastResponse') || '{}');
      if (lastResponse.question && lastResponse.answer) {
        addMessage(`You're offline! Here's your last tip:<br><strong>${lastResponse.question}</strong><br>${lastResponse.answer}`, 'bot');
      } else {
        addMessage('You’re offline and no tips are cached. Connect to ask more!', 'bot');
      }
      return;
    }

    const context = childAge ? `Child's age: ${childAge}. ` : '';
    const moodContext = userMood ? `Parent's mood: ${userMood}. ` : '';
    const fullMessage = `${context}${moodContext}${userMessage}`;
    addMessage(userMessage, 'user');
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
      typingIndicator.classList.remove('hidden');
    }
    let progress = 0;
    updateProgressBar(progress);

    try {
      let accumulatedText = '';
      const messagesDiv = document.getElementById('chatMessages');
      const botContainer = document.createElement('div');
      botContainer.className = 'message-bubble bot';
      const botAvatar = document.createElement('div');
      botAvatar.className = 'message-avatar';
      botAvatar.innerHTML = '<i class="fas fa-heart text-orange-600"></i>';
      const botMessageDiv = document.createElement('div');
      botMessageDiv.className = 'message-content bot';
      botContainer.appendChild(botAvatar);
      botContainer.appendChild(botMessageDiv);
      messagesDiv.appendChild(botContainer);
      messagesDiv.scrollTop = messagesDiv.scrollHeight;

      if (selectedModel === 'gemini' && geminiModel) {
        const chat = geminiModel.startChat({ history: messagesHistory.gemini });
        let result = await chat.sendMessageStream(fullMessage);

        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          accumulatedText += chunkText;
          botMessageDiv.innerHTML = accumulatedText + `<div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
          progress += 10;
          updateProgressBar(Math.min(progress, 100));
        }

        messagesHistory.gemini.push({ role: 'user', parts: [{ text: fullMessage }] });
        messagesHistory.gemini.push({ role: 'model', parts: [{ text: accumulatedText }] });
      } else if (selectedModel === 'groq') {
        const messages = [
          { role: 'system', content: parentingInfo },
          ...messagesHistory.groq,
          { role: 'user', content: fullMessage }
        ];

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`
          },
          body: JSON.stringify({
            messages,
            model: 'llama3-70b-8192',
            temperature: 0.7,
            max_tokens: 1024,
            stream: true
          })
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
          for (const line of lines) {
            if (line === 'data: [DONE]') continue;
            try {
              const json = JSON.parse(line.replace('data: ', ''));
              const chunkText = json.choices[0]?.delta?.content || '';
              accumulatedText += chunkText;
              botMessageDiv.innerHTML = accumulatedText + `<div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
              messagesDiv.scrollTop = messagesDiv.scrollHeight;
              progress += 10;
              updateProgressBar(Math.min(progress, 100));
            } catch (e) {
              console.warn("Error parsing chunk:", e);
            }
          }
        }

        messagesHistory.groq.push({ role: 'user', content: fullMessage });
        messagesHistory.groq.push({ role: 'assistant', content: accumulatedText });
      } else {
        throw new Error("Selected model is not initialized");
      }

      const relatedSuggestions = getRelatedSuggestions(userMessage);
      botMessageDiv.innerHTML = accumulatedText + `<div class="message-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
      if (relatedSuggestions.length) {
        const suggestionsDiv = document.createElement('div');
        suggestionsDiv.className = 'related-suggestions';
        relatedSuggestions.forEach(suggestion => {
          const btn = document.createElement('button');
          btn.textContent = suggestion;
          btn.setAttribute('aria-label', `Ask about ${suggestion}`);
          suggestionsDiv.appendChild(btn);
        });
        botMessageDiv.appendChild(suggestionsDiv);
      }

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'message-actions';
      actionsDiv.innerHTML = `
        <button class="save-tip" aria-label="Save this tip"><i class="fas fa-bookmark"></i></button>
        <button class="share-tip" aria-label="Share this tip"><i class="fas fa-share"></i></button>
      `;
      botMessageDiv.appendChild(actionsDiv);

      // Cache response
      localStorage.setItem('lastResponse', JSON.stringify({ question: userMessage, answer: accumulatedText }));
    } catch (error) {
      console.error("Send Message Error:", error);
      if (!retry) {
        return sendMessage(userMessage, true);
      }
      addMessage("Sorry, something went wrong. Try again or check your saved tips!", 'bot');
    }
    if (typingIndicator) {
      typingIndicator.classList.add('hidden');
    }
    updateProgressBar(0);
  }

  // Initialize the chatbot
  function initChatbot() {
    const chatModal = document.getElementById('chatModal');
    const chatButton = document.getElementById('chatButton');
    const closeChat = document.getElementById('closeChat');
    const sendButton = document.getElementById('sendButton');
    const userInput = document.getElementById('userInput');
    const feedbackButton = document.getElementById('feedbackButton');
    const childAgeSelect = document.getElementById('childAge');
    const moodButton = document.getElementById('moodButton');
    const savedTipsButton = document.getElementById('savedTipsButton');
    const clearChatButton = document.getElementById('clearChatButton');

    if (!chatButton || !chatModal) {
      console.error("Chat button or modal not found in DOM");
      return;
    }

    // Add model selection dropdown
    const modelSelect = document.createElement('select');
    modelSelect.id = 'modelSelect';
    modelSelect.setAttribute('aria-label', 'Select AI model');
    modelSelect.innerHTML = `
      <option value="gemini">Gemini</option>
      <option value="groq">Groq</option>
    `;
    const toolbar = document.querySelector('.chat-toolbar');
    if (toolbar) {
      toolbar.prepend(modelSelect);
    } else {
      console.error("Chat toolbar not found");
    }

    // Toggle chat modal
    chatButton.addEventListener('click', () => {
      console.log("Chat button clicked");
      if (chatModal) {
        chatModal.classList.add('active');
        if (userInput) {
          userInput.focus();
        }
      } else {
        console.error("Chat modal not found");
      }
    });

    if (closeChat) {
      closeChat.addEventListener('click', () => {
        console.log("Close chat clicked");
        chatModal.classList.remove('active');
      });
    }

    // Focus trapping
    chatModal.addEventListener('focusin', (e) => {
      if (!chatModal.contains(e.target)) {
        userInput.focus();
      }
    });

    // Swipe to close on mobile
    let touchStartX = 0;
    chatModal.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    });
    chatModal.addEventListener('touchend', e => {
      const touchEndX = e.changedTouches[0].clientX;
      if (touchStartX - touchEndX > 100) {
        chatModal.classList.remove('active');
      }
    });

    // Send message
    if (sendButton) {
      sendButton.addEventListener('click', () => {
        const message = userInput.value.trim();
        if (!message) return;
        userInput.value = '';
        sendMessage(message);
      });
    }

    if (userInput) {
      userInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
          const message = userInput.value.trim();
          if (!message) return;
          userInput.value = '';
          sendMessage(message);
        }
      });
    }

    // Model selection
    if (modelSelect) {
      modelSelect.addEventListener('change', () => {
        selectedModel = modelSelect.value;
        addMessage(`Switched to ${selectedModel === 'gemini' ? 'Gemini' : 'Groq'} model. How can I assist you now?`, 'bot');
      });
    }

    // Child age selection
    if (childAgeSelect) {
      childAgeSelect.addEventListener('change', () => {
        childAge = childAgeSelect.value;
        if (childAge) {
          addMessage(`Got it! I'll tailor tips for your ${childAge}-year-old.`, 'bot');
        }
      });
    }

    // Mood selection
    if (moodButton) {
      moodButton.addEventListener('click', () => {
        const mood = prompt('How are you feeling today? (e.g., Happy, Tired, Stressed)');
        if (mood) {
          userMood = mood;
          addMessage(`Thanks for sharing—you're feeling ${mood.toLowerCase()}. I'm here to help!`, 'bot');
        }
      });
    }

    // Saved tips
    if (savedTipsButton) {
      savedTipsButton.addEventListener('click', () => {
        if (!savedTips.length) {
          addMessage("No tips saved yet. Save some advice you love!", 'bot');
          return;
        }
        const tipsText = savedTips.map((tip, i) => `${i + 1}. ${tip.text} (${new Date(tip.timestamp).toLocaleDateString()})`).join('<br>');
        addMessage(`Your Saved Tips:<br>${tipsText}`, 'bot');
      });
    }

    // Clear chat
    if (clearChatButton) {
      clearChatButton.addEventListener('click', () => {
        messagesHistory[selectedModel] = [];
        document.getElementById('chatMessages').innerHTML = '';
        addMessage("Fresh start! What's on your mind?", 'bot');
      });
    }

    // Feedback
    if (feedbackButton) {
      feedbackButton.addEventListener('click', () => {
        const feedback = prompt('How can NurtureAI improve for you?');
        if (feedback) {
          addMessage('Thank you for your feedback!', 'bot');
        }
      });
    }

    // Event delegation for suggestions
    const chatMessages = document.getElementById('chatMessages');
    if (chatMessages) {
      chatMessages.addEventListener('click', (e) => {
        if (e.target.closest('.related-suggestions button')) {
          const message = e.target.textContent;
          userInput.value = '';
          sendMessage(message);
        }
        if (e.target.closest('.save-tip')) {
          const text = e.target.closest('.message-content').childNodes[0].textContent;
          saveTip(text);
        }
        if (e.target.closest('.share-tip')) {
          const text = e.target.closest('.message-content').childNodes[0].textContent;
          shareTip(text);
        }
      });
    }
  }

  // Hero Carousel Logic
  function initCarousel() {
    const images = document.querySelectorAll('.carousel-image');
    const dots = document.querySelectorAll('.carousel-dot');
    let currentIndex = 0;

    function showImage(index) {
      images.forEach((img, i) => {
        img.classList.toggle('active', i === index);
        dots[i].classList.toggle('active', i === index);
      });
    }

    function nextImage() {
      currentIndex = (currentIndex + 1) % images.length;
      showImage(currentIndex);
    }

    dots.forEach((dot, i) => {
      dot.addEventListener('click', () => {
        currentIndex = i;
        showImage(i);
      });
    });

    setInterval(nextImage, 5000);

    let touchStartX = 0;
    const carousel = document.querySelector('.hero-carousel');
    carousel.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
    });
    carousel.addEventListener('touchend', e => {
      const touchEndX = e.changedTouches[0].clientX;
      if (touchStartX - touchEndX > 50) {
        nextImage();
      } else if (touchEndX - touchStartX > 50) {
        currentIndex = (currentIndex - 1 + images.length) % images.length;
        showImage(currentIndex);
      }
    });
  }

  // Initialize components
  document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded, initializing components");
    try {
      initChatbot();
      initCarousel();
    } catch (error) {
      console.error("Initialization Error:", error);
    }
  });
