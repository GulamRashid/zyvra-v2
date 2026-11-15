// Prompts & postamble regex (English & Hindi)
export const POSTAMBLE_REGEX = /(?:^|[\s.\n|।;])(Select the correct|Which of the|Choose the|Correct code|Codes?:?|Options?:?|उपर्युक्त|सही कूट|सही कथन|कूट:?|कोड:?|नीचे दिए गए|सही मिलान)[\s\S]*$/i;

export function cleanPunctuation(str) {
  if (!str) return '';
  return str.replace(/^[.\n|।;:\s]+/, '').replace(/[.\n|।;:\s]+$/, '').trim();
}

/**
 * Extracts items from a block of text given an item category ('number' or 'letter')
 */
export function extractColumnItems(text, kind = 'number') {
  if (!text || typeof text !== 'string') return [];

  // Pattern for numbered item: (1), 1., (i)
  // Pattern for lettered item: (A), A., (a)
  const tokenRegex = kind === 'number'
    ? /(?:^|\s|[|;])(?:\(([1-9ivx]+)\)|([1-9ivx]+)\.)(?=\s+\S)/gi
    : /(?:^|\s|[|;])(?:\(([A-Ea-e])\)|([A-Ea-e])\.)(?=\s+\S)/gi;

  const matches = [];
  let m;
  while ((m = tokenRegex.exec(text)) !== null) {
    const rawMatch = m[0];
    const badge = rawMatch.replace(/^[|\s;]+/, '').trim();
    const tokenVal = m[1] || m[2];
    const matchIndex = m.index + (rawMatch.length - rawMatch.trimStart().length);
    matches.push({
      badge,
      val: tokenVal,
      index: matchIndex,
      length: badge.length
    });
  }

  if (matches.length >= 2) {
    const items = [];
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index;
      const end = (i < matches.length - 1) ? matches[i + 1].index : text.length;
      let itemContent = text.slice(start, end).trim();
      itemContent = itemContent.replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim();
      items.push(itemContent);
    }
    return items;
  }

  // Fallback: Check lines
  const rawLines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const lineItems = [];
  for (const line of rawLines) {
    if (kind === 'number' && (/^\(?[1-9ivx]+\)?[.\s]/i.test(line) || /^[1-9]\./.test(line))) {
      lineItems.push(line.replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim());
    } else if (kind === 'letter' && (/^\(?[A-Ea-e]\)?[.\s]/i.test(line) || /^[A-E]\./i.test(line))) {
      lineItems.push(line.replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim());
    }
  }

  if (lineItems.length >= 2) return lineItems;

  return [];
}

/**
 * Parses match-the-following questions in all formats (English & Hindi)
 */
export function parseMatchingQuestion(text) {
  if (!text || typeof text !== 'string') return null;

  const isHindi = /[\u0900-\u097F]/.test(text);

  // Find all occurrences of Col 1 header and Col 2 header
  const col1Regex = /(?:^|\n|[|;]|\s)((?:Column|List|स्तंभ|सूची)\s*[-–—]?\s*(?:I|1))\b/gi;
  const col2Regex = /(?:^|\n|[|;]|\s)((?:Column|List|स्तंभ|सूची)\s*[-–—]?\s*(?:II|2))\b/gi;

  const col1Matches = [];
  let m;
  while ((m = col1Regex.exec(text)) !== null) {
    const raw = m[0];
    const title = m[1].trim();
    const index = m.index + (raw.length - raw.trimStart().length);
    col1Matches.push({ title, index });
  }

  const col2Matches = [];
  while ((m = col2Regex.exec(text)) !== null) {
    const raw = m[0];
    const title = m[1].trim();
    const index = m.index + (raw.length - raw.trimStart().length);
    col2Matches.push({ title, index });
  }

  if (col1Matches.length > 0 && col2Matches.length > 0) {
    let chosenCol1 = null;
    let chosenCol2 = null;

    for (let i = col1Matches.length - 1; i >= 0; i--) {
      const c1 = col1Matches[i];
      const c2 = col2Matches.find((cand) => cand.index > c1.index);
      if (c2) {
        chosenCol1 = c1;
        chosenCol2 = c2;
        break;
      }
    }

    if (chosenCol1 && chosenCol2) {
      let preamble = cleanPunctuation(text.slice(0, chosenCol1.index));

      const col1Title = chosenCol1.title;
      const col2Title = chosenCol2.title;

      // Extract Column 1 raw content
      const col1Raw = text.slice(chosenCol1.index, chosenCol2.index).trim();
      const col1Body = col1Raw.replace(new RegExp(`^${col1Title}\\s*[:：\\-–—]?\\s*`, 'i'), '').trim();

      // Extract Column 2 raw content
      const col2Raw = text.slice(chosenCol2.index).trim();
      let col2Body = col2Raw.replace(new RegExp(`^${col2Title}\\s*[:：\\-–—]?\\s*`, 'i'), '').trim();

      // Extract postamble from col2Body
      let postamble = '';
      const postambleMatch = col2Body.match(POSTAMBLE_REGEX);
      if (postambleMatch && postambleMatch.index !== undefined) {
        postamble = cleanPunctuation(col2Body.slice(postambleMatch.index));
        col2Body = col2Body.slice(0, postambleMatch.index).trim();
      }

      const cleanCol1Body = col1Body.replace(/[|;]+$/, '').trim();
      const cleanCol2Body = col2Body.replace(/[|;]+$/, '').trim();

      // Check row-by-row lines
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const pairedCol1 = [];
      const pairedCol2 = [];
      for (const line of lines) {
        const splitPair = line.match(/^(\([0-9ivx]+\)[^|]+?)\s*(?:\||\t|\s{3,})\s*(\([A-Za-z]\).+)$/i);
        if (splitPair) {
          pairedCol1.push(splitPair[1].trim());
          pairedCol2.push(splitPair[2].trim());
        }
      }

      let col1Items = [];
      let col2Items = [];

      if (pairedCol1.length >= 2 && pairedCol1.length === pairedCol2.length) {
        col1Items = pairedCol1;
        col2Items = pairedCol2;
      } else {
        col1Items = extractColumnItems(cleanCol1Body, 'number');
        col2Items = extractColumnItems(cleanCol2Body, 'letter');

        if (!col1Items.length && !col2Items.length) {
          col1Items = extractColumnItems(cleanCol1Body, 'letter');
          col2Items = extractColumnItems(cleanCol2Body, 'number');
        }
      }

      if (col1Items.length >= 2 || col2Items.length >= 2) {
        return {
          preamble: preamble || (isHindi ? 'निम्नलिखित का मिलान कीजिए:' : 'Match the following:'),
          col1Title,
          col2Title,
          col1Items,
          col2Items,
          postamble
        };
      }
    }
  }

  // 2. Fallback: Inline matching without explicit Column headers
  const tokenRegex = /(?:\(([1-9ivx]+|[A-Ea-e])\)|(?<=\s|^)([1-9ivx]+|[A-Ea-e])\.)(?=\s+\S)/gi;
  let match;
  const tokens = [];
  while ((match = tokenRegex.exec(text)) !== null) {
    const rawVal = match[1] || match[2];
    const isNum = /^[0-9ivx]+$/i.test(rawVal);
    const isLetter = /^[A-Ea-e]$/i.test(rawVal);
    tokens.push({
      token: match[0].trim(),
      val: rawVal,
      isNum,
      isLetter,
      index: match.index
    });
  }

  const numTokens = tokens.filter((t) => t.isNum);
  const letterTokens = tokens.filter((t) => t.isLetter);

  if (numTokens.length >= 2 && letterTokens.length >= 2) {
    const firstIsNum = tokens[0].isNum;
    let splitIndex = -1;
    for (let i = 1; i < tokens.length; i++) {
      if (tokens[i].isNum !== firstIsNum) {
        splitIndex = i;
        break;
      }
    }

    if (splitIndex !== -1) {
      const group1Tokens = tokens.slice(0, splitIndex);
      const group2Tokens = tokens.slice(splitIndex);

      if (group1Tokens.length >= 2 && group2Tokens.length >= 2) {
        let preamble = cleanPunctuation(text.slice(0, tokens[0].index));

        const group1Items = [];
        for (let i = 0; i < group1Tokens.length; i++) {
          const start = group1Tokens[i].index;
          const end = (i < group1Tokens.length - 1) ? group1Tokens[i + 1].index : group2Tokens[0].index;
          let itemStr = text.slice(start, end).trim();
          itemStr = itemStr.replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim();
          group1Items.push(itemStr);
        }

        const group2Items = [];
        let postamble = '';
        for (let i = 0; i < group2Tokens.length; i++) {
          const start = group2Tokens[i].index;
          if (i < group2Tokens.length - 1) {
            const end = group2Tokens[i + 1].index;
            let itemStr = text.slice(start, end).trim();
            itemStr = itemStr.replace(/[|;]+$/, '').trim();
            group2Items.push(itemStr);
          } else {
            const rest = text.slice(start).trim();
            const pMatch = rest.match(POSTAMBLE_REGEX);
            if (pMatch && pMatch.index !== undefined) {
              group2Items.push(rest.slice(0, pMatch.index).replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim());
              postamble = cleanPunctuation(pMatch[0].trim());
            } else {
              group2Items.push(rest.replace(/[|;]+$/, '').replace(/[.।\s]+$/, '').trim());
            }
          }
        }

        const col1Title = isHindi ? 'सूची-I' : 'Column I';
        const col2Title = isHindi ? 'सूची-II' : 'Column II';
        const leftItems = firstIsNum ? group1Items : group2Items;
        const rightItems = firstIsNum ? group2Items : group1Items;

        return {
          preamble: preamble || (isHindi ? 'निम्नलिखित का मिलान कीजिए:' : 'Match the following:'),
          col1Title,
          col2Title,
          col1Items: leftItems,
          col2Items: rightItems,
          postamble
        };
      }
    }
  }

  return null;
}

/**
 * Parses inline or multi-line statement questions:
 * e.g. "Consider the following statements: | (1) ... | (2) ... | Which of the above are correct?"
 */
export function parseStatementQuestion(text) {
  if (!text || typeof text !== 'string') return null;

  const tokenRegex = /(?:^|\s|[|;])(?:\(([1-9ivxlcdm]+)\)|([1-9ivxlcdm]+)\.)(?=\s+\S)/gi;
  let match;
  const tokens = [];
  while ((match = tokenRegex.exec(text)) !== null) {
    const rawMatch = match[0];
    const badge = rawMatch.replace(/^[|\s;]+/, '').trim();
    const tokenVal = match[1] || match[2];
    const matchIndex = match.index + (rawMatch.length - rawMatch.trimStart().length);
    tokens.push({
      badge,
      val: tokenVal,
      index: matchIndex,
      length: badge.length
    });
  }

  if (tokens.length < 2) return null;

  let preamble = cleanPunctuation(text.slice(0, tokens[0].index));
  const statements = [];
  let postamble = '';

  for (let i = 0; i < tokens.length; i++) {
    const start = tokens[i].index + tokens[i].length;
    if (i < tokens.length - 1) {
      const end = tokens[i + 1].index;
      let stmtText = text.slice(start, end).trim();
      stmtText = stmtText.replace(/[|;]+$/, '').trim();
      statements.push({
        badge: tokens[i].badge,
        text: stmtText
      });
    } else {
      const rest = text.slice(start).trim();
      const pMatch = rest.match(POSTAMBLE_REGEX);
      if (pMatch && pMatch.index !== undefined) {
        statements.push({
          badge: tokens[i].badge,
          text: rest.slice(0, pMatch.index).replace(/[|;]+$/, '').trim()
        });
        postamble = cleanPunctuation(pMatch[0].trim());
      } else {
        statements.push({
          badge: tokens[i].badge,
          text: rest.replace(/[|;]+$/, '').trim()
        });
      }
    }
  }

  return {
    preamble,
    statements,
    postamble
  };
}
