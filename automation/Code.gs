/**
 * THE CONTENT DROP — CONTENT AUTOMATION SYSTEM v1.0
 * Google Apps Script
 *
 * FIRST TIME: Run setup() once to create the sheet structure and triggers.
 * Then fill in all API keys in the Config sheet.
 * Then run fetchPinterestBoardIds() to store your board IDs.
 * Content will auto-generate every Monday at 7am.
 */

// ── CONSTANTS ────────────────────────────────────────────────────────────────

const SHEETS = {
  CONTENT:   'Content',
  STRATEGY:  'Strategy',
  ANALYTICS: 'Analytics',
  CONFIG:    'Config',
  CANVA:     'Canva Queue'
};

const COL = {
  ID:         1,
  CREATED:    2,
  SCHEDULED:  3,
  TYPE:       4,   // Blog | Facebook | Pinterest
  PILLAR:     5,
  CHANNEL:    6,   // Pinterest board name | 'Facebook Page' | 'Blog'
  TITLE:      7,
  BODY:       8,
  CTA:        9,
  IMAGE_URL:  10,
  STATUS:     11,  // Draft | Approved | Published | Failed
  PUB_URL:    12,
  PUB_AT:     13,
  SLUG:       14,  // Blog only
  NOTES:      15
};

const PILLARS = ['Education', 'Tip', 'Industry', 'Motivational', 'Product', 'Social Proof'];

// Visual template per pillar — drives image generation
const TEMPLATES = {
  'Education':   { bg: '#F5F0E8', headline: '#1E3A2F', eyebrow: '#C4B49A', style: 'left'       },
  'Tip':         { bg: '#F5F0E8', headline: '#1E3A2F', eyebrow: '#1E3A2F', style: 'tip'        },
  'Industry':    { bg: '#1E3A2F', headline: '#F5F0E8', eyebrow: '#C4B49A', style: 'center'     },
  'Motivational':{ bg: '#1A1A18', headline: '#F5F0E8', eyebrow: '#4A6741', style: 'bold'       },
  'Product':     { bg: '#1E3A2F', headline: '#F5F0E8', eyebrow: '#C4B49A', style: 'product'    },
  'Social Proof':{ bg: '#F5F0E8', headline: '#1E3A2F', eyebrow: '#C4B49A', style: 'quote'      }
};

const BOARDS = [
  'content ideas for small businesses',
  'how to write social media captions',
  'social media tips for small businesses',
  'Done for you marketing for small businesses',
  'Marketing strategy for small businesses',
  'facebook marketing for small business',
  'Instagram marketing tips'
];

// ── SETUP ────────────────────────────────────────────────────────────────────

function setup() {
  const ss = getSpreadsheet();

  // ── Content sheet ──
  let content = ss.getSheetByName(SHEETS.CONTENT) || ss.insertSheet(SHEETS.CONTENT);
  if (content.getLastRow() === 0) {
    const headers = [
      'ID', 'Created', 'Scheduled Date', 'Type', 'Pillar', 'Channel / Board',
      'Title / Headline', 'Body Copy', 'CTA', 'Image URL', 'Status',
      'Published URL', 'Published At', 'Slug', 'Notes'
    ];
    content.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#F5F0E8');
    content.setFrozenRows(1);

    // Dropdowns
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Draft', 'Approved', 'Published', 'Failed'], true).build();
    content.getRange(2, COL.STATUS, 2000, 1).setDataValidation(statusRule);

    const typeRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Blog', 'Facebook', 'Pinterest'], true).build();
    content.getRange(2, COL.TYPE, 2000, 1).setDataValidation(typeRule);

    const pillarRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(PILLARS, true).build();
    content.getRange(2, COL.PILLAR, 2000, 1).setDataValidation(pillarRule);

    content.setColumnWidth(COL.BODY, 420);
    content.setColumnWidth(COL.TITLE, 260);
    content.setColumnWidth(COL.NOTES, 260);
    content.setColumnWidth(COL.IMAGE_URL, 200);
  }

  // ── Strategy sheet ──
  let strategy = ss.getSheetByName(SHEETS.STRATEGY) || ss.insertSheet(SHEETS.STRATEGY);
  if (strategy.getLastRow() === 0) {
    const headers = ['Week Of', 'Top Pillar', 'Top Post', 'Recommendations', 'Next Week Focus'];
    strategy.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#F5F0E8');
    strategy.setFrozenRows(1);
    strategy.setColumnWidth(4, 520);
  }

  // ── Analytics sheet ──
  let analytics = ss.getSheetByName(SHEETS.ANALYTICS) || ss.insertSheet(SHEETS.ANALYTICS);
  if (analytics.getLastRow() === 0) {
    const headers = [
      'Week Of', 'Blog Views', 'Pinterest Impressions', 'Pinterest Saves',
      'Pinterest Clicks', 'Facebook Reach', 'Facebook Engagement',
      'Top Pinterest Pin', 'Top Facebook Post'
    ];
    analytics.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#F5F0E8');
    analytics.setFrozenRows(1);
  }

  // ── Config sheet ──
  let config = ss.getSheetByName(SHEETS.CONFIG) || ss.insertSheet(SHEETS.CONFIG);
  if (config.getLastRow() === 0) {
    const rows = [
      ['Key', 'Value', 'Notes'],
      ['CLAUDE_API_KEY',            '', 'console.anthropic.com → API Keys'],
      ['PINTEREST_ACCESS_TOKEN',    '', 'developers.pinterest.com → Apps → Access token'],
      ['PINTEREST_BOARD_IDS',       '', 'Auto-filled by fetchPinterestBoardIds()'],
      ['FACEBOOK_PAGE_ID',          '', 'Your Facebook Page numeric ID'],
      ['FACEBOOK_ACCESS_TOKEN',     '', 'Long-lived Page Access Token'],
      ['GITHUB_TOKEN',              '', 'github.com → Settings → Developer Settings → PAT (classic) → repo scope'],
      ['GITHUB_REPO',               'Q4R8LM/thecontentdrop.ca', 'Pre-filled'],
      ['SITE_URL',                  'https://thecontentdrop.ca', 'Pre-filled'],
      ['STRIPE_URL',                'https://buy.stripe.com/cNi14n635frj7h9fFtgMw00', 'Pre-filled'],
      ['LAST_GENERATED',            '', 'Auto-filled — prevents duplicate generation'],
    ];
    config.getRange(1, 1, rows.length, 3).setValues(rows);
    config.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#F5F0E8');
    config.setColumnWidth(1, 230);
    config.setColumnWidth(2, 380);
    config.setColumnWidth(3, 320);
    // Hide the config sheet from casual view
    config.hideSheet();
  }

  // ── Canva Queue sheet ──
  let canva = ss.getSheetByName(SHEETS.CANVA) || ss.insertSheet(SHEETS.CANVA);
  if (canva.getLastRow() === 0) {
    const headers = ['Month', 'Platform', 'Template', 'eyebrow', 'headline1', 'headline2', 'supporting1', 'supporting2', 'punchline1', 'punchline2'];
    canva.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#1E3A2F').setFontColor('#F5F0E8');
    canva.setFrozenRows(1);
    canva.setColumnWidth(4, 180);
    canva.setColumnWidth(5, 300);
    canva.setColumnWidth(6, 150);
    canva.setColumnWidth(7, 250);
    canva.setColumnWidth(8, 200);
    canva.setColumnWidth(9, 250);
    canva.setColumnWidth(10, 200);
  }

  setupTriggers();

  SpreadsheetApp.getUi().alert(
    '✅ Setup complete!\n\n' +
    'Next steps:\n' +
    '1. Go to Config sheet (right-click tab → Show) and fill in all API keys\n' +
    '2. Run fetchPinterestBoardIds() from the Content Drop menu\n' +
    '3. Content will auto-generate on the 1st of each month at 7am\n' +
    '4. Change any row Status to "Approved" to publish immediately'
  );
}

function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // Monthly generation — 1st of every month at 7am
  ScriptApp.newTrigger('monthlyGenerate')
    .timeBased().onMonthDay(1).atHour(7).create();

  // Approval processing — every hour (catches any Approved rows missed by onEdit)
  ScriptApp.newTrigger('processApprovedRows')
    .timeBased().everyHours(1).create();

  // Monthly analytics — last Sunday of the month at 8am (runs weekly, only logs if end of month)
  ScriptApp.newTrigger('weeklyAnalytics')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(8).create();

  // Customer delivery — check for Pending rows every 5 minutes
  ScriptApp.newTrigger('processPendingDeliveries')
    .timeBased().everyMinutes(5).create();

  // Customer delivery approval — fires when owner changes Status to "Approved"
  ScriptApp.newTrigger('onEditDeliveries')
    .forSpreadsheet(SpreadsheetApp.openById('1zIZa5OSUSLHFRWcYY59YdZZAjB5ng2uoBW1YNryEOVI'))
    .onEdit().create();
}

// ── CUSTOM MENU ──────────────────────────────────────────────────────────────

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Content Drop')
    .addItem('Generate Monthly Content', 'monthlyGenerate')
    .addItem('Process Approved Rows', 'processApprovedRows')
    .addSeparator()
    .addItem('Fetch Pinterest Board IDs', 'fetchPinterestBoardIds')
    .addSeparator()
    .addItem('List Uploaded Image URLs', 'listImageUrls')
    .addSeparator()
    .addItem('Run Weekly Analytics', 'weeklyAnalytics')
    .addSeparator()
    .addItem('Process Pending Deliveries', 'processPendingDeliveries')
    .addToUi();
}

// ── CONFIG HELPERS ────────────────────────────────────────────────────────────

const SPREADSHEET_ID = '1zIZa5OSUSLHFRWcYY59YdZZAjB5ng2uoBW1YNryEOVI';

function getSpreadsheet() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function getConfig(key) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) return data[i][1] ? String(data[i][1]).trim() : '';
  }
  return '';
}

function setConfig(key, value) {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONFIG);
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) { sheet.getRange(i + 1, 2).setValue(value); return; }
  }
  sheet.appendRow([key, value, '']);
}

// ── PINTEREST BOARD IDs ───────────────────────────────────────────────────────

function fetchPinterestBoardIds() {
  const token = getConfig('PINTEREST_ACCESS_TOKEN');
  if (!token) {
    SpreadsheetApp.getUi().alert('Add PINTEREST_ACCESS_TOKEN to the Config sheet first.');
    return;
  }
  const res = UrlFetchApp.fetch('https://api.pinterest.com/v5/boards?page_size=50', {
    headers: { 'Authorization': 'Bearer ' + token },
    muteHttpExceptions: true
  });
  const data = JSON.parse(res.getContentText());
  const boards = data.items || [];
  const boardMap = {};
  boards.forEach(b => { boardMap[b.name.toLowerCase().trim()] = b.id; });
  setConfig('PINTEREST_BOARD_IDS', JSON.stringify(boardMap));
  const summary = boards.map(b => `${b.name}`).join('\n');
  SpreadsheetApp.getUi().alert('Found ' + boards.length + ' boards:\n\n' + summary + '\n\nIDs saved to Config.');
}

function getBoardId(boardName) {
  const raw = getConfig('PINTEREST_BOARD_IDS');
  if (!raw) return null;
  try {
    const map = JSON.parse(raw);
    return map[boardName.toLowerCase().trim()] || null;
  } catch(e) { return null; }
}

// ── WEEKLY CONTENT GENERATION ─────────────────────────────────────────────────

function monthlyGenerate() {
  const tz = Session.getScriptTimeZone();
  const month = Utilities.formatDate(new Date(), tz, 'yyyy-MM');
  if (getConfig('LAST_GENERATED') === month) {
    Logger.log('Already generated for ' + month + ' — skipping.');
    return;
  }
  Logger.log('Starting monthly content generation for ' + month + '...');
  generatePinterestPins();
  generateFacebookPosts();
  generateBlogPosts();
  setConfig('LAST_GENERATED', month);
  Logger.log('Generation complete for ' + month + '.');
}

// ── PINTEREST PIN GENERATION ──────────────────────────────────────────────────

function generatePinterestPins() {
  Logger.log('Generating Pinterest pins...');

  const prompt = `You are a content strategist for The Content Drop (thecontentdrop.ca). The business sells custom social media captions to small business owners: 24 captions written for your specific business, delivered in 48 hours, $45 one-time. The customer fills out a 10-question survey about their brand and audience, a marketer generates and reviews the captions before delivery.

Generate exactly 3 Pinterest pins for testing purposes.

Return ONLY a valid JSON array — no other text, no markdown, no code fences. Each object:
{
  "headline1": "first line of the graphic — sets up a tension or surprise (8-10 words)",
  "headline2": "short twist word or phrase that reframes headline1 (1-3 words, ends with a period)",
  "supporting1": "first elaboration line, light weight (3-6 words)",
  "supporting2": "second elaboration line, bold (2-5 words)",
  "punchline1": "reframe that resolves the tension, italic (4-7 words)",
  "punchline2": "final closer the whole piece builds toward, bold italic (2-4 words)",
  "description": "pin description 150-200 chars, naturally includes a search keyword, ends with thecontentdrop.ca",
  "pillar": one of ["Education", "Tip", "Industry", "Motivational", "Product", "Social Proof"],
  "board": one of ["content ideas for small businesses", "how to write social media captions", "social media tips for small businesses", "Done for you marketing for small businesses", "Marketing strategy for small businesses", "facebook marketing for small business", "Instagram marketing tips"],
  "week": integer 1,
  "slot": integer 1-3
}

The 6 fields form THREE pairs. Each pair is ONE complete sentence split in two for visual impact. Write each pair as a single sentence first, then split it.

PAIR 1 — headline1 + headline2:
One sentence split into two parts. headline1 is the setup (6-9 words). headline2 is the short ending that lands the twist (1-3 words, ends with a period). Read together they form one complete sentence.

PAIR 2 — supporting1 + supporting2:
One sentence split into two parts. supporting1 is the first half (4-6 words). supporting2 is the second half that delivers the contrast (2-4 words, ends with a period). Read together they form one complete sentence.

PAIR 3 — punchline1 + punchline2:
One sentence split into two parts. punchline1 is the setup of the payoff (3-6 words). punchline2 is the final word or phrase that makes the whole thing land (1-3 words, ends with a period). This is what the reader takes away.

The three pairs build together: pair 1 sets up the tension, pair 2 twists it, pair 3 resolves it.
Tone: dry, direct, confident. No filler. No questions.

EXAMPLE — read each pair as one sentence:
headline1: "Your audience has seen your post" + headline2: "once."
→ "Your audience has seen your post once."

supporting1: "You've seen it" + supporting2: "ten times."
→ "You've seen it ten times."

punchline1: "That's not repetitive." + punchline2: "That's strategy."
→ "That's not repetitive. That's strategy."

ANOTHER EXAMPLE:
headline1: "The caption you almost didn't post" + headline2: "performed."
→ "The caption you almost didn't post performed."

supporting1: "The one you spent two hours on" + supporting2: "got three likes."
→ "The one you spent two hours on got three likes."

punchline1: "Done beats perfect" + punchline2: "every time."
→ "Done beats perfect every time."

Distribution rules:
- Education 25% (longer-form teaching: frameworks, myth-busting, strategy breakdowns)
- Tip 20% (single sharp actionable tip — short, punchy, immediately useful)
- Industry 20% (specific content for: hair salons, restaurants, fitness studios, real estate, coaches)
- Product 20% (what The Content Drop is, how it works, what you get)
- Social Proof 10% (client results framing — e.g. "What $45 got this salon owner")
- Motivational 5% (short inspirational statements for small business owners)

Board routing: match board to content topic. Caption tips → "how to write social media captions". General small biz → "content ideas for small businesses". Facebook-specific → "facebook marketing for small business". Instagram-specific → "Instagram marketing tips". Strategy → "Marketing strategy for small businesses". Done-for-you → "Done for you marketing for small businesses".

Headlines must be specific: "The 3-word hook that doubles caption engagement" not "Write better captions".
Include at least 4 pins that reference specific industries (hair salons, restaurants, fitness, real estate, coaches).`;

  const response = callClaude(prompt, 8000);
  let pins;
  try {
    pins = JSON.parse(response);
  } catch(e) {
    // Try extracting JSON if Claude added any preamble
    const match = response.match(/\[[\s\S]*\]/);
    if (match) pins = JSON.parse(match[0]);
    else throw new Error('Could not parse Pinterest pins JSON: ' + e.message);
  }

  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONTENT);
  const canvaSheet = getSpreadsheet().getSheetByName(SHEETS.CANVA);
  const startDate = getNextMonday();
  const weekOf = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM');
  const slotDays = [0, 2, 3, 5, 6]; // Mon, Wed, Thu, Sat, Sun
  const slotHours = [8, 11, 14, 17, 20];
  const now = new Date();
  const rows = [];
  const canvaRows = [];

  pins.forEach(pin => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + ((pin.week - 1) * 7) + (slotDays[(pin.slot - 1)] || 0));
    d.setHours(slotHours[(pin.slot - 1)] || 14, 0, 0, 0);
    rows.push([
      nextId(sheet), now, d, 'Pinterest', pin.pillar, pin.board,
      pin.headline1, pin.description, 'thecontentdrop.ca', '',
      'Draft', '', '', '', pin.eyebrow
    ]);
    // All Pinterest pins go to Canva Queue — eyebrow is always MARKETING TIP for this template
    canvaRows.push([weekOf, 'Pinterest', 'Marketing Tip', 'MARKETING TIP', pin.headline1, pin.headline2, pin.supporting1, pin.supporting2, pin.punchline1, pin.punchline2]);
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 15).setValues(rows);
  if (canvaRows.length && canvaSheet) canvaSheet.getRange(canvaSheet.getLastRow() + 1, 1, canvaRows.length, 10).setValues(canvaRows);
  Logger.log('Added ' + rows.length + ' Pinterest pins to Content sheet and Canva Queue.');
}

// ── FACEBOOK POST GENERATION ──────────────────────────────────────────────────

function generateFacebookPosts() {
  Logger.log('Generating Facebook posts...');

  const prompt = `You are a content strategist for The Content Drop (thecontentdrop.ca). Custom social media captions for small business owners: 24 captions, $45, 48 hours. Customer fills a survey, a marketer generates and reviews before delivery.

Generate exactly 2 Facebook posts for testing purposes.

Return ONLY a valid JSON array — no other text, no markdown, no code fences. Each object:
{
  "title": "short internal reference label (not shown publicly)",
  "body": "Full Facebook post. 60-100 words MAXIMUM. Hook first line. Line breaks for readability. Conversational, not salesy. Ends with question or CTA.",
  "cta": "call to action text only",
  "pillar": one of ["Education", "Tip", "Industry", "Motivational", "Product", "Social Proof"],
  "week": integer 1,
  "day": integer 1-7 (1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun),
  "headline1": "FOR TIP POSTS ONLY — first line of the graphic headline (e.g. 'Your audience has seen your post')",
  "headline2": "FOR TIP POSTS ONLY — short italic accent word or phrase (e.g. 'once.')",
  "supporting1": "FOR TIP POSTS ONLY — first supporting line (e.g. 'You've seen it ten times.')",
  "supporting2": "FOR TIP POSTS ONLY — second supporting line (e.g. 'ten times.')",
  "punchline1": "FOR TIP POSTS ONLY — first line of the punchline (e.g. 'That\\'s not repetitive.')",
  "punchline2": "FOR TIP POSTS ONLY — second line of the punchline, bold (e.g. 'That\\'s strategy.')"
}

For non-Tip posts, set headline1, headline2, supporting1, supporting2, punchline1, punchline2 to empty strings.

For this test generate 2 posts: one Tip post (day 4, Thursday) and one Education post (day 1, Monday). Both in week 1.

The Tip post uses a fixed graphic template with exactly 6 fields. Write all 6 as one cohesive piece of copy — they must work together as a single flowing thought, not 6 separate sentences. The structure is:

headline1 — a relatable statement that sets up a tension or surprise (8-10 words)
headline2 — a short twist word or phrase that reframes headline1 and lands the surprise (1-3 words, ends with a period)
supporting1 — the first line of the elaboration, sets up the flip (3-6 words, light/regular weight)
supporting2 — the second line that completes the elaboration with punch (2-5 words, bold)
punchline1 — the reframe that resolves the tension (4-7 words, italic)
punchline2 — the final closer that makes it stick — this is the insight the reader takes away (2-4 words, bold italic)

Example of correct structure:
headline1: "Your audience has seen your post"
headline2: "once."
supporting1: "You've seen it"
supporting2: "ten times."
punchline1: "That's not repetitive."
punchline2: "That's strategy."

Write copy where the insight builds across all 6 lines and punchline2 is the payoff the whole piece has been building toward. The Education post leaves all 6 Canva fields as empty strings.

Voice: Direct, dry wit, professional. No exclamation marks unless truly earned. Sounds like a real marketer, not a cheerful AI assistant.`;

  const response = callClaude(prompt, 4000);
  let posts;
  try {
    posts = JSON.parse(response);
  } catch(e) {
    const match = response.match(/\[[\s\S]*\]/);
    if (match) posts = JSON.parse(match[0]);
    else throw new Error('Could not parse Facebook posts JSON: ' + e.message);
  }

  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONTENT);
  const canvaSheet = getSpreadsheet().getSheetByName(SHEETS.CANVA);
  const startDate = getNextMonday();
  const monthOf = Utilities.formatDate(startDate, Session.getScriptTimeZone(), 'yyyy-MM');
  const now = new Date();
  const rows = [];
  const canvaRows = [];

  posts.forEach(post => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + ((post.week - 1) * 7) + (post.day - 1));
    d.setHours(10, 0, 0, 0);
    rows.push([
      nextId(sheet), now, d, 'Facebook', post.pillar, 'Facebook Page',
      post.title, post.body, post.cta, '',
      'Draft', '', '', '', ''
    ]);
    if (post.pillar === 'Tip' && post.headline1) {
      canvaRows.push([monthOf, 'Facebook', 'Marketing Tip', 'MARKETING TIP', post.headline1, post.headline2, post.supporting1, post.supporting2, post.punchline1, post.punchline2]);
    }
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 15).setValues(rows);
  if (canvaRows.length && canvaSheet) canvaSheet.getRange(canvaSheet.getLastRow() + 1, 1, canvaRows.length, 10).setValues(canvaRows);
  Logger.log('Added ' + rows.length + ' Facebook posts, ' + canvaRows.length + ' Tip posts to Canva Queue.');
}

// ── BLOG POST GENERATION ──────────────────────────────────────────────────────

function generateBlogPosts() {
  Logger.log('Generating blog posts...');

  // Collect existing titles to avoid duplicates
  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONTENT);
  const data = sheet.getDataRange().getValues();
  const existing = data.filter(r => r[COL.TYPE - 1] === 'Blog').map(r => r[COL.TITLE - 1]);

  const prompt = `You are a content strategist and writer for The Content Drop (thecontentdrop.ca). Custom social media captions for small business owners: 24 captions, $45, 48 hours.

Generate exactly 2 blog posts targeting high-intent or high-volume search keywords.

Existing posts — do NOT duplicate these topics:
- Why Consistency Beats Perfection Every Time on Social Media
- How to Write Social Media Captions That Actually Convert
- You Are Not Your Customer — The Most Expensive Mistake in Small Business Marketing
${existing.join('\n')}

Return ONLY valid JSON array — no other text, no markdown, no code fences. Each object:
{
  "title": "SEO title including primary keyword",
  "slug": "lowercase-hyphenated-slug-no-extension",
  "meta_description": "under 155 chars, includes keyword, compelling",
  "target_keyword": "primary keyword",
  "pillar": one of ["Education", "Tip", "Industry", "Motivational", "Product", "Social Proof"],
  "excerpt": "2 sentences for the blog card preview",
  "read_time": "X min read",
  "body_html": "Full article HTML using only <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em> tags. 900-1200 words. Practical and specific. Final paragraph naturally leads to The Content Drop. Use relative link captions.html for product references."
}

One post should target a specific industry keyword (e.g. 'social media captions for photographers' or 'Instagram captions for real estate agents').
One post should be a broader strategy/education post (e.g. 'how to batch social media content', 'why your Instagram isn't growing').
Write for small business owners — practical, zero jargon, no filler.`;

  const response = callClaude(prompt, 12000);
  let posts;
  try {
    posts = JSON.parse(response);
  } catch(e) {
    const match = response.match(/\[[\s\S]*\]/);
    if (match) posts = JSON.parse(match[0]);
    else throw new Error('Could not parse blog posts JSON: ' + e.message);
  }

  const startDate = getNextMonday();
  const now = new Date();
  const rows = [];

  posts.forEach((post, i) => {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + (i * 3)); // Space 3 days apart
    d.setHours(9, 0, 0, 0);
    // Store excerpt and read_time in Notes column for use during publishing
    const notes = [post.target_keyword, post.read_time, post.excerpt].join(' || ');
    rows.push([
      nextId(sheet), now, d, 'Blog', post.pillar, 'Blog',
      post.title, post.body_html, post.meta_description, '',
      'Draft', '', '', post.slug, notes
    ]);
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 15).setValues(rows);
  Logger.log('Added ' + rows.length + ' blog posts.');
}

// ── IMAGE GENERATION (Google Slides) ─────────────────────────────────────────
// Images are generated at approval time, not content generation time.
// Pinterest: eyebrow stored in Notes column, retrieved here.
// Facebook: headline only.

// EMUs: 1 inch = 914400. Pinterest 2:3 ratio, Facebook ~1.9:1 ratio.
const IMG = {
  PIN_W: 9144000,  PIN_H: 13716000,   // 10 × 15 inches
  FB_W:  11430000, FB_H:  6006750     // 12.5 × 6.5625 inches
};

function getOrCreateImageFolder_() {
  const name = 'Content Drop — Generated Images';
  const iter = DriveApp.getFoldersByName(name);
  return iter.hasNext() ? iter.next() : DriveApp.createFolder(name);
}

// ── LIST UPLOADED IMAGES ──────────────────────────────────────────────────────
// Run this after uploading images to the "Content Drop — Generated Images" folder.
// It logs every image file and its shareable URL — copy the URL into the sheet.

function listImageUrls() {
  const folder = getOrCreateImageFolder_();
  const files  = folder.getFiles();
  const lines  = ['Images in Content Drop — Generated Images folder:\n'];
  while (files.hasNext()) {
    const f = files.next();
    f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const url = 'https://drive.google.com/uc?export=view&id=' + f.getId();
    lines.push(f.getName() + '\n→ ' + url + '\n');
  }
  Logger.log(lines.join('\n'));
  SpreadsheetApp.getUi().alert(lines.join('\n'));
}

function createSizedPresentation_(wEmu, hEmu) {
  const pres = Slides.Presentations.create({
    pageSize: {
      width:  { magnitude: wEmu, unit: 'EMU' },
      height: { magnitude: hEmu, unit: 'EMU' }
    }
  });
  return pres.presentationId;
}

function generatePinImage(eyebrow, headline, pillar) {
  const tpl  = TEMPLATES[pillar] || TEMPLATES['Industry'];
  const pid  = createSizedPresentation_(IMG.PIN_W, IMG.PIN_H);
  const pres = SlidesApp.openById(pid);
  const slide = pres.getSlides()[0];
  slide.getPageElements().forEach(function(el) { el.remove(); });
  slide.getBackground().setSolidFill(tpl.bg);
  buildPinContent_(slide, eyebrow, headline, tpl, pres.getPageWidth(), pres.getPageHeight());
  pres.saveAndClose();
  const url = exportSlideAsPng_(pid, 'pin_' + pillar.replace(/ /g,'') + '_' + Date.now());
  try { DriveApp.getFileById(pid).setTrashed(true); } catch(e) {}
  return url;
}

function generateFBImage(headline, pillar) {
  const tpl  = TEMPLATES[pillar] || TEMPLATES['Product'];
  const pid  = createSizedPresentation_(IMG.FB_W, IMG.FB_H);
  const pres = SlidesApp.openById(pid);
  const slide = pres.getSlides()[0];
  slide.getPageElements().forEach(function(el) { el.remove(); });
  slide.getBackground().setSolidFill(tpl.bg);
  buildFBContent_(slide, headline, tpl, pres.getPageWidth(), pres.getPageHeight());
  pres.saveAndClose();
  const url = exportSlideAsPng_(pid, 'fb_' + pillar.replace(/ /g,'') + '_' + Date.now());
  try { DriveApp.getFileById(pid).setTrashed(true); } catch(e) {}
  return url;
}

function buildPinContent_(slide, eyebrow, headline, tpl, W, H) {
  var M  = W * 0.08;
  var CW = W - M * 2;
  var isCentered = (tpl.style === 'center' || tpl.style === 'bold' || tpl.style === 'product');
  var align = isCentered ? SlidesApp.ParagraphAlignment.CENTER : SlidesApp.ParagraphAlignment.START;

  // Style-specific accent elements
  if (tpl.style === 'left') {
    var bar = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, M, H * 0.11, 5, H * 0.22);
    bar.getFill().setSolidFill('#C4B49A'); bar.getBorder().setTransparent();
  } else if (tpl.style === 'tip') {
    var corner = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W * 0.09, W * 0.09);
    corner.getFill().setSolidFill('#C4B49A'); corner.getBorder().setTransparent();
  } else if (tpl.style === 'quote') {
    var q = slide.insertTextBox('\u201C', M, H * 0.05, CW, H * 0.22);
    q.getText().getTextStyle().setFontFamily('Playfair Display').setFontSize(160)
      .setForegroundColor('#C4B49A').setBold(true);
    q.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
  } else if (tpl.style === 'product') {
    var band = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, H * 0.83, W, H * 0.09);
    band.getFill().setSolidFill('#C4B49A'); band.getBorder().setTransparent();
    var bText = slide.insertTextBox('thecontentdrop.ca', M, H * 0.845, CW, H * 0.065);
    bText.getText().getTextStyle().setFontFamily('DM Mono').setFontSize(20).setForegroundColor('#1E3A2F');
    bText.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }

  // Eyebrow
  if (eyebrow) {
    var eyY = isCentered ? H * 0.28 : H * 0.11;
    var ey  = slide.insertTextBox(String(eyebrow).toUpperCase(), M, eyY, CW, H * 0.07);
    ey.getText().getTextStyle().setFontFamily('DM Mono').setFontSize(22).setForegroundColor(tpl.eyebrow);
    ey.getText().getParagraphStyle().setParagraphAlignment(align);
  }

  // Headline
  var hlY = tpl.style === 'quote' ? H * 0.22
          : (eyebrow ? (isCentered ? H * 0.37 : H * 0.20) : H * 0.28);
  var hl = slide.insertTextBox(headline, M, hlY, CW, H * 0.48);
  hl.getText().getTextStyle().setFontFamily('Playfair Display').setFontSize(54)
    .setForegroundColor(tpl.headline).setBold(true);
  hl.getText().getParagraphStyle().setParagraphAlignment(align);

  // Watermark (skipped for product style — it's in the band)
  if (tpl.style !== 'product') {
    var wm = slide.insertTextBox('thecontentdrop.ca', M, H * 0.89, CW, H * 0.06);
    wm.getText().getTextStyle().setFontFamily('DM Mono').setFontSize(16)
      .setForegroundColor(tpl.bg === '#F5F0E8' ? '#C4B49A' : '#F5F0E8').setItalic(true);
    wm.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
}

function buildFBContent_(slide, headline, tpl, W, H) {
  var M  = W * 0.07;
  var CW = W - M * 2;

  // Style-specific accent elements
  if (tpl.style === 'left' || tpl.style === 'tip') {
    var bar = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W, H * 0.055);
    bar.getFill().setSolidFill('#C4B49A'); bar.getBorder().setTransparent();
  } else if (tpl.style === 'product') {
    var band = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, H * 0.87, W, H * 0.13);
    band.getFill().setSolidFill('#C4B49A'); band.getBorder().setTransparent();
    var bText = slide.insertTextBox('thecontentdrop.ca', M, H * 0.895, CW, H * 0.09);
    bText.getText().getTextStyle().setFontFamily('DM Mono').setFontSize(18).setForegroundColor('#1E3A2F');
    bText.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  } else if (tpl.style === 'quote') {
    var q = slide.insertTextBox('\u201C', M, H * 0.03, W * 0.14, H * 0.35);
    q.getText().getTextStyle().setFontFamily('Playfair Display').setFontSize(100)
      .setForegroundColor('#C4B49A').setBold(true);
    q.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.START);
  }

  // Headline — centered vertically in available space
  var hl = slide.insertTextBox(headline, M, H * 0.18, CW, H * 0.62);
  hl.getText().getTextStyle().setFontFamily('Playfair Display').setFontSize(48)
    .setForegroundColor(tpl.headline).setBold(true);
  hl.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  hl.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);

  // Watermark (skipped for product style)
  if (tpl.style !== 'product') {
    var wm = slide.insertTextBox('thecontentdrop.ca', M, H * 0.87, CW, H * 0.1);
    wm.getText().getTextStyle().setFontFamily('DM Mono').setFontSize(14)
      .setForegroundColor(tpl.bg === '#F5F0E8' ? '#C4B49A' : '#F5F0E8').setItalic(true);
    wm.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
}

function exportSlideAsPng_(presId, fileName) {
  const pres        = Slides.Presentations.get(presId, { fields: 'slides.objectId' });
  const pageObjId   = pres.slides[0].objectId;
  const thumb       = Slides.Presentations.Pages.getThumbnail(presId, pageObjId, {
    'thumbnailProperties.thumbnailSize': 'LARGE'
  });
  if (!thumb.contentUrl) throw new Error('Thumbnail generation failed');
  const imgBlob = UrlFetchApp.fetch(thumb.contentUrl).getBlob().setName(fileName + '.png');
  const folder  = getOrCreateImageFolder_();
  const file    = folder.createFile(imgBlob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

// ── APPROVAL TRIGGER (onEdit) ────────────────────────────────────────────────

function onEdit(e) {
  if (!e) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEETS.CONTENT) return;
  if (e.range.getColumn() !== COL.STATUS) return;
  if (e.value !== 'Approved') return;
  const row = e.range.getRow();
  if (row <= 1) return;
  Utilities.sleep(300);
  publishRow(row);
}

// Hourly fallback — catches any Approved rows where onEdit may have missed
function processApprovedRows() {
  const sheet = getSpreadsheet().getSheetByName(SHEETS.CONTENT);
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][COL.STATUS - 1] === 'Approved' && !data[i][COL.PUB_AT - 1]) {
      publishRow(i + 1);
      Utilities.sleep(1500);
    }
  }
}

// ── PUBLISH DISPATCHER ────────────────────────────────────────────────────────

function publishRow(rowNum) {
  const sheet   = getSpreadsheet().getSheetByName(SHEETS.CONTENT);
  const row     = sheet.getRange(rowNum, 1, 1, 15).getValues()[0];
  const type    = row[COL.TYPE     - 1];
  const pillar  = row[COL.PILLAR   - 1];
  const channel = row[COL.CHANNEL  - 1];
  const title   = row[COL.TITLE    - 1];
  const body    = row[COL.BODY     - 1];
  const cta     = row[COL.CTA      - 1];
  const imgUrl  = row[COL.IMAGE_URL- 1];
  const slug    = row[COL.SLUG     - 1];
  const notes   = row[COL.NOTES    - 1] || '';

  const noteParts = notes.split('||').map(s => s.trim());
  const readTime  = noteParts[1] || '5 min read';
  const excerpt   = noteParts[2] || cta.slice(0, 120);

  try {
    // Images are created manually in Canva and uploaded to Drive.
    // Paste the shareable Drive URL into the Image URL column before approving.
    if (type === 'Pinterest' && !imgUrl) {
      throw new Error('No image URL. Create the image in Canva, upload to Drive, and paste the URL into the Image URL column before approving.');
    }
    // Facebook: image is optional — falls back to text-only post if no URL provided.

    let pubUrl = '';
    if      (type === 'Pinterest') pubUrl = publishPinterest(title, body, imgUrl, channel);
    else if (type === 'Facebook')  pubUrl = publishFacebook(body + '\n\n' + cta, imgUrl, title);
    else if (type === 'Blog')      pubUrl = publishBlog(title, slug, body, cta, pillar, excerpt, readTime);

    sheet.getRange(rowNum, COL.STATUS).setValue('Published');
    sheet.getRange(rowNum, COL.PUB_URL).setValue(pubUrl);
    sheet.getRange(rowNum, COL.PUB_AT).setValue(new Date());
    Logger.log('Published [' + type + ']: ' + title);

  } catch(err) {
    sheet.getRange(rowNum, COL.STATUS).setValue('Failed');
    sheet.getRange(rowNum, COL.NOTES).setValue(notes + ' | ERR: ' + err.message);
    Logger.log('FAILED [' + type + ']: ' + title + ' — ' + err.message);
  }
}

// ── PINTEREST PUBLISHER ───────────────────────────────────────────────────────

function publishPinterest(headline, description, imageUrl, boardName) {
  const token   = getConfig('PINTEREST_ACCESS_TOKEN');
  const boardId = getBoardId(boardName);
  const siteUrl = getConfig('SITE_URL') || 'https://thecontentdrop.ca';

  if (!boardId) throw new Error('Board ID not found for "' + boardName + '". Run Fetch Pinterest Board IDs from the menu.');
  if (!imageUrl) throw new Error('No image URL for this pin. Paste a public Drive image URL into the Image URL column.');

  const res = UrlFetchApp.fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({
      board_id:     boardId,
      title:        String(headline).slice(0, 100),
      description:  String(description).slice(0, 500),
      link:         siteUrl + '/captions.html',
      alt_text:     String(headline).slice(0, 500),
      media_source: { source_type: 'image_url', url: imageUrl }
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(res.getContentText());
  if (result.id) return 'https://www.pinterest.com/pin/' + result.id;
  throw new Error(res.getContentText());
}

// ── FACEBOOK PUBLISHER ────────────────────────────────────────────────────────

function publishFacebook(message, imageUrl, title) {
  const pageId  = getConfig('FACEBOOK_PAGE_ID');
  const token   = getConfig('FACEBOOK_ACCESS_TOKEN');
  const siteUrl = getConfig('SITE_URL') || 'https://thecontentdrop.ca';

  let endpoint, payload;

  if (imageUrl) {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
    payload  = { url: imageUrl, message: message, access_token: token };
  } else {
    endpoint = `https://graph.facebook.com/v19.0/${pageId}/feed`;
    payload  = { message: message, link: siteUrl + '/captions.html', access_token: token };
  }

  const res    = UrlFetchApp.fetch(endpoint, { method: 'POST', payload: payload, muteHttpExceptions: true });
  const result = JSON.parse(res.getContentText());

  if (result.id) {
    const parts = result.id.split('_');
    return `https://www.facebook.com/${pageId}/posts/${parts[1] || parts[0]}`;
  }
  throw new Error(res.getContentText());
}

// ── BLOG PUBLISHER (GitHub API) ───────────────────────────────────────────────

function publishBlog(title, slug, bodyHtml, metaDesc, pillar, excerpt, readTime) {
  const token   = getConfig('GITHUB_TOKEN');
  const repo    = getConfig('GITHUB_REPO') || 'Q4R8LM/thecontentdrop.ca';
  const siteUrl = getConfig('SITE_URL')    || 'https://thecontentdrop.ca';
  const stripe  = getConfig('STRIPE_URL')  || 'https://buy.stripe.com/cNi14n635frj7h9fFtgMw00';

  const filename = `blog-${slug}.html`;
  const apiUrl   = `https://api.github.com/repos/${repo}/contents/${filename}`;
  const fullHtml = buildBlogHtml(title, slug, bodyHtml, metaDesc, pillar, readTime, siteUrl, stripe);
  const encoded  = Utilities.base64Encode(fullHtml, Utilities.Charset.UTF_8);

  // Check if file already exists (need sha to update)
  let sha = null;
  const check = UrlFetchApp.fetch(apiUrl, {
    headers: { 'Authorization': 'token ' + token, 'User-Agent': 'ContentDrop' },
    muteHttpExceptions: true
  });
  if (check.getResponseCode() === 200) sha = JSON.parse(check.getContentText()).sha;

  const body = { message: 'Add blog post: ' + title, content: encoded, branch: 'main' };
  if (sha) body.sha = sha;

  const res = UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: { 'Authorization': 'token ' + token, 'User-Agent': 'ContentDrop', 'Content-Type': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  const result = JSON.parse(res.getContentText());
  if (!result.content) throw new Error(res.getContentText());

  // Update blog index page and sitemap
  updateBlogIndex(slug, title, excerpt, pillar, readTime, token, repo);
  updateSitemap(slug, token, repo, siteUrl);

  return siteUrl + '/' + filename;
}

// ── BLOG HTML BUILDER ─────────────────────────────────────────────────────────

function buildBlogHtml(title, slug, bodyHtml, metaDesc, pillar, readTime, siteUrl, stripeUrl) {
  const tagMap = {
    'Education':    'Social Media Strategy',
    'Tip':          'Quick Tip',
    'Industry':     'Industry Guide',
    'Motivational': 'Small Business',
    'Product':      'Content Strategy',
    'Social Proof': 'Case Study'
  };
  const tag  = tagMap[pillar] || 'Marketing Strategy';
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'MMMM d, yyyy');
  const rt   = readTime || '5 min read';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} — The Content Drop</title>
<meta name="description" content="${esc(metaDesc)}">
<link rel="canonical" href="${siteUrl}/blog-${slug}.html">
<meta property="og:title" content="${esc(title)} — The Content Drop">
<meta property="og:description" content="${esc(metaDesc)}">
<meta property="og:url" content="${siteUrl}/blog-${slug}.html">
<meta property="og:type" content="article">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<script async src="https://www.googletagmanager.com/gtag/js?id=G-4TWPFW6PSF"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-4TWPFW6PSF');</script>
<style>
  :root{--cream:#F5F0E8;--cream-dark:#EDE7D9;--forest:#1E3A2F;--forest-light:#2D5240;--sand:#C4B49A;--sand-light:#D4C8B0;--charcoal:#1A1A18;--text-body:#3A3A36;--accent:#8B6F4E;}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  html{scroll-behavior:smooth;}
  body{font-family:'DM Sans',sans-serif;background-color:var(--cream);color:var(--charcoal);overflow-x:hidden;}
  nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;justify-content:space-between;align-items:center;padding:20px 48px;background:rgba(245,240,232,0.92);backdrop-filter:blur(12px);border-bottom:1px solid rgba(196,180,154,0.3);}
  .nav-logo{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:var(--forest);text-decoration:none;}
  .nav-links{display:flex;gap:36px;list-style:none;}
  .nav-links a{font-size:12px;letter-spacing:0.1em;text-transform:uppercase;color:var(--text-body);text-decoration:none;transition:color 0.2s;}
  .nav-links a:hover{color:var(--forest);}
  .nav-cta{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;letter-spacing:0.12em;text-transform:uppercase;color:var(--cream);background:var(--forest);padding:10px 22px;text-decoration:none;transition:background 0.2s;}
  .nav-cta:hover{background:var(--forest-light);}
  .hamburger{display:none;flex-direction:column;gap:5px;cursor:pointer;padding:4px;background:none;border:none;}
  .hamburger span{display:block;width:22px;height:2px;background:var(--forest);}
  .mobile-menu{display:none;position:fixed;top:61px;left:0;right:0;background:var(--forest);z-index:99;padding:24px 28px;flex-direction:column;gap:0;}
  .mobile-menu a{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:var(--cream);text-decoration:none;padding:16px 0;border-bottom:1px solid rgba(196,180,154,0.15);}
  .mobile-menu a:last-child{border-bottom:none;}
  @media(max-width:900px){.hamburger{display:flex;}.nav-cta{display:none;}}
  .post-hero{padding:140px 64px 80px;background:var(--forest);text-align:center;}
  .post-tag{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--sand);margin-bottom:20px;display:block;}
  .post-title{font-family:'Playfair Display',serif;font-size:clamp(32px,5vw,60px);font-weight:900;color:var(--cream);line-height:1.05;margin-bottom:20px;}
  .post-meta{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:rgba(245,240,232,0.4);}
  .post-body{padding:80px 64px;max-width:760px;margin:0 auto;}
  .post-body h2{font-family:'Playfair Display',serif;font-size:28px;font-weight:700;color:var(--forest);margin:48px 0 16px;line-height:1.2;}
  .post-body h3{font-family:'Playfair Display',serif;font-size:22px;font-weight:700;color:var(--forest);margin:36px 0 12px;}
  .post-body p{font-size:16px;font-weight:300;line-height:1.85;color:var(--text-body);margin-bottom:24px;}
  .post-body ul,.post-body ol{margin:0 0 24px 28px;}
  .post-body li{font-size:16px;font-weight:300;line-height:1.8;color:var(--text-body);margin-bottom:8px;}
  .post-body strong{font-weight:500;color:var(--forest);}
  .post-body em{font-style:italic;color:var(--forest);}
  .post-body a{color:var(--forest);text-decoration:underline;text-underline-offset:3px;}
  .post-cta{background:var(--cream-dark);padding:64px;text-align:center;margin:0;}
  .post-cta h2{font-family:'Playfair Display',serif;font-size:clamp(24px,3vw,38px);font-weight:900;color:var(--forest);margin-bottom:16px;line-height:1.2;}
  .post-cta h2 em{font-style:italic;}
  .post-cta p{font-size:15px;font-weight:300;color:var(--text-body);margin-bottom:32px;max-width:440px;margin-left:auto;margin-right:auto;line-height:1.7;}
  .btn{font-family:'DM Mono',monospace;font-size:11px;font-weight:500;letter-spacing:0.14em;text-transform:uppercase;color:var(--cream);background:var(--forest);padding:18px 40px;text-decoration:none;display:inline-block;transition:background 0.2s;}
  .btn:hover{background:var(--forest-light);}
  footer{background:var(--charcoal);padding:48px 64px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:24px;}
  .footer-logo{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;color:var(--sand);}
  .footer-links{display:flex;gap:32px;list-style:none;}
  .footer-links a{font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:rgba(245,240,232,0.4);text-decoration:none;transition:color 0.2s;}
  .footer-links a:hover{color:var(--sand);}
  .footer-email{font-size:11px;color:rgba(245,240,232,0.35);}
  @media(max-width:900px){nav{padding:18px 24px;}.nav-links{display:none;}.post-hero,.post-body,.post-cta{padding-left:28px;padding-right:28px;}.post-hero{padding-top:120px;padding-bottom:60px;}.post-body{padding-top:48px;padding-bottom:48px;}footer{flex-direction:column;gap:20px;padding:40px 28px;text-align:center;}.footer-links{flex-wrap:wrap;justify-content:center;}}
</style>
</head>
<body>
<nav>
  <a href="index.html" class="nav-logo">The Content Drop</a>
  <ul class="nav-links">
    <li><a href="shop.html">Shop</a></li>
    <li><a href="blog.html">Blog</a></li>
    <li><a href="results.html">Results</a></li>
    <li><a href="free.html">Free</a></li>
    <li><a href="about.html">About</a></li>
    <li><a href="contact.html">Contact</a></li>
  </ul>
  <a href="${stripeUrl}" class="nav-cta">Get Captions — $45</a>
  <button class="hamburger" onclick="var m=document.getElementById('mm');m.style.display=m.style.display==='flex'?'none':'flex'" aria-label="Menu"><span></span><span></span><span></span></button>
</nav>
<div class="mobile-menu" id="mm">
  <a href="shop.html">Shop</a><a href="blog.html">Blog</a><a href="results.html">Results</a>
  <a href="free.html">Free</a><a href="about.html">About</a><a href="contact.html">Contact</a>
</div>
<section class="post-hero">
  <span class="post-tag">${esc(tag)}</span>
  <h1 class="post-title">${esc(title)}</h1>
  <div class="post-meta">${date} &middot; ${rt}</div>
</section>
<article class="post-body">
${bodyHtml}
</article>
<section class="post-cta">
  <h2>Ready to stop writing captions <em>from scratch?</em></h2>
  <p>24 custom social media captions written for your business. $45, one-time. Delivered in 48 hours.</p>
  <a href="${stripeUrl}" class="btn">Get My Custom Captions — $45</a>
</section>
<footer>
  <span class="footer-logo">The Content Drop</span>
  <ul class="footer-links">
    <li><a href="shop.html">Shop</a></li><li><a href="blog.html">Blog</a></li>
    <li><a href="results.html">Results</a></li><li><a href="free.html">Free</a></li>
    <li><a href="about.html">About</a></li><li><a href="contact.html">Contact</a></li>
    <li><a href="terms.html">Terms</a></li><li><a href="privacy.html">Privacy</a></li>
  </ul>
  <span class="footer-email">hello@thecontentdrop.ca</span>
</footer>
</body>
</html>`;
}

// ── BLOG INDEX UPDATER ────────────────────────────────────────────────────────

function updateBlogIndex(slug, title, excerpt, pillar, readTime, token, repo) {
  const apiUrl = `https://api.github.com/repos/${repo}/contents/blog.html`;
  const headers = { 'Authorization': 'token ' + token, 'User-Agent': 'ContentDrop' };

  const fileRes  = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (fileRes.getResponseCode() !== 200) return;
  const fileData = JSON.parse(fileRes.getContentText());
  const current  = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
  const sha      = fileData.sha;

  const tagMap = { 'Education': 'Social Media Strategy', 'Product': 'Content Strategy',
                   'Social Proof': 'Case Study', 'Behind the Scenes': 'Behind the Scenes', 'Industry': 'Industry Guide' };
  const tag    = tagMap[pillar] || 'Marketing Strategy';
  const rt     = readTime || '5 min read';
  const safeEx = esc(excerpt || '');
  const safeTi = esc(title);

  // Short version of title for the card image headline (first 6 words)
  const shortTitle = title.split(' ').slice(0, 7).join(' ');

  const newCard = `
    <a href="blog-${slug}.html" class="blog-card">
      <div class="blog-card-img">
        <div class="blog-card-img-headline">${esc(shortTitle)}</div>
      </div>
      <div class="blog-card-body">
        <div class="blog-card-tag">${tag}</div>
        <div class="blog-card-title">${safeTi}</div>
        <div class="blog-card-excerpt">${safeEx}</div>
        <div class="blog-card-meta">${rt}</div>
      </div>
    </a>`;

  // Insert the new card as the FIRST item in the blog grid (most recent first)
  const updated = current.replace(
    /(<div class="blog-grid-inner">)/,
    '$1' + newCard
  );

  const encoded = Utilities.base64Encode(updated, Utilities.Charset.UTF_8);
  UrlFetchApp.fetch(apiUrl, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ message: 'Blog index: add ' + title, content: encoded, sha: sha, branch: 'main' }),
    muteHttpExceptions: true
  });
}

// ── SITEMAP UPDATER ───────────────────────────────────────────────────────────

function updateSitemap(slug, token, repo, siteUrl) {
  const apiUrl  = `https://api.github.com/repos/${repo}/contents/sitemap.xml`;
  const headers = { 'Authorization': 'token ' + token, 'User-Agent': 'ContentDrop' };

  try {
    const fileRes  = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
    if (fileRes.getResponseCode() !== 200) return;
    const fileData = JSON.parse(fileRes.getContentText());
    const current  = Utilities.newBlob(Utilities.base64Decode(fileData.content)).getDataAsString();
    const today    = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

    // Skip if already in sitemap
    if (current.includes(`blog-${slug}.html`)) return;

    const entry   = `\n  <url>\n    <loc>${siteUrl}/blog-${slug}.html</loc>\n    <lastmod>${today}</lastmod>\n    <priority>0.7</priority>\n  </url>`;
    const updated = current.replace('</urlset>', entry + '\n</urlset>');
    const encoded = Utilities.base64Encode(updated, Utilities.Charset.UTF_8);

    UrlFetchApp.fetch(apiUrl, {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      payload: JSON.stringify({ message: 'Sitemap: add blog-' + slug, content: encoded, sha: fileData.sha, branch: 'main' }),
      muteHttpExceptions: true
    });
  } catch(e) { Logger.log('Sitemap update skipped: ' + e.message); }
}

// ── WEEKLY ANALYTICS ─────────────────────────────────────────────────────────

function weeklyAnalytics() {
  const pToken  = getConfig('PINTEREST_ACCESS_TOKEN');
  const fbToken = getConfig('FACEBOOK_ACCESS_TOKEN');
  const fbPage  = getConfig('FACEBOOK_PAGE_ID');

  let pinImp = 0, pinSaves = 0, pinClicks = 0, fbReach = 0, fbEng = 0;
  const weekOf = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  // Pinterest
  if (pToken) {
    try {
      const end   = new Date();
      const start = new Date(); start.setDate(end.getDate() - 7);
      const s = Utilities.formatDate(start, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const e = Utilities.formatDate(end,   Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const res  = UrlFetchApp.fetch(
        `https://api.pinterest.com/v5/user_account/analytics?start_date=${s}&end_date=${e}&metric_types=IMPRESSION,SAVE,OUTBOUND_CLICK`,
        { headers: { 'Authorization': 'Bearer ' + pToken }, muteHttpExceptions: true }
      );
      const d = JSON.parse(res.getContentText());
      (d.all?.daily_metrics || []).forEach(m => {
        pinImp    += m.metrics?.IMPRESSION     || 0;
        pinSaves  += m.metrics?.SAVE           || 0;
        pinClicks += m.metrics?.OUTBOUND_CLICK || 0;
      });
    } catch(e) { Logger.log('Pinterest analytics: ' + e.message); }
  }

  // Facebook
  if (fbToken && fbPage) {
    try {
      const res = UrlFetchApp.fetch(
        `https://graph.facebook.com/v19.0/${fbPage}/insights?metric=page_impressions_unique,page_post_engagements&period=week&access_token=${fbToken}`,
        { muteHttpExceptions: true }
      );
      const d = JSON.parse(res.getContentText());
      (d.data || []).forEach(m => {
        if (m.name === 'page_impressions_unique')  fbReach = m.values?.[0]?.value || 0;
        if (m.name === 'page_post_engagements')    fbEng   = m.values?.[0]?.value || 0;
      });
    } catch(e) { Logger.log('Facebook analytics: ' + e.message); }
  }

  // Write to Analytics sheet
  const aSheet = getSpreadsheet().getSheetByName(SHEETS.ANALYTICS);
  aSheet.appendRow([weekOf, '', pinImp, pinSaves, pinClicks, fbReach, fbEng, '', '']);

  // Claude strategy recommendation
  try {
    const prompt = `You are a social media strategist reviewing weekly results for The Content Drop (thecontentdrop.ca — custom social media captions, $45).

Data this week:
- Pinterest impressions: ${pinImp}
- Pinterest saves: ${pinSaves}
- Pinterest clicks to site: ${pinClicks}
- Facebook reach: ${fbReach}
- Facebook engagement: ${fbEng}

Write a brief performance note (under 150 words):
1. One sentence on overall performance
2. What to keep doing (1-2 points)
3. What to adjust next week (1-2 points)

Be specific and practical. No fluff.`;

    const rec = callClaude(prompt, 400);
    const sSheet = getSpreadsheet().getSheetByName(SHEETS.STRATEGY);
    sSheet.appendRow([weekOf, '', '', rec, '']);
  } catch(e) { Logger.log('Strategy rec failed: ' + e.message); }
}

// ── CLAUDE API ────────────────────────────────────────────────────────────────

function callClaude(prompt, maxTokens) {
  const key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY') || getConfig('CLAUDE_API_KEY');
  if (!key) throw new Error('CLAUDE_API_KEY missing. Add it to Script Properties in the Apps Script editor.');

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key':          key,
      'anthropic-version':  '2023-06-01',
      'content-type':       'application/json'
    },
    payload: JSON.stringify({
      model:      'claude-sonnet-4-6',
      max_tokens: maxTokens || 4000,
      messages:   [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const data = JSON.parse(res.getContentText());
  if (data.content?.[0]?.text) return data.content[0].text.trim();
  throw new Error('Claude API error: ' + JSON.stringify(data));
}

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function nextId(sheet) {
  return 'CD-' + String(sheet.getLastRow()).padStart(4, '0');
}

function getNextMonday() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diff = day === 0 ? 1 : (8 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


// ══════════════════════════════════════════════════════════════════════════════
// CUSTOMER CAPTION DELIVERY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════
//
// HOW TO USE:
// 1. Run setupDeliverySheet() once to create the Customer Deliveries sheet
// 2. Fill in a row with the customer's survey responses
// 3. Click any cell in that row, then run deliverSelectedRow()
// 4. The script generates 24 captions, fills your Google Doc template,
//    shares it, and emails the customer the link automatically.
//
// IMPORTANT: This calls the Claude API once per delivery (~16k tokens).
// Only run it when you are ready to deliver to a real customer.
// ══════════════════════════════════════════════════════════════════════════════

const TEMPLATE_DOC_ID = '1cIORwQPJ4pWOqSPWVirq_aDayCCI55VKSeFmrF9sjbw';
const DELIVERIES_SHEET = 'Customer Deliveries';

const DCOL = {
  ID:           1,
  CREATED:      2,
  STATUS:       3,   // Pending | Generating | Delivered | Failed
  NAME:         4,
  EMAIL:        5,
  BUSINESS:     6,
  LOCATION:     7,
  PLATFORM_1:   8,
  PLATFORM_2:   9,
  GOAL:         10,
  AUDIENCE:     11,
  TONE:         12,
  SERVICES:     13,
  EXTRA:        14,
  DOC_URL:      15,
  DELIVERED_AT: 16,
  ERROR:        17
};

// ── SETUP ─────────────────────────────────────────────────────────────────────

function setupDeliverySheet() {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(DELIVERIES_SHEET);
  if (!sheet) sheet = ss.insertSheet(DELIVERIES_SHEET);
  if (sheet.getLastRow() === 0) {
    const headers = [
      'ID', 'Created', 'Status', 'Customer Name', 'Email',
      'Business Name', 'Location', 'Platform 1', 'Platform 2',
      'Primary Goal', 'Target Audience', 'Tone / Voice',
      'Services & Products', 'Key Message',
      'Doc URL', 'Delivered At', 'Error'
    ];
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#1E3A2F')
      .setFontColor('#F5F0E8');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(DCOL.EMAIL, 220);
    sheet.setColumnWidth(DCOL.BUSINESS, 200);
    sheet.setColumnWidth(DCOL.GOAL, 200);
    sheet.setColumnWidth(DCOL.AUDIENCE, 280);
    sheet.setColumnWidth(DCOL.TONE, 200);
    sheet.setColumnWidth(DCOL.SERVICES, 250);
    sheet.setColumnWidth(DCOL.DOC_URL, 300);

    // Status dropdown
    const statusRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['Pending', 'Generating', 'Ready for Review', 'Approved', 'Delivered', 'Failed'], true).build();
    sheet.getRange(2, DCOL.STATUS, 1000, 1).setDataValidation(statusRule);

    // Platform dropdowns
    const platformList = ['Instagram', 'Facebook', 'TikTok', 'LinkedIn', 'Pinterest', 'YouTube'];
    const platformRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(platformList, true).build();
    sheet.getRange(2, DCOL.PLATFORM_1, 1000, 1).setDataValidation(platformRule);
    sheet.getRange(2, DCOL.PLATFORM_2, 1000, 1).setDataValidation(platformRule);
  }
  Logger.log('Customer Deliveries sheet ready.');
}

// ── TRIGGER: run from spreadsheet, with cursor in the customer's row ──────────

function deliverSelectedRow() {
  const sheet = getSpreadsheet().getSheetByName(DELIVERIES_SHEET);
  if (!sheet) { Logger.log('Run setupDeliverySheet() first.'); return; }
  const row = sheet.getActiveCell().getRow();
  if (row <= 1) { Logger.log('Select a data row (not the header).'); return; }
  processDelivery(row);
}

// ── AUTO TRIGGER: runs every 5 minutes, picks up any Pending rows ─────────────

function processPendingDeliveries() {
  const ss = SpreadsheetApp.openById('1zIZa5OSUSLHFRWcYY59YdZZAjB5ng2uoBW1YNryEOVI');
  const sheet = ss.getSheetByName(DELIVERIES_SHEET);
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][DCOL.STATUS - 1]).trim() === 'Pending') {
      Logger.log('Found Pending row ' + (i + 1) + ' — processing...');
      try {
        processDelivery(i + 1);
      } catch(e) {
        Logger.log('Delivery failed for row ' + (i + 1) + ': ' + e.message);
      }
      Utilities.sleep(2000); // brief pause between deliveries
    }
  }
}

// ── CORE DELIVERY ─────────────────────────────────────────────────────────────

function processDelivery(rowIndex) {
  const ss = SpreadsheetApp.openById('1zIZa5OSUSLHFRWcYY59YdZZAjB5ng2uoBW1YNryEOVI');
  const sheet = ss.getSheetByName(DELIVERIES_SHEET);
  const row = sheet.getRange(rowIndex, 1, 1, 17).getValues()[0];

  const data = {
    name:      String(row[DCOL.NAME - 1]).trim(),
    email:     String(row[DCOL.EMAIL - 1]).trim(),
    business:  String(row[DCOL.BUSINESS - 1]).trim(),
    location:  String(row[DCOL.LOCATION - 1]).trim(),
    platform1: String(row[DCOL.PLATFORM_1 - 1]).trim() || 'Instagram',
    platform2: String(row[DCOL.PLATFORM_2 - 1]).trim() || 'Facebook',
    goal:      String(row[DCOL.GOAL - 1]).trim(),
    audience:  String(row[DCOL.AUDIENCE - 1]).trim(),
    tone:      String(row[DCOL.TONE - 1]).trim(),
    services:   String(row[DCOL.SERVICES - 1]).trim(),
    keyMessage: String(row[DCOL.EXTRA - 1]).trim()
  };

  if (!data.email || !data.business) {
    Logger.log('Row ' + rowIndex + ' is missing email or business name. Aborting.');
    return;
  }

  sheet.getRange(rowIndex, DCOL.STATUS).setValue('Generating');
  SpreadsheetApp.flush();

  try {
    Logger.log('Generating captions for: ' + data.business);
    const captions = generateCaptionsForCustomer_(data);

    Logger.log('Filling template doc...');
    const docUrl = fillCaptionTemplate_(data, captions);

    // Do NOT email the customer yet — owner must review the doc first.
    // Change Status to "Approved" in the sheet to trigger delivery.
    sheet.getRange(rowIndex, DCOL.STATUS).setValue('Ready for Review');
    sheet.getRange(rowIndex, DCOL.DOC_URL).setValue(docUrl);
    Logger.log('Doc ready for review: ' + docUrl);

  } catch(e) {
    sheet.getRange(rowIndex, DCOL.STATUS).setValue('Failed');
    sheet.getRange(rowIndex, DCOL.ERROR).setValue(e.message);
    Logger.log('FAILED: ' + e.message);
    throw e;
  }
}

// ── APPROVE & DELIVER: change Status to "Approved" to trigger this ─────────────

function onEditDeliveries(e) {
  if (!e) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== DELIVERIES_SHEET) return;
  if (e.range.getColumn() !== DCOL.STATUS) return;
  if (e.value !== 'Approved') return;
  const rowIndex = e.range.getRow();
  if (rowIndex <= 1) return;
  approveDelivery(rowIndex);
}

function approveDelivery(rowIndex) {
  const ss = SpreadsheetApp.openById('1zIZa5OSUSLHFRWcYY59YdZZAjB5ng2uoBW1YNryEOVI');
  const sheet = ss.getSheetByName(DELIVERIES_SHEET);
  const row = sheet.getRange(rowIndex, 1, 1, 17).getValues()[0];

  const data = {
    name:    String(row[DCOL.NAME - 1]).trim(),
    email:   String(row[DCOL.EMAIL - 1]).trim(),
    business: String(row[DCOL.BUSINESS - 1]).trim()
  };
  const docUrl = String(row[DCOL.DOC_URL - 1]).trim();

  if (!data.email || !docUrl) {
    Logger.log('Row ' + rowIndex + ' is missing email or doc URL. Aborting.');
    return;
  }

  try {
    Logger.log('Sending captions to customer: ' + data.email);
    emailCaptionsToCustomer_(data, docUrl);
    sheet.getRange(rowIndex, DCOL.STATUS).setValue('Delivered');
    sheet.getRange(rowIndex, DCOL.DELIVERED_AT).setValue(new Date());
    Logger.log('Delivered to ' + data.email);
  } catch(e) {
    sheet.getRange(rowIndex, DCOL.STATUS).setValue('Failed');
    sheet.getRange(rowIndex, DCOL.ERROR).setValue(e.message);
    Logger.log('Delivery failed: ' + e.message);
  }
}

// ── STEP 1: GENERATE CAPTIONS VIA CLAUDE ─────────────────────────────────────

function generateCaptionsForCustomer_(data) {
  const context =
    'You are a professional social media copywriter for The Content Drop (thecontentdrop.ca).\n' +
    'CUSTOMER DETAILS:\n' +
    '- Business: ' + data.business + '\n' +
    '- Location: ' + data.location + '\n' +
    '- Primary goal: ' + data.goal + '\n' +
    '- Target audience: ' + data.audience + '\n' +
    '- Tone and voice: ' + data.tone + '\n' +
    '- Services and products: ' + data.services + '\n' +
    '- Key message (thread this through every caption): ' + (data.keyMessage || 'not specified') + '\n';

  const postInstructions =
    'Every caption must sound like it came from this specific business — not a template.\n' +
    'Use the business name, services, location, and voice naturally throughout.\n' +
    'Return ONLY valid JSON — no other text, no markdown, no code fences.\n' +
    'Each post object: { "num": N, "title": "5–7 word label", "body": "full caption body — no CTA", "cta": "one sentence CTA", "hashtags": "6–8 hashtags space-separated", "media": "what to photograph or film (1–2 sentences)", "tip": "one post enhancement tip" }';

  // Call 1: intro + posts 1–12
  const prompt1 =
    context +
    '\nWrite posts 1–12 for ' + data.platform1 + '. Vary angles: educational, storytelling, product, social proof, promotional, community.\n' +
    'Also write a personalised intro paragraph (3–4 sentences) addressed to ' + data.name.split(' ')[0] + ' referencing their business and what the captions are designed to do.\n\n' +
    postInstructions + '\n' +
    'Return: { "intro": "...", "posts": [ ...12 post objects numbered 1–12... ] }';

  // Call 2: posts 13–24
  const prompt2 =
    context +
    '\nWrite posts 13–24 for ' + data.platform2 + '. Different angles than the first 12. ' + data.platform2 + ' posts can be longer and more conversational.\n\n' +
    postInstructions + '\n' +
    'Return: { "posts": [ ...12 post objects numbered 13–24... ] }';

  const resp1 = callClaude(prompt1, 8000);
  const resp2 = callClaude(prompt2, 8000);

  function parseResp(resp) {
    try { return JSON.parse(resp); }
    catch(e) {
      const match = resp.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]);
      throw new Error('Could not parse JSON: ' + e.message);
    }
  }

  const part1 = parseResp(resp1);
  const part2 = parseResp(resp2);

  return {
    intro: part1.intro,
    posts: part1.posts.concat(part2.posts)
  };
}

// ── STEP 2: FILL TEMPLATE DOC ─────────────────────────────────────────────────

function fillCaptionTemplate_(data, captions) {
  const template = DriveApp.getFileById(TEMPLATE_DOC_ID);
  const tz = Session.getScriptTimeZone();
  const deliveryDate = Utilities.formatDate(new Date(), tz, 'MMMM d, yyyy');
  const fileName = 'Content Drop — ' + data.business + ' — ' + Utilities.formatDate(new Date(), tz, 'MMMM yyyy');

  // Get or create delivery folder in Drive
  const folderName = 'Content Drop Deliveries';
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);

  const copy = template.makeCopy(fileName, folder);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  // ── Header placeholders ──
  body.replaceText('\\{\\{BUSINESS_NAME\\}\\}',    data.business);
  body.replaceText('\\{\\{CUSTOMER_LOCATION\\}\\}', data.location || '');
  body.replaceText('\\{\\{PLATFORM_1\\}\\}',        data.platform1.toUpperCase());
  body.replaceText('\\{\\{PLATFORM_2\\}\\}',        data.platform2.toUpperCase());
  body.replaceText('\\{\\{DELIVERY_DATE\\}\\}',     deliveryDate);
  body.replaceText('\\{\\{PRIMARY_GOAL\\}\\}',      data.goal);
  body.replaceText('\\{\\{CUSTOMER_NAME\\}\\}',     data.name.split(' ')[0]);
  body.replaceText('\\{\\{INTRO_PARAGRAPH\\}\\}',   captions.intro);

  // ── Platform section headers (handles any platform combo) ──
  body.replaceText('INSTAGRAM CAPTIONS  ·  POSTS 1–12', data.platform1.toUpperCase() + ' CAPTIONS  ·  POSTS 1–12');
  body.replaceText('FACEBOOK CAPTIONS  ·  POSTS 13–24', data.platform2.toUpperCase() + ' CAPTIONS  ·  POSTS 13–24');

  // ── Per-post platform labels ──
  for (var i = 1; i <= 12; i++) {
    body.replaceText('POST ' + padNum_(i) + ' OF 24  ·  INSTAGRAM', 'POST ' + padNum_(i) + ' OF 24  ·  ' + data.platform1.toUpperCase());
  }
  for (var j = 13; j <= 24; j++) {
    body.replaceText('POST ' + padNum_(j) + ' OF 24  ·  FACEBOOK', 'POST ' + padNum_(j) + ' OF 24  ·  ' + data.platform2.toUpperCase());
  }

  // ── 24 post placeholders ──
  captions.posts.forEach(function(post) {
    var n = post.num;
    body.replaceText('\\{\\{POST_' + n + '_TITLE\\}\\}',    post.title    || '');
    body.replaceText('\\{\\{POST_' + n + '_BODY\\}\\}',     post.body     || '');
    body.replaceText('\\{\\{POST_' + n + '_CTA\\}\\}',      post.cta      || '');
    body.replaceText('\\{\\{POST_' + n + '_HASHTAGS\\}\\}', post.hashtags || '');
    body.replaceText('\\{\\{POST_' + n + '_MEDIA\\}\\}',    post.media    || '');
    body.replaceText('\\{\\{POST_' + n + '_TIP\\}\\}',      post.tip      || '');
  });

  doc.saveAndClose();

  // Anyone with the link can view (customers don't need a Google account)
  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return 'https://docs.google.com/document/d/' + copy.getId() + '/edit?usp=sharing';
}

// ── STEP 3: EMAIL CUSTOMER ────────────────────────────────────────────────────

function emailCaptionsToCustomer_(data, docUrl) {
  const firstName = data.name.split(' ')[0];
  const subject = 'Your Content Drop is ready — ' + data.business;
  const htmlBody =
    '<p>Hi ' + firstName + ',</p>' +
    '<p>Your 24 custom social media captions are ready. Click the button below to open your document:</p>' +
    '<p style="margin:28px 0;">' +
      '<a href="' + docUrl + '" style="background:#1E3A2F;color:#F5F0E8;padding:14px 28px;text-decoration:none;font-family:monospace;font-size:12px;letter-spacing:0.1em;text-transform:uppercase;">Open My Captions →</a>' +
    '</p>' +
    '<p style="font-size:13px;color:#555;">A few tips before you start posting:</p>' +
    '<ul style="font-size:13px;color:#555;line-height:1.8;">' +
      '<li>Read through all 24 captions before you start — some will be better for certain weeks</li>' +
      '<li>Each post includes a <strong>media suggestion</strong> (what to photograph or film) and a <strong>timing tip</strong></li>' +
      '<li>The captions are 100% yours — edit or personalise any of them as you like</li>' +
    '</ul>' +
    '<p style="font-size:13px;color:#555;">If you have any questions, just reply to this email.</p>' +
    '<p style="font-size:13px;color:#555;">Thanks for using The Content Drop.</p>' +
    '<p style="font-size:11px;color:#999;margin-top:32px;">The Content Drop · hello@thecontentdrop.ca · thecontentdrop.ca</p>';

  GmailApp.sendEmail(data.email, subject, '', {
    name:     'The Content Drop',
    replyTo:  'hello@thecontentdrop.ca',
    htmlBody: htmlBody
  });
}

// ── UTILITY ───────────────────────────────────────────────────────────────────

function padNum_(n) {
  return n < 10 ? '0' + n : String(n);
}
