let compiledRules = [];

// 1. Kill CSS-forced uppercase styling (including Reddit title slots)
const style = document.createElement("style");
style.textContent = `
  h1, h2, h3, h4, h5, h6,
  [role="heading"],
  [slot="title"],
  [id*="post-title"],
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
  "COVID-19", "IRS", "FDA", "SEC", "EPA", "CDC", "FTC", "CNN",
  "ABC", "NBC", "CBS", "FIFY", "MAGA", "DSA", "WW3", "WW2", "WW1",
  "WWIII", "WWII", "WWI", "OG", "DIY", "ETA", "FYI", "IMO", "IMHO", "LOL", "BRB", "IDK", "TBD",
  "RIP", "NSFW", "NSFL", "TL;DR", "AKA", "VIP", "FAQ", "ASAP", "DIY",
  "LGBTQ+", "LGBTQIA+", "LGBTQIA", "LGBTQ", "LGBT", "LGBTI", "LGBTIQ",
  "LGBTIQA+", "LGBTIQA", "LGBTIQ+", "LGBTIQ", "LGBTI+", "LGBTI",
  "LGBT+", "LGBTIA+", "LGBTIA", "LGBTQIA+", "LGBTQIA", "LGBTQ+",
  "DYK", "F2P", "P2W", "MMORPG", "RPG", "FPS", "RTS", "MOBA", "TFT", "BR", "PvP", 
  "PvE", "MMO", "MMOFPS", "MMORTS", "MMOTPS", "MMOARPG", "MMOSLG", "MMOSIM", 
  "MMOSURV", "MMOSHOOTER", "MMOADVENTURE", "MMOSTRATEGY", "MMOPUZZLE", "MMORACING", "MMOSPORTS", 
  "MMOFIGHTING", "MMOBOARD", "MMOCARD", "MMOMUSIC", "MMODANCE", "MMOCASINO", "MMOBATTLE", "JD"
  // Add more acronyms as needed
]);

// Minor words that stay lowercase unless at the boundary or after punctuation
const MINOR_WORDS = new Set([
  "a", "an", "the", "and", "but", "or", "for", "nor", "on", "at",
  "to", "from", "by", "with", "in", "of", "as", "into", "over"
]);

// Add Reddit's specific markup patterns here as well
const HEADLINE_SELECTOR = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "[role=\"heading\"]",
  "[slot=\"title\"]",                   // Modern Reddit post titles
  "a[id*=\"post-title\"]",              // Reddit post link IDs
  "shreddit-post a",                    // Reddit custom element links
  "#video-title",                       // YouTube video titles
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

function matchCase(original, replacement) {
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

  return str.replace(
    /[\p{L}\p{N}]+(?:['’‘ʼ＇-][\p{L}\p{N}]+)*/gu,
    (word, offset) => {
      const upper = word.toUpperCase();
      if (PRESERVE_ACRONYMS.has(upper)) return upper;

      const precedingText = str.slice(0, offset);
      const followingText = str.slice(offset + word.length);

      // Check if this word leads or closes the title
      const isFirstWord = !/[\p{L}\p{N}]/u.test(precedingText);
      const isLastWord = !/[\p{L}\p{N}]/u.test(followingText);
      const afterPunctuation = /[:\-—!?]\s*['"”’]?$/.test(precedingText);

      const lower = word.toLowerCase();

      if (
        !isFirstWord &&
        !isLastWord &&
        !afterPunctuation &&
        MINOR_WORDS.has(lower)
      ) {
        return lower;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
  );
}

function sanitizeBuzzwords(text) {
  let result = text;
  for (const { pattern, replacement } of compiledRules) {
    result = result.replace(pattern, (match) => matchCase(match, replacement));
  }
  return result;
}

function isHeadlineNode(node) {
  const el = node.parentElement;
  if (!el) return false;
  return !!el.closest(HEADLINE_SELECTOR);
}

const APOSTROPHE_SUFFIXES = new Set([
  "s", "t", "re", "ve", "ll", "d", "m"
]);

function getPreviousTextChar(node) {
  const headline = node.parentElement?.closest(HEADLINE_SELECTOR);
  if (!headline) return "";

  const walker = document.createTreeWalker(
    headline,
    NodeFilter.SHOW_TEXT
  );

  let previousNode = null;
  let currentNode;

  while ((currentNode = walker.nextNode())) {
    if (currentNode === node) break;

    if (currentNode.nodeValue) {
      previousNode = currentNode;
    }
  }

  return previousNode?.nodeValue?.slice(-1) || "";
}

function fixSplitApostropheSuffix(node, text) {
  const previousChar = getPreviousTextChar(node);

  // Only intervene if this text node immediately follows an apostrophe.
  if (previousChar !== "'" && previousChar !== "’") {
    return text;
  }

  return text.replace(/^[A-Za-z]+/, (word) => {
    const lower = word.toLowerCase();

    return APOSTROPHE_SUFFIXES.has(lower)
      ? lower
      : word;
  });
}

function processTextNode(node) {
  let text = node.nodeValue;
  if (!text || !text.trim()) return;

  const isHeadline = isHeadlineNode(node);

  // 1. Initial casing pass
  if (isHeadline) {
    text = toTitleCase(text);
  }

  // 2. Replace buzzwords
  text = sanitizeBuzzwords(text);

  // 3. Second casing pass to format the newly inserted replacement words
  if (isHeadline) {
    text = toTitleCase(text);

    // Some sites split contractions/possessives across DOM text nodes:
    //   "Trump’" + <span>"s"</span>
    // Without this, the isolated suffix looks like a new word and becomes "S".
    text = fixSplitApostropheSuffix(node, text);
  }

  if (text !== node.nodeValue) {
    node.nodeValue = text;
  }
}

function walkNode(node) {
  if (!node) return;

  const tagName = node.nodeName.toUpperCase();
  if (["SCRIPT", "STYLE", "TEXTAREA", "INPUT"].includes(tagName)) return;

  // Traverse into Web Component shadow roots if present
  if (node.shadowRoot) {
    walkNode(node.shadowRoot);
  }

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
