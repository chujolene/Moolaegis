import { API_BASE_URL } from './config.js';
const chatURL = `${API_BASE_URL}/chat`;

const messagesDiv = document.getElementById("messages");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");

import { apiFetch } from './auth.js';


// Function to append messages
function appendMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = sender === "user" ? "message user-message" : "message bot-message";
  msgDiv.textContent = text;
  messagesDiv.appendChild(msgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight; // Auto-scroll to bottom
}

// Send message
function sendMessage() {
  const message = chatInput.value.trim();
  if (!message) return;

  appendMessage("user", message);
  chatInput.value = "";

  const token = localStorage.getItem("access_token");
  if (!token) {
    appendMessage("bot", "⚠ Please login first!");
    return;
  }

  // Show temporary 'typing...' while waiting for reply
  const typingMsg = document.createElement("div");
  typingMsg.className = "message bot-message";
  typingMsg.textContent = "Moolaegis is typing...";
  messagesDiv.appendChild(typingMsg);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  console.log("Sending message:", { message });

  apiFetch(chatURL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  })
  .then(res => res.json())
  .then(data => {
    typingMsg.remove();
    if (data.reply) {
      appendMessage("bot", data.reply);
    } else {
      appendMessage("bot", "⚠ No response from server.");
    }
  })
  .catch(err => {
    console.error("Error:", err);
    typingMsg.remove();
    appendMessage("bot", "⚠ Error contacting server.");
  });
  
}

// Event listeners
sendBtn.addEventListener("click", sendMessage);
chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendMessage();
});

function pingHeight() {
  const h = document.documentElement.scrollHeight;
  parent.postMessage({ type: 'fc:resize', height: h }, '*');
}
window.addEventListener('load', pingHeight);
new MutationObserver(pingHeight).observe(document.body, { childList: true, subtree: true }); 