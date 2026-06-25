import { GoogleGenAI } from "https://esm.run/@google/genai";

class FSCAgentSandbox {
    constructor() {
        this.apiKey = localStorage.getItem('FSC_GEMINI_KEY') || "";
        this.ai = null;
        this.syncLanguage();
        
        // Use a short timeout so the page can fully render before prompting for key
        setTimeout(() => this.checkApiKey(), 500);
    }

    syncLanguage() {
        this.lang = document.documentElement.getAttribute('lang') || 'bg';
    }

    checkApiKey() {
        if (!this.apiKey) {
            const userKey = prompt("Моля въведете вашия Gemini API Ключ, за да активирате асистента:\nPlease enter your Gemini API Key to activate the assistant:");
            if (userKey) {
                localStorage.setItem('FSC_GEMINI_KEY', userKey);
                this.apiKey = userKey;
            }
        }
        if (this.apiKey) {
            this.ai = new GoogleGenAI({ apiKey: this.apiKey });
        }
    }

    buildDOMMap() {
        const interactiveSelectors = 'button, input, a';
        const elements = document.querySelectorAll(interactiveSelectors);

        return Array.from(elements)
            .filter(el => el.id && !el.id.startsWith('ai-')) 
            .map(el => ({
                id: el.id,
                tag: el.tagName.toLowerCase(),
                visibleText: el.innerText || el.placeholder || ""
            }));
    }

    async handleQuery(userText) {
        if (!this.ai) {
            this.appendMessage("Error: API key is missing. Refresh the page to input it.", "bot");
            return;
        }

        const domLayout = this.buildDOMMap();
        this.appendMessage(userText, "user");

        const systemInstruction = `
            You are an accessibility AI navigation companion for the Financial Supervision Commission portal.
            The interface layout is currently presented in: [Language mode: ${this.lang.toUpperCase()}].
            
            Your objective is to review the simplified DOM element map provided below and identify if an element matches the intent.
            
            If matches language change to Bulgarian, target 'btn-lang-bg'.
            If matches language change to English, target 'btn-lang-en'.
            If matches complaints, target 'btn-submit-complaint'.
            If matches registers, target 'btn-open-registers'.

            Response JSON structure format strictly:
            {
              "targetId": "string-element-id-or-null",
              "speak": "Response string in corresponding locale language (${this.lang === 'bg' ? 'Bulgarian' : 'English'}) explaining the action."
            }
        `;

        try {
            const response = await this.ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Current DOM Elements Available:\n${JSON.stringify(domLayout)}\n\nUser request: "${userText}"`,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json"
                }
            });

            const result = JSON.parse(response.text);
            
            this.appendMessage(result.speak, "bot");
            this.announceToScreenReader(result.speak);

            if (result.targetId) {
                const targetNode = document.getElementById(result.targetId);
                if (targetNode) {
                    setTimeout(() => {
                        targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        targetNode.focus();
                        targetNode.click();
                    }, 1000);
                }
            }
        } catch (error) {
            console.error(error);
            this.appendMessage("Възникна грешка при обработката / Process handling error.", "bot");
        }
    }

    appendMessage(text, sender) {
        const history = document.getElementById('ai-chat-history');
        const msgDiv = document.createElement('div');
        msgDiv.className = sender === 'user' ? 'user-msg' : 'bot-msg';
        msgDiv.innerText = text;
        history.appendChild(msgDiv);
        history.scrollTop = history.scrollHeight;
    }

    announceToScreenReader(msg) {
        const liveRegion = document.getElementById('ai-aria-live');
        if (liveRegion) liveRegion.textContent = msg;
    }
}

window.fscAgentInstance = new FSCAgentSandbox();

window.triggerAgentAction = function() {
    const inputField = document.getElementById('ai-user-input');
    if (!inputField) return;
    const value = inputField.value.trim();
    if (value) {
        window.fscAgentInstance.handleQuery(value);
        inputField.value = "";
    }
};