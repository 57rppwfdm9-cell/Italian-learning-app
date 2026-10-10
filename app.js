const practiceSteps = [
  {
    prompt: "Buongiorno! Cosa prende?",
    translation: "Good morning! What would you like?",
    answers: [
      { text: "Un cappuccino, per favore.", translation: "A cappuccino, please.", correct: true },
      { text: "Mi chiamo Fenicia.", translation: "My name is Fenicia.", correct: false },
      { text: "Dov'è la stazione?", translation: "Where is the station?", correct: false },
    ],
  },
  {
    prompt: "Certo! Vuole anche qualcosa da mangiare?",
    translation: "Of course! Would you also like something to eat?",
    answers: [
      { text: "Sì, un cornetto, grazie.", translation: "Yes, a croissant, thanks.", correct: true },
      { text: "Sono di Londra.", translation: "I'm from London.", correct: false },
      { text: "Il conto, per favore.", translation: "The bill, please.", correct: false },
    ],
  },
  {
    prompt: "Sono quattro euro. Paga in contanti o con carta?",
    translation: "That's four euros. Are you paying cash or by card?",
    answers: [
      { text: "Con carta, grazie.", translation: "By card, thanks.", correct: true },
      { text: "Un tavolo per due.", translation: "A table for two.", correct: false },
      { text: "Piacere di conoscerti.", translation: "Nice to meet you.", correct: false },
    ],
  },
];

const modal = document.querySelector("#practiceModal");
const promptText = document.querySelector("#italianPrompt");
const translation = document.querySelector("#translation");
const answerList = document.querySelector("#answerList");
const feedback = document.querySelector("#feedback");
const isLocalApp = ["localhost", "127.0.0.1"].includes(window.location.hostname);
const speechApiBaseUrl = window.PARLA_SPEECH_API_URL
  || (isLocalApp ? "" : "https://fenicia-italian-guide-speech.onrender.com");
const nextButton = document.querySelector("#nextStep");
const stepCount = document.querySelector("#stepCount");
const stepProgress = document.querySelector("#stepProgress");
const practiceTitle = document.querySelector("#practiceTitle");
const scenario = document.querySelector(".scenario");
let currentStep = 0;
let activeSteps = practiceSteps;
let selectedAnswer = null;
let checkedAnswer = false;

document.querySelector(".welcome-row .eyebrow").textContent =
  new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" })
    .format(new Date())
    .toUpperCase();

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2300);
}

function renderStep() {
  const step = activeSteps[currentStep];
  selectedAnswer = null;
  checkedAnswer = false;
  promptText.textContent = step.prompt;
  translation.textContent = step.translation;
  stepCount.textContent = `${currentStep + 1} / ${activeSteps.length}`;
  stepProgress.style.width = `${((currentStep + 1) / activeSteps.length) * 100}%`;
  feedback.textContent = "";
  feedback.classList.remove("error");
  nextButton.disabled = true;
  nextButton.innerHTML = 'Check answer <span>→</span>';
  answerList.replaceChildren(...step.answers.map((answer, index) => {
    const choice = document.createElement("button");
    choice.className = "answer-choice";
    choice.type = "button";
    choice.textContent = answer.text;
    choice.setAttribute("aria-label", `${answer.text} ${answer.translation}`);
    choice.addEventListener("click", () => {
      if (checkedAnswer) return;
      selectedAnswer = index;
      answerList.querySelectorAll(".answer-choice").forEach((item) => item.classList.remove("selected"));
      choice.classList.add("selected");
      nextButton.disabled = false;
      feedback.textContent = answer.translation;
      feedback.classList.remove("error");
    });
    return choice;
  }));
}

function openPractice(options = {}) {
  activeSteps = options.steps || practiceSteps;
  currentStep = 0;
  practiceTitle.textContent = options.title || "Al bar";
  scenario.textContent = options.scenario || "You’re ordering a coffee at a little café in Rome.";
  renderStep();
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.querySelector("#closePractice").focus();
}

function closePractice() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.querySelector("#startPractice").focus();
}

async function speakItalian(text, button) {
  button.disabled = true;
  try {
    const response = await fetch(`${speechApiBaseUrl}/api/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      let message = `Speech service returned an error (${response.status}).`;
      try {
        const result = await response.json();
        if (typeof result.error === "string") message = result.error;
      } catch {
        throw new Error(message);
      }
      throw new Error(message);
    }

    const audioUrl = URL.createObjectURL(await response.blob());
    const audio = new Audio(audioUrl);
    audio.addEventListener("ended", () => URL.revokeObjectURL(audioUrl), { once: true });
    audio.addEventListener("error", () => URL.revokeObjectURL(audioUrl), { once: true });
    await audio.play();
  } catch (error) {
    if (!("speechSynthesis" in window)) {
      showToast(`OpenAI voice unavailable: ${error.message}`);
      return;
    }

    try {
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise((resolve) => {
          const timeout = window.setTimeout(resolve, 1200);
          window.speechSynthesis.addEventListener("voiceschanged", () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
        voices = window.speechSynthesis.getVoices();
      }

      const italianVoices = voices.filter((voice) => voice.lang.toLowerCase().startsWith("it"));
      const preferredVoice = italianVoices.find((voice) => /alice|federica|paola|lucia|serena|sofia|vittoria|bianca|elsa|francesca/i.test(voice.name))
        || italianVoices.find((voice) => /natural|enhanced|premium/i.test(voice.name))
        || italianVoices[0];
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "it-IT";
      utterance.rate = 0.9;
      utterance.pitch = 1.06;
      if (preferredVoice) utterance.voice = preferredVoice;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
      showToast(/quota|billing/i.test(error.message)
        ? "Nova is unavailable; check OpenAI billing and usage."
        : "Nova is unavailable; using your device’s Italian voice.");
    } catch {
      showToast(`Speech unavailable: ${error.message}`);
    }
  } finally {
    button.disabled = false;
  }
}

document.querySelector("#startPractice").addEventListener("click", openPractice);
document.querySelector("#closePractice").addEventListener("click", closePractice);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closePractice();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && modal.classList.contains("open")) closePractice();
});

nextButton.addEventListener("click", () => {
  if (selectedAnswer === null) return;
  if (!checkedAnswer) {
    checkedAnswer = true;
    const answer = activeSteps[currentStep].answers[selectedAnswer];
    answerList.querySelectorAll(".answer-choice").forEach((choice, index) => {
      choice.disabled = true;
      if (activeSteps[currentStep].answers[index].correct) choice.classList.add("correct");
      else if (index === selectedAnswer) choice.classList.add("incorrect");
    });
    if (answer.correct) {
      feedback.textContent = "Perfetto! That’s exactly right.";
      feedback.classList.remove("error");
    } else {
      feedback.textContent = "Not quite — the highlighted answer is the natural reply.";
      feedback.classList.add("error");
    }
    nextButton.innerHTML = currentStep === activeSteps.length - 1
      ? 'Finish practice <span>✓</span>'
      : 'Next question <span>→</span>';
    return;
  }
  if (currentStep < activeSteps.length - 1) {
    currentStep += 1;
    renderStep();
  } else {
    closePractice();
    showToast("Bravissima! Practice complete — 3 phrases reviewed.");
  }
});

document.querySelector("#speakPrompt").addEventListener("click", () => {
  speakItalian(promptText.textContent, document.querySelector("#speakPrompt"));
});

document.querySelectorAll("[data-speak]").forEach((button) => {
  button.addEventListener("click", () => {
    speakItalian(button.dataset.speak, button);
  });
});

document.querySelector("#saveWord").addEventListener("click", (event) => {
  event.currentTarget.innerHTML = "<span>✓</span> Added to my words";
  showToast("“Passeggiata” saved to your vocabulary.");
});

document.querySelector("#reviewWords").addEventListener("click", () => {
  setActivePage("vocabulary");
  window.location.hash = "vocabulary";
});

document.querySelector("#goalButton").addEventListener("click", () => {
  showToast("8 more minutes to reach your daily goal!");
});

document.querySelectorAll("[data-lesson]").forEach((button) => {
  button.addEventListener("click", () => {
    openPractice({
      title: button.dataset.lesson,
      scenario: "Practice introducing yourself in a friendly conversation.",
      steps: [
        {
          prompt: "Ciao! Come ti chiami?",
          translation: "Hi! What’s your name?",
          answers: [
            { text: "Mi chiamo Fenicia.", translation: "My name is Fenicia.", correct: true },
            { text: "Un cappuccino, grazie.", translation: "A cappuccino, thanks.", correct: false },
            { text: "Il conto, per favore.", translation: "The bill, please.", correct: false },
          ],
        },
        {
          prompt: "Piacere! Di dove sei?",
          translation: "Nice to meet you! Where are you from?",
          answers: [
            { text: "Sono di Londra.", translation: "I’m from London.", correct: true },
            { text: "Mi chiamo Fenicia.", translation: "My name is Fenicia.", correct: false },
            { text: "Vorrei un caffè.", translation: "I’d like a coffee.", correct: false },
          ],
        },
        {
          prompt: "Parli italiano?",
          translation: "Do you speak Italian?",
          answers: [
            { text: "Un po’, sto imparando.", translation: "A little, I’m learning.", correct: true },
            { text: "Sono di Londra.", translation: "I’m from London.", correct: false },
            { text: "Buon appetito!", translation: "Enjoy your meal!", correct: false },
          ],
        },
      ],
    });
  });
});

const chatPage = document.querySelector("#chatPage");
const dashboardPage = document.querySelector("#dashboardPage");
const chatNav = document.querySelector("#chatNav");
const chatMessages = document.querySelector("#chatMessages");
const chatForm = document.querySelector("#chatForm");
const chatInput = document.querySelector("#chatInput");
const chatSuggestions = document.querySelector("#chatSuggestions");
const mobilePageTitle = document.querySelector("#mobilePageTitle");
const appPages = {
  dashboard: dashboardPage,
  chat: chatPage,
  sentences: document.querySelector("#sentencePage"),
  flashcards: document.querySelector("#flashcardsPage"),
  roleplays: document.querySelector("#roleplaysPage"),
  call: document.querySelector("#callPage"),
  lessons: document.querySelector("#lessonsPage"),
  vocabulary: document.querySelector("#vocabularyPage"),
};
const appNavItems = [...document.querySelectorAll(".nav-item")];
let activeChatTopic = null;
let scenarioTurn = 0;
let activePage = "dashboard";
const initialChatMessage = {
  text: "Ciao, Fenicia! Sono Giulia 😊\nParliamo in italiano. Come stai oggi?",
  translation: "Hi, Fenicia! I’m Giulia. Let’s speak Italian. How are you today?",
};
const chatScenarios = {
  restaurant: {
    opening: {
      text: "Buonasera! Avete una prenotazione?",
      translation: "Good evening! Do you have a reservation?",
    },
    replies: [
      {
        text: "Perfetto! Per quante persone? Preferite un tavolo dentro o fuori?",
        translation: "Perfect! For how many people? Would you prefer a table inside or outside?",
      },
      {
        text: "Ecco il menù. Che cosa desiderate ordinare?",
        translation: "Here is the menu. What would you like to order?",
      },
      {
        text: "Ottima scelta! Desiderate anche qualcosa da bere?",
        translation: "Great choice! Would you also like something to drink?",
      },
      {
        text: "Certo! “Il conto, per favore” means “The bill, please.” Bravissima!",
        translation: "You’ve finished ordering at the restaurant. Well done!",
      },
    ],
    correction: "Può consigliare un piatto tipico?",
  },
  hotel: {
    opening: {
      text: "Buonasera e benvenuta! Ha una prenotazione?",
      translation: "Good evening and welcome! Do you have a reservation?",
    },
    replies: [
      {
        text: "Benissimo. A che nome è la prenotazione?",
        translation: "Great. What name is the reservation under?",
      },
      {
        text: "Grazie, signora! Una camera singola o doppia?",
        translation: "Thank you! A single or double room?",
      },
      {
        text: "La colazione è inclusa. Ecco la chiave: la camera è al secondo piano.",
        translation: "Breakfast is included. Here is the key: your room is on the second floor.",
      },
      {
        text: "Di niente! Buon soggiorno e arrivederci!",
        translation: "You’re welcome! Enjoy your stay and goodbye!",
      },
    ],
    correction: "Ho una prenotazione a nome di Fenicia.",
  },
  tour: {
    opening: {
      text: "Benvenuta a Roma! Che cosa ti piacerebbe visitare oggi?",
      translation: "Welcome to Rome! What would you like to visit today?",
    },
    replies: [
      {
        text: "Bellissima scelta! Preferisci andare a piedi o prendere l’autobus?",
        translation: "Beautiful choice! Would you prefer to walk or take the bus?",
      },
      {
        text: "Va bene! Il Colosseo è a circa dieci minuti da qui.",
        translation: "All right! The Colosseum is about ten minutes from here.",
      },
      {
        text: "Certo! Gira a destra alla piazza e continua sempre dritto.",
        translation: "Of course! Turn right at the square and keep going straight.",
      },
      {
        text: "Prego! Buona visita e buona giornata!",
        translation: "You’re welcome! Enjoy your visit and have a lovely day!",
      },
    ],
    correction: "Vorrei visitare il Colosseo, per favore.",
  },
};

function setActivePage(page) {
  activePage = page;
  Object.entries(appPages).forEach(([name, element]) => {
    element.hidden = name !== page;
  });
  appNavItems.forEach((item) => {
    const isActive = item.getAttribute("href") === `#${page}`;
    item.classList.toggle("active", isActive);
    if (isActive) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
  });
  const titles = {
    dashboard: "Dashboard",
    chat: "Chat",
    sentences: "Sentence Mode",
    flashcards: "Flashcards",
    roleplays: "Roleplays",
    call: "Call Mode",
    lessons: "Lessons",
    vocabulary: "Vocabulary",
  };
  mobilePageTitle.textContent = titles[page];
}

function showChatMessage(text, isUser, correction = "") {
  const message = document.createElement("div");
  message.className = `chat-message${isUser ? " user" : ""}`;
  const avatar = document.createElement("span");
  avatar.className = "chat-message-avatar";
  avatar.textContent = isUser ? "F" : "G";

  const bubbleWrap = document.createElement("div");
  bubbleWrap.className = "chat-bubble-wrap";
  const bubble = document.createElement("div");
  bubble.className = "chat-bubble";
  bubble.textContent = text;
  bubbleWrap.append(bubble);

  if (correction) {
    const note = document.createElement("div");
    note.className = "chat-correction";
    const label = document.createElement("strong");
    label.textContent = "A natural way to say it: ";
    note.append(label, document.createTextNode(correction));
    bubbleWrap.append(note);
  }

  if (!isUser) {
    const tools = document.createElement("div");
    tools.className = "chat-message-tools";
    const speak = document.createElement("button");
    speak.className = "chat-speak";
    speak.type = "button";
    speak.textContent = "♫ Hear Italian";
    speak.addEventListener("click", () => speakItalian(text.split("\n")[0], speak));
    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = "Giulia";
    tools.append(speak, time);
    bubbleWrap.append(tools);
  } else {
    const time = document.createElement("span");
    time.className = "chat-time";
    time.textContent = "You";
    bubbleWrap.append(time);
  }

  message.append(avatar, bubbleWrap);
  chatMessages.append(message);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function getChatReply(message) {
  const normalized = message.toLocaleLowerCase("it").trim();
  if (activeChatTopic) {
    const scenario = chatScenarios[activeChatTopic];
    const reply = scenario.replies[Math.min(scenarioTurn, scenario.replies.length - 1)];
    scenarioTurn += 1;
    if (/\b(come si dice|non capisco|help|aiuto|correction|corregg)\b/.test(normalized)) {
      return {
        text: `Puoi dire: “${scenario.correction}”`,
        translation: `Try saying: “${scenario.correction}”`,
        correction: scenario.correction,
      };
    }
    return reply;
  }
  if (/\b(ciao|buongiorno|buonasera|salve)\b/.test(normalized)) {
    return {
      text: "Ciao! Piacere di parlare con te.\nCome ti chiami?",
      translation: "Hi! Nice to talk with you. What’s your name?",
    };
  }
  if (/\b(mi chiamo|my name is|sono fenicia)\b/.test(normalized)) {
    return {
      text: "Piacere, Fenicia! 😊\nDi dove sei?",
      translation: "Nice to meet you, Fenicia! Where are you from?",
    };
  }
  if (/\b(come stai|how are you|sto bene|bene grazie|sto male)\b/.test(normalized)) {
    return {
      text: "Che bello! Puoi anche dire: “Sto bene, grazie. E tu?”",
      translation: "Lovely! You can also say: “I’m well, thanks. And you?”",
    };
  }
  if (/\b(caff[eè]|ordinare|bar|coffee|order)\b/.test(normalized)) {
    return {
      text: "Ottima scelta! Al bar puoi dire:\n“Vorrei un caffè, per favore.”",
      translation: "Great choice! At a café you can say: “I’d like a coffee, please.”",
    };
  }
  if (/\b(buongiorno|meaning|significa|what does)\b/.test(normalized)) {
    return {
      text: "“Buongiorno” significa “good morning” o “good day”.\nPuoi rispondere: “Buongiorno!”",
      translation: "“Buongiorno” means “good morning” or “good day”. You can reply: “Buongiorno!”",
    };
  }
  if (/\b(fame|hungry)\b/.test(normalized) && /\b(io sono|i am)\b/.test(normalized)) {
    return {
      text: "Piccola correzione: in italiano diciamo “Ho fame”, non “Sono fame”.",
      translation: "A small correction: in Italian we say “I have hunger,” not “I am hunger.”",
      correction: "Ho fame.",
    };
  }
  if (/[?？]/.test(normalized) || /\b(what|how|where|why|meaning|significa)\b/.test(normalized)) {
    return {
      text: "Bella domanda! Scrivimi una parola o una frase in italiano e ti aiuto a capirla. 😊",
      translation: "Good question! Send me an Italian word or sentence and I’ll help you understand it.",
    };
  }
  return {
    text: "Molto bene! 😊\n“E tu?” significa “And you?” Prova a rispondermi con una frase semplice.",
    translation: "Very good! “E tu?” means “And you?” Try replying with a simple sentence.",
  };
}

function openChat() {
  setActivePage("chat");
  if (!chatMessages.childElementCount) {
    showChatMessage(initialChatMessage.text, false);
  }
  window.location.hash = "chat";
  chatInput.focus();
}

function openDashboard() {
  setActivePage("dashboard");
}

appNavItems.forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    const page = {
      "#dashboard": "dashboard",
      "#chat": "chat",
      "#sentences": "sentences",
      "#flashcards": "flashcards",
      "#roleplays": "roleplays",
      "#call": "call",
      "#lessons": "lessons",
      "#vocabulary": "vocabulary",
    }[item.getAttribute("href")];
    if (!page) return;
    setActivePage(page);
    window.location.hash = item.getAttribute("href").slice(1);
    if (page === "chat") {
      if (!chatMessages.childElementCount) showChatMessage(initialChatMessage.text, false);
      chatInput.focus();
    }
    if (page === "call") document.querySelector("#callTopic").focus();
  });
});

document.querySelectorAll("[data-chat-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    chatInput.value = button.dataset.chatPrompt;
    chatForm.requestSubmit();
  });
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = chatInput.value.trim();
  if (!message) return;
  showChatMessage(message, true);
  chatInput.value = "";
  chatInput.style.height = "auto";
  chatSuggestions.hidden = true;
  chatInput.focus();
  window.setTimeout(() => {
    const reply = getChatReply(message);
    showChatMessage(reply.text, false, reply.correction || "");
  }, 300);
});

chatInput.addEventListener("input", () => {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 100)}px`;
});

chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelector("#newChat").addEventListener("click", () => {
  chatMessages.replaceChildren();
  chatSuggestions.hidden = false;
  activeChatTopic = null;
  scenarioTurn = 0;
  document.querySelectorAll("[data-chat-topic]").forEach((button) => button.classList.remove("active"));
  showChatMessage(initialChatMessage.text, false);
  chatInput.value = "";
  chatInput.focus();
});

document.querySelectorAll("[data-chat-topic]").forEach((button) => {
  button.addEventListener("click", () => {
    activeChatTopic = button.dataset.chatTopic;
    scenarioTurn = 0;
    chatSuggestions.hidden = false;
    chatMessages.replaceChildren();
    document.querySelectorAll("[data-chat-topic]").forEach((topicButton) => {
      const isActive = topicButton === button;
      topicButton.classList.toggle("active", isActive);
      topicButton.setAttribute("aria-pressed", String(isActive));
    });
    const opening = chatScenarios[activeChatTopic].opening;
    showChatMessage(`${opening.text}\n\nTip: ask for help or a correction at any time.`, false);
    chatInput.focus();
  });
});

const sentenceLessons = {
  basics: {
    kicker: "LESSON 1 · SENTENCE BASICS",
    questions: [
      {
        question: "How do you say “I am Fenicia” in Italian?",
        hint: "Tip: “I am” is “Io sono”.",
        answers: ["Io sono Fenicia.", "Io Fenicia sono.", "Sono io di Fenicia."],
        correct: 0,
        explanation: "In a simple Italian sentence, the subject usually comes before the verb: “Io sono Fenicia.”",
      },
      {
        question: "Choose the natural way to say “I speak Italian”.",
        hint: "Tip: “to speak” is “parlare”.",
        answers: ["Io parlo italiano.", "Io italiano parla.", "Parlare io italiano."],
        correct: 0,
        explanation: "“Parlo” means “I speak”. The language comes after the verb: “Parlo italiano.”",
      },
      {
        question: "How do you say “I have a book”?",
        hint: "Tip: “I have” is “Ho”.",
        answers: ["Ho un libro.", "Sono un libro.", "Un libro ho io."],
        correct: 0,
        explanation: "“Ho un libro” means “I have a book”. “Ho” is the “I” form of avere.",
      },
    ],
  },
  articles: {
    kicker: "LESSON 2 · ARTICLES & NOUNS",
    questions: [
      {
        question: "Choose the correct phrase for “the house”.",
        hint: "Tip: casa is a feminine noun.",
        answers: ["La casa", "Il casa", "Lo casa"],
        correct: 0,
        explanation: "“Casa” is feminine, so it uses “la”: “la casa”.",
      },
      {
        question: "How do you say “a book”?",
        hint: "Tip: libro is masculine.",
        answers: ["Un libro", "Una libro", "La libro"],
        correct: 0,
        explanation: "Use “un” before this masculine noun: “un libro”.",
      },
      {
        question: "Choose the correct phrase for “a pizza”.",
        hint: "Tip: pizza is a feminine noun.",
        answers: ["Una pizza", "Un pizza", "Uno pizza"],
        correct: 0,
        explanation: "Use “una” before this feminine noun: “una pizza”.",
      },
    ],
  },
  verbs: {
    kicker: "LESSON 3 · EVERYDAY VERBS",
    questions: [
      {
        question: "Complete the sentence: “Io ___ italiano.”",
        hint: "Tip: say “I speak”.",
        answers: ["parlo", "parli", "parla"],
        correct: 0,
        explanation: "“Io parlo” means “I speak”. The ending -o often marks the “I” form.",
      },
      {
        question: "Complete the sentence: “Tu ___ una domanda.”",
        hint: "Tip: say “you have”.",
        answers: ["hai", "ho", "ha"],
        correct: 0,
        explanation: "“Tu hai” means “you have”.",
      },
      {
        question: "Complete the sentence: “Noi ___ a Roma.”",
        hint: "Tip: say “we are”.",
        answers: ["siamo", "sono", "sei"],
        correct: 0,
        explanation: "“Noi siamo” means “we are”.",
      },
    ],
  },
};

let activeSentenceLesson = "basics";
let sentenceIndex = 0;
let selectedSentenceAnswer = null;
let sentenceAnswerChecked = false;

function renderSentenceQuestion() {
  const lesson = sentenceLessons[activeSentenceLesson];
  const question = lesson.questions[sentenceIndex];
  selectedSentenceAnswer = null;
  sentenceAnswerChecked = false;
  document.querySelector("#sentenceKicker").textContent = lesson.kicker;
  document.querySelector("#sentenceCounter").textContent = `${sentenceIndex + 1} / ${lesson.questions.length}`;
  document.querySelector("#sentenceProgress").style.width = `${((sentenceIndex + 1) / lesson.questions.length) * 100}%`;
  document.querySelector("#sentenceQuestion").textContent = question.question;
  document.querySelector("#sentenceHint").textContent = question.hint;
  const feedbackElement = document.querySelector("#sentenceFeedback");
  feedbackElement.textContent = "";
  feedbackElement.classList.remove("error");
  const checkButton = document.querySelector("#sentenceCheck");
  checkButton.disabled = true;
  checkButton.innerHTML = 'Check answer <span>→</span>';
  document.querySelector("#sentenceAnswers").replaceChildren(...question.answers.map((answer, index) => {
    const button = document.createElement("button");
    button.className = "sentence-answer";
    button.type = "button";
    const letter = document.createElement("span");
    letter.className = "sentence-letter";
    letter.textContent = String.fromCharCode(65 + index);
    button.append(letter, document.createTextNode(answer));
    button.addEventListener("click", () => {
      if (sentenceAnswerChecked) return;
      selectedSentenceAnswer = index;
      document.querySelectorAll(".sentence-answer").forEach((option) => option.classList.remove("selected"));
      button.classList.add("selected");
      checkButton.disabled = false;
    });
    return button;
  }));
}

document.querySelectorAll("[data-sentence-lesson]").forEach((button) => {
  button.addEventListener("click", () => {
    activeSentenceLesson = button.dataset.sentenceLesson;
    sentenceIndex = 0;
    document.querySelectorAll("[data-sentence-lesson]").forEach((lessonButton) => {
      lessonButton.classList.toggle("active", lessonButton === button);
    });
    renderSentenceQuestion();
  });
});

document.querySelector("#sentenceCheck").addEventListener("click", () => {
  const lesson = sentenceLessons[activeSentenceLesson];
  const question = lesson.questions[sentenceIndex];
  const feedbackElement = document.querySelector("#sentenceFeedback");
  const checkButton = document.querySelector("#sentenceCheck");
  if (selectedSentenceAnswer === null) return;

  if (!sentenceAnswerChecked) {
    sentenceAnswerChecked = true;
    document.querySelectorAll(".sentence-answer").forEach((option, index) => {
      option.disabled = true;
      if (index === question.correct) option.classList.add("correct");
      else if (index === selectedSentenceAnswer) option.classList.add("incorrect");
    });
    const isCorrect = selectedSentenceAnswer === question.correct;
    feedbackElement.textContent = isCorrect
      ? `Perfetto! ${question.explanation}`
      : `Not quite. ${question.explanation}`;
    feedbackElement.classList.toggle("error", !isCorrect);
    checkButton.innerHTML = sentenceIndex === lesson.questions.length - 1
      ? 'Finish lesson <span>✓</span>'
      : 'Next question <span>→</span>';
    return;
  }

  if (sentenceIndex < lesson.questions.length - 1) {
    sentenceIndex += 1;
    renderSentenceQuestion();
  } else {
    sentenceIndex = 0;
    renderSentenceQuestion();
    showToast("Lesson complete! Try another Italian foundation topic.");
  }
});

const vocabularyCards = [
  { word: "ciao", meaning: "hello · goodbye", example: "Ciao, come stai? — Hi, how are you?" },
  { word: "grazie", meaning: "thank you", example: "Grazie mille! — Thank you very much!" },
  { word: "per favore", meaning: "please", example: "Un caffè, per favore. — A coffee, please." },
  { word: "acqua", meaning: "water", example: "Vorrei dell’acqua. — I’d like some water." },
  { word: "passeggiata", meaning: "a walk · a stroll", example: "Facciamo una passeggiata? — Shall we go for a walk?" },
  { word: "buongiorno", meaning: "good morning · good day", example: "Buongiorno, signora! — Good morning, madam!" },
  { word: "arrivederci", meaning: "goodbye", example: "Arrivederci e buona giornata! — Goodbye and have a nice day!" },
  { word: "perché", meaning: "why · because", example: "Perché studi italiano? — Why are you studying Italian?" },
  { word: "rosso", meaning: "red (rossa, feminine)", example: "La mela è rossa. — The apple is red.", category: "colors", color: "#d45b50" },
  { word: "blu", meaning: "blue", example: "Il cielo è blu. — The sky is blue.", category: "colors", color: "#5682bd" },
  { word: "giallo", meaning: "yellow (gialla, feminine)", example: "Il sole è giallo. — The sun is yellow.", category: "colors", color: "#edc84b" },
  { word: "verde", meaning: "green", example: "L’erba è verde. — The grass is green.", category: "colors", color: "#65a274" },
  { word: "arancione", meaning: "orange", example: "L’arancia è arancione. — The orange is orange.", category: "colors", color: "#e8934e" },
  { word: "viola", meaning: "purple", example: "Il fiore è viola. — The flower is purple.", category: "colors", color: "#9473b5" },
  { word: "rosa", meaning: "pink", example: "La rosa è rosa. — The rose is pink.", category: "colors", color: "#dc83a1" },
  { word: "marrone", meaning: "brown", example: "Il tavolo è marrone. — The table is brown.", category: "colors", color: "#98704d" },
  { word: "lunedì", meaning: "Monday", example: "Lunedì studio italiano. — On Monday I study Italian.", category: "weekdays" },
  { word: "martedì", meaning: "Tuesday", example: "Martedì vado al lavoro. — On Tuesday I go to work.", category: "weekdays" },
  { word: "mercoledì", meaning: "Wednesday", example: "Mercoledì vedo un’amica. — On Wednesday I see a friend.", category: "weekdays" },
  { word: "giovedì", meaning: "Thursday", example: "Giovedì faccio una passeggiata. — On Thursday I go for a walk.", category: "weekdays" },
  { word: "venerdì", meaning: "Friday", example: "Venerdì mangiamo una pizza. — On Friday we eat pizza.", category: "weekdays" },
  { word: "sabato", meaning: "Saturday", example: "Sabato vado al mercato. — On Saturday I go to the market.", category: "weekdays" },
  { word: "domenica", meaning: "Sunday", example: "Domenica mi riposo. — On Sunday I relax.", category: "weekdays" },
  { word: "pane", meaning: "bread", example: "Vorrei del pane. — I’d like some bread.", category: "food" },
  { word: "latte", meaning: "milk", example: "Bevo il latte a colazione. — I drink milk at breakfast.", category: "food" },
  { word: "formaggio", meaning: "cheese", example: "Il formaggio è buono. — The cheese is good.", category: "food" },
  { word: "mela", meaning: "apple", example: "Mangio una mela. — I’m eating an apple.", category: "food" },
  { word: "colazione", meaning: "breakfast", example: "La colazione è pronta. — Breakfast is ready.", category: "food" },
  { word: "pranzo", meaning: "lunch", example: "Il pranzo è alle dodici. — Lunch is at twelve.", category: "food" },
  { word: "cena", meaning: "dinner", example: "Che cosa mangiamo per cena? — What are we eating for dinner?", category: "food" },
  { word: "ristorante", meaning: "restaurant", example: "Il ristorante è vicino. — The restaurant is nearby.", category: "food" },
  { word: "treno", meaning: "train", example: "Il treno parte alle nove. — The train leaves at nine.", category: "travel" },
  { word: "biglietto", meaning: "ticket", example: "Un biglietto per Roma, per favore. — One ticket to Rome, please.", category: "travel" },
  { word: "stazione", meaning: "station", example: "Dov’è la stazione? — Where is the station?", category: "travel" },
  { word: "aeroporto", meaning: "airport", example: "L’aeroporto è lontano. — The airport is far away.", category: "travel" },
  { word: "albergo", meaning: "hotel", example: "Abbiamo una camera in albergo. — We have a hotel room.", category: "travel" },
  { word: "strada", meaning: "street · road", example: "Questa strada è bella. — This street is beautiful.", category: "travel" },
  { word: "destra", meaning: "right", example: "Gira a destra. — Turn right.", category: "travel" },
  { word: "sinistra", meaning: "left", example: "La banca è a sinistra. — The bank is on the left.", category: "travel" },
  { word: "casa", meaning: "home · house", example: "Sono a casa. — I’m at home.", category: "daily" },
  { word: "famiglia", meaning: "family", example: "La mia famiglia è grande. — My family is big.", category: "daily" },
  { word: "amico", meaning: "male friend", example: "Luca è un mio amico. — Luca is a friend of mine.", category: "daily" },
  { word: "amica", meaning: "female friend", example: "Giulia è una mia amica. — Giulia is a friend of mine.", category: "daily" },
  { word: "lavoro", meaning: "work · job", example: "Vado al lavoro. — I’m going to work.", category: "daily" },
  { word: "libro", meaning: "book", example: "Leggo un libro. — I’m reading a book.", category: "daily" },
  { word: "scuola", meaning: "school", example: "La scuola è aperta. — The school is open.", category: "daily" },
  { word: "oggi", meaning: "today", example: "Oggi studio italiano. — Today I’m studying Italian.", category: "daily" },
  { word: "domani", meaning: "tomorrow", example: "A domani! — See you tomorrow!", category: "daily" },
  { word: "uno", meaning: "one", example: "Ho uno zaino. — I have one backpack.", category: "numbers" },
  { word: "due", meaning: "two", example: "Due caffè, per favore. — Two coffees, please.", category: "numbers" },
  { word: "tre", meaning: "three", example: "Ho tre libri. — I have three books.", category: "numbers" },
  { word: "quattro", meaning: "four", example: "Sono le quattro. — It’s four o’clock.", category: "numbers" },
  { word: "cinque", meaning: "five", example: "Il biglietto costa cinque euro. — The ticket costs five euros.", category: "numbers" },
  { word: "sei", meaning: "six", example: "Ho sei anni. — I’m six years old.", category: "numbers" },
  { word: "sette", meaning: "seven", example: "La lezione inizia alle sette. — The lesson starts at seven.", category: "numbers" },
  { word: "otto", meaning: "eight", example: "Sono le otto. — It’s eight o’clock.", category: "numbers" },
  { word: "nove", meaning: "nine", example: "Il treno parte alle nove. — The train leaves at nine.", category: "numbers" },
  { word: "dieci", meaning: "ten", example: "Ci sono dieci studenti. — There are ten students.", category: "numbers" },
];
const vocabularyCategoryLabels = {
  colors: "Colors",
  weekdays: "Days of the week",
  food: "Food & drink",
  travel: "Travel",
  daily: "Daily life",
  numbers: "Numbers",
};
let flashcardIndex = 0;
let flashcardIsFlipped = false;

function getVocabularyCategory(card) {
  return vocabularyCategoryLabels[card.category] || "Everyday Italian";
}

function renderVocabularyList(filter = "") {
  const query = filter.trim().toLocaleLowerCase("it");
  const matchingWords = vocabularyCards.filter((card) =>
    `${card.word} ${card.meaning} ${card.example}`.toLocaleLowerCase("it").includes(query));
  const list = document.querySelector("#vocabularyList");
  document.querySelector("#vocabularyCount").textContent =
    `${matchingWords.length} ${matchingWords.length === 1 ? "word" : "words"}`;
  document.querySelector("#vocabularyEmpty").hidden = matchingWords.length > 0;
  list.replaceChildren(...matchingWords.map((card) => {
    const row = document.createElement("article");
    row.className = "vocabulary-word-row";
    const word = document.createElement("strong");
    word.className = "vocabulary-word";
    word.textContent = card.word;
    const detail = document.createElement("span");
    detail.className = "vocabulary-word-detail";
    const meaning = document.createElement("strong");
    meaning.textContent = card.meaning;
    const category = document.createElement("span");
    category.className = "vocabulary-category";
    category.textContent = getVocabularyCategory(card);
    const example = document.createElement("small");
    example.textContent = card.example;
    detail.append(meaning, category, example);
    const speak = document.createElement("button");
    speak.type = "button";
    speak.className = "vocabulary-speak";
    speak.textContent = "♫";
    speak.setAttribute("aria-label", `Hear ${card.word}`);
    speak.addEventListener("click", () => speakItalian(card.word, speak));
    row.append(word, detail, speak);
    return row;
  }));
}

function renderFlashcard() {
  const card = vocabularyCards[flashcardIndex];
  const cardElement = document.querySelector("#flashcard");
  const colorDot = document.querySelector("#flashcardColor");
  cardElement.classList.toggle("flipped", flashcardIsFlipped);
  colorDot.hidden = !card.color || flashcardIsFlipped;
  if (card.color) colorDot.style.backgroundColor = card.color;
  document.querySelector("#flashcardCategory").textContent =
    `${getVocabularyCategory(card).toLocaleUpperCase("it")} · A1`;
  document.querySelector("#flashcardSideLabel").textContent = flashcardIsFlipped ? "MEANING" : "ITALIAN";
  document.querySelector("#flashcardWord").textContent = flashcardIsFlipped
    ? `${card.meaning}\n${card.example}`
    : card.word;
  document.querySelector("#flashcardHint").textContent = flashcardIsFlipped
    ? "Tap to see the Italian word"
    : "Tap to see the meaning";
  document.querySelector("#flashcardCounter").textContent = `${flashcardIndex + 1} / ${vocabularyCards.length}`;
  document.querySelector("#flashcardProgress").style.width = `${((flashcardIndex + 1) / vocabularyCards.length) * 100}%`;
}

function nextFlashcard() {
  flashcardIndex = (flashcardIndex + 1) % vocabularyCards.length;
  flashcardIsFlipped = false;
  renderFlashcard();
}

document.querySelector("#flashcard").addEventListener("click", () => {
  flashcardIsFlipped = !flashcardIsFlipped;
  renderFlashcard();
});
document.querySelector("#flashcardKnown").addEventListener("click", nextFlashcard);
document.querySelector("#flashcardAgain").addEventListener("click", () => {
  flashcardIsFlipped = false;
  renderFlashcard();
  showToast("No rush — review this word again, then flip when you’re ready.");
});
document.querySelector("#flashcardSound").addEventListener("click", (event) => {
  speakItalian(vocabularyCards[flashcardIndex].word, event.currentTarget);
});
document.querySelector("#vocabularySearch").addEventListener("input", (event) => {
  renderVocabularyList(event.currentTarget.value);
});
document.querySelector("#vocabularyReview").addEventListener("click", () => {
  setActivePage("flashcards");
  window.location.hash = "flashcards";
});
renderSentenceQuestion();
renderFlashcard();
renderVocabularyList();

document.querySelectorAll("[data-start-roleplay]").forEach((button) => {
  button.addEventListener("click", () => {
    setActivePage("chat");
    window.location.hash = "chat";
    document.querySelector(`[data-chat-topic="${button.dataset.startRoleplay}"]`).click();
  });
});

document.querySelectorAll('a[href="#lessons"]').forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    setActivePage("lessons");
    window.location.hash = "lessons";
  });
});

document.querySelectorAll("[data-open-sentence]").forEach((button) => {
  button.addEventListener("click", () => {
    const lessonButton = document.querySelector(`[data-sentence-lesson="${button.dataset.openSentence}"]`);
    lessonButton.click();
    setActivePage("sentences");
    window.location.hash = "sentences";
  });
});

document.querySelectorAll("[data-lesson]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelector('[data-sentence-lesson="basics"]').click();
    setActivePage("sentences");
    window.location.hash = "sentences";
  });
});

document.querySelectorAll("[data-open-roleplay]").forEach((button) => {
  button.addEventListener("click", () => {
    setActivePage("chat");
    window.location.hash = "chat";
    document.querySelector(`[data-chat-topic="${button.dataset.openRoleplay}"]`).click();
  });
});

document.querySelectorAll("[data-open-flashcards]").forEach((button) => {
  button.addEventListener("click", () => {
    setActivePage("flashcards");
    window.location.hash = "flashcards";
  });
});

let callRecognition = null;
let callActive = false;

function getCallRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) return null;
  const recognition = new Recognition();
  recognition.lang = "it-IT";
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => {
    document.querySelector("#callStatus").textContent = "Listening… speak in Italian";
    document.querySelector("#callMic").classList.add("listening");
  };
  recognition.onend = () => {
    document.querySelector("#callMic").classList.remove("listening");
    if (callActive) document.querySelector("#callStatus").textContent = "Tap the microphone when you’re ready to reply";
  };
  recognition.onerror = (event) => {
    document.querySelector("#callMic").classList.remove("listening");
    const message = event.error === "not-allowed"
      ? "Microphone permission was denied. Allow microphone access in your browser settings."
      : "Could not hear you. Check your microphone and try again.";
    document.querySelector("#callStatus").textContent = message;
  };
  recognition.onresult = async (event) => {
    const spokenText = event.results[0][0].transcript;
    document.querySelector("#callTranscript").textContent = `You: ${spokenText}`;
    const reply = getChatReply(spokenText);
    document.querySelector("#callTranscript").textContent = `${spokenText}\n\nGiulia: ${reply.text}`;
    document.querySelector("#callStatus").textContent = reply.translation;
    await speakItalian(reply.text.split("\n")[0], document.querySelector("#callMic"));
  };
  return recognition;
}

document.querySelector("#callStart").addEventListener("click", async () => {
  callRecognition = getCallRecognition();
  if (!callRecognition) {
    showToast("Voice input is not supported in this browser. Try Chrome to use Call Mode.");
    return;
  }
  callActive = true;
  activeChatTopic = document.querySelector("#callTopic").value === "free"
    ? null
    : document.querySelector("#callTopic").value;
  scenarioTurn = 0;
  const opening = activeChatTopic
    ? chatScenarios[activeChatTopic].opening
    : { text: "Ciao! Come stai oggi?", translation: "Hi! How are you today?" };
  document.querySelector("#callTranscript").textContent = `Giulia: ${opening.text}`;
  document.querySelector("#callStatus").textContent = "Tap the microphone to reply in Italian";
  document.querySelector("#callCard").classList.add("call-active");
  document.querySelector("#callStart").disabled = true;
  document.querySelector("#callMic").disabled = false;
  document.querySelector("#callEnd").disabled = false;
  await speakItalian(opening.text, document.querySelector("#callMic"));
});

document.querySelector("#callMic").addEventListener("click", () => {
  if (!callRecognition || !callActive) return;
  try {
    callRecognition.start();
  } catch {
    document.querySelector("#callStatus").textContent = "Already listening. Please finish your reply.";
  }
});

document.querySelector("#callEnd").addEventListener("click", () => {
  callActive = false;
  if (callRecognition) callRecognition.stop();
  if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  document.querySelector("#callCard").classList.remove("call-active");
  document.querySelector("#callStatus").textContent = "Call ended. Start again whenever you’re ready.";
  document.querySelector("#callStart").disabled = false;
  document.querySelector("#callMic").disabled = true;
  document.querySelector("#callEnd").disabled = true;
});

if (window.location.hash === "#chat") openChat();
else {
  const initialPage = {
    "#sentences": "sentences",
    "#flashcards": "flashcards",
    "#roleplays": "roleplays",
    "#call": "call",
    "#lessons": "lessons",
    "#vocabulary": "vocabulary",
  }[window.location.hash];
  if (initialPage) setActivePage(initialPage);
}
