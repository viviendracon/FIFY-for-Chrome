const DEFAULT_RULES = [
  { word: "slams", replacement: "criticizes" },
  { word: "slammed", replacement: "criticized" },
  { word: "claps back", replacement: "responds" },
  { word: "clapped back", replacement: "responded" },
  { word: "destroys", replacement: "rebuts" },
  { word: "destroyed", replacement: "rebutted" },
  { word: "eviscerates", replacement: "disputes" },
  { word: "blasts", replacement: "rebukes" },
  { word: "rips into", replacement: "critiques" },
  { word: "shuts down", replacement: "counters" },
  { word: "backlash", replacement: "public disagreement" },
  { word: "meltdown", replacement: "dispute" },
  { word: "frenzy", replacement: "heightened attention" },
  { word: "breaks silence", replacement: "comments publicly" },
  { word: "broke silence", replacement: "commented publicly" },
  { word: "goes nuclear", replacement: "escalates response" }
];

const tbody = document.getElementById("rulesBody");
const status = document.getElementById("status");

function createRow(word = "", replacement = "") {
  const tr = document.createElement("tr");

  tr.innerHTML = `
    <td><input type="text" class="word-input" value="${escapeHtml(word)}" placeholder="e.g. slams"></td>
    <td><input type="text" class="repl-input" value="${escapeHtml(replacement)}" placeholder="e.g. criticizes"></td>
    <td><button type="button" class="remove">Remove</button></td>
  `;

  tr.querySelector(".remove").addEventListener("click", () => tr.remove());
  tbody.appendChild(tr);
}

function escapeHtml(str) {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function loadRules() {
  chrome.storage.sync.get({ rules: DEFAULT_RULES }, (data) => {
    tbody.innerHTML = "";
    data.rules.forEach((item) => createRow(item.word, item.replacement));
  });
}

function saveRules() {
  const rows = tbody.querySelectorAll("tr");
  const rules = [];

  rows.forEach((row) => {
    const word = row.querySelector(".word-input").value.trim();
    const replacement = row.querySelector(".repl-input").value.trim();
    if (word) {
      rules.push({ word, replacement });
    }
  });

  chrome.storage.sync.set({ rules }, () => {
    status.textContent = "Saved!";
    setTimeout(() => { status.textContent = ""; }, 2000);
  });
}

document.getElementById("addBtn").addEventListener("click", () => createRow());
document.getElementById("saveBtn").addEventListener("click", saveRules);
document.getElementById("resetBtn").addEventListener("click", () => {
  if (confirm("Reset to default replacements?")) {
    chrome.storage.sync.set({ rules: DEFAULT_RULES }, () => {
      loadRules();
      status.textContent = "Reset to defaults.";
      setTimeout(() => { status.textContent = ""; }, 2000);
    });
  }
});

document.addEventListener("DOMContentLoaded", loadRules);