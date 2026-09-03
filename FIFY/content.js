let compiledRules = [];

// 1. Kill CSS-forced uppercase styling across headline and title elements
const style = document.createElement("style");
style.textContent = `
  h1, h2, h3, h4, h5, h6,
  [role="heading"],
  #video-title,
  ytd-rich-grid-media #video-title,
  yt-formatted-string,
  [class*="headline" i],
  [class*="title" i],
  [data-testid*="title" i],
  [data-testid*="headline" i] {
    text-transform: none !important;
  }
`;
document.head.appendChild(style);

// Acronyms and initialisms to keep in full uppercase
const PRESERVE_ACRONYMS = new Set([
  "NASA", "FBI", "CIA", "DOJ", "NATO", "EU", "UN", "USA", "UK", 
  "US", "AI", "CEO", "CFO", "CTO", "GOP", "DNC", "POTUS", "COVID", 
  "COVID-19", "IRS", "FDA", "SEC", "EPA", "CDC", "FTC", "WHO", "CNN",
  "ABC", "NBC", "CBS", "POTUS", "FIFY"
]);

// Minor words that stay lowercase unless at the boundary or after punctuation
const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at", 
  "to", "from", "by", "with", "in", "of", "as", "into", "over"
]);

const HEADLINE_SELECTOR = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "[role=\"heading\"]",
  "#video-title",
  "ytd-rich-grid-media #video-title",
  "yt-formatted-string#video-title",
  "[class*=\"headline\" i]",
  "[class*=\"title\" i]",
  "[data-testid*=\"title\" i]",
  "[data-testid*=\"headline\" i]"
].join(", ");

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compileRules(rawRules) {
  return rawRules
    .filter((r) => r.word && r.word.trim() !== "")
    .map((r) => ({
      pattern: new RegExp(`\\b${escapeRegex(r.word.trim())}\\b`, "gi"),
      replacement: r.replacement.trim()
    }));
}

// Ensure replacements never shout in all-caps, even if the buzzword was shouting
function matchCase(original, replacement) {
  // If original was ALL CAPS, return capitalized Title Case ("Criticizes"), not "CRITICIZES"
  if (original === original.toUpperCase() && original.length > 1) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1).toLowerCase();
  }
  if (original[0] === original[0].toUpperCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement.toLowerCase();
}

// Convert string to clean Title Case
function toTitleCase(str) {
  if (!str || !str.trim()) return str;

  return str.replace(/\b[A-Za-z0-9'-]+\b/g, (word, offset) => {
    const upper = word.toUpperCase();
    if (PRESERVE_ACRONYMS.has(upper)) return upper;

    const precedingText = str.slice(0, offset);
    const followingText = str.slice(offset + word.length);

    // Check if this word leads or closes the title (ignoring outer symbols/quotes)
    const isFirstWord = !/[A-Za-z0-9]/.test(precedingText);
    const isLastWord = !/[A-Za-z0-9]/.test(followingText);
    const afterPunctuation = /[:\-—!?]\s*['"”’]?$/.test(precedingText);

    const lower = word.toLowerCase();
    if (!isFirstWord && !isLastWord && !afterPunctuation && MINOR_WORDS.has(lower)) {
      return lower;
    }

    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function sanitizeBuzzwords(text) {
  let result = text;
  for (const { pattern, replacement } of compiledRules) {
    result = result.replace(pattern, (match) => matchCase(match, replacement));
  }
  return result;
}

// Check if an element is a headline or contained inside one
function isHeadlineNode(node) {
  const el = node.parentElement;
  if (!el) return false;
  return !!el.closest(HEADLINE_SELECTOR);
}

function processTextNode(node) {
  let text = node.nodeValue;
  if (!text || !text.trim()) return;

  const isHeadline = isHeadlineNode(node);

  // If inside a headline, convert the casing first
  if (isHeadline) {
    text = toTitleCase(text);
  }

  // Replace buzzwords
  text = sanitizeBuzzwords(text);

  if (text !== node.nodeValue) {
    node.nodeValue = text;
  }
}

function walkNode(node) {
  if (!node) return;

  const tagName = node.nodeName.toUpperCase();
  if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(tagName)) return;

  if (node.nodeType === Node.TEXT_NODE) {
    processTextNode(node);
  } else {
    for (let child = node.firstChild; child; child = child.nextSibling) {
      walkNode(child);
    }
  }
}

// Watch for continuous scrolling and newly rendered elements
const observer = new MutationObserver((mutations) => {
  for (const mutation of mutations) {
    for (const addedNode of mutation.addedNodes) {
      walkNode(addedNode);
    }
  }
});

chrome.storage.sync.get({ rules: [] }, (data) => {
  compiledRules = compileRules(data.rules);
  walkNode(document.body);
  observer.observe(document.body, { childList: true, subtree: true });
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.rules) {
    compiledRules = compileRules(changes.rules.newValue || []);
    walkNode(document.body);
  }
});
