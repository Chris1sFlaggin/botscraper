export const INSTAGRAM_HOSTNAME = "www.instagram.com";
export const UNFOLLOWERS_PER_PAGE = 50;
export const WHITELISTED_RESULTS_STORAGE_KEY = "iu_whitelisted-results";
export const TIMINGS_STORAGE_KEY = "iu_timings";

//TIMINGS CONSTANTS
export const DEFAULT_TIME_BETWEEN_SEARCH_CYCLES = 1000;
export const DEFAULT_TIME_TO_WAIT_AFTER_FIVE_SEARCH_CYCLES = 10000;
export const DEFAULT_TIME_BETWEEN_UNFOLLOWS = 4000;
export const DEFAULT_TIME_TO_WAIT_AFTER_FIVE_UNFOLLOWS = 300000;

// FILTER CONSTANTS
export const WITHOUT_PROFILE_PICTURE_URL_IDS = [
  "44884218_345707102882519_2446069589734326272_n",
  "464760996_1254146839119862_3605321457742435801_n",
];

// --- BOT SCORING ---
export const IG_APP_ID = "936619743392459";

// Tier 1 weights (list data)
export const W_NO_PIC = 30;
export const W_DIGIT_RATIO = 15;
export const W_TRAILING_DIGITS = 15;
export const W_GIBBERISH = 15;
export const W_EMPTY_NAME = 15;
export const W_NAME_EQ_USERNAME = 10;
export const W_SPAM_NAME = 25;
export const W_PRIVATE_SUSPECT = 10;

// Tier 2 weights (profile enrichment)
export const W_MASS_FOLLOW = 30;
export const W_ZERO_POSTS = 25;
export const W_JOINED_RECENTLY = 25;
export const W_FEW_POSTS = 10;
export const W_ZERO_FOLLOWERS = 10;
export const W_EMPTY_BIO = 5;

// Thresholds / caps
export const TIER2_CANDIDATE_THRESHOLD = 25;
export const DEFAULT_REMOVAL_THRESHOLD = 60;
export const DEEP_SCAN_CAP = 200;
export const TIME_BETWEEN_ENRICH = 1500;
export const TIME_AFTER_TWENTY_ENRICH = 30000;

// Heuristic params
export const DIGIT_RATIO_THRESHOLD = 0.30;
export const VOWEL_RATIO_THRESHOLD = 0.25;
export const GIBBERISH_MIN_LEN = 6;
export const SPAM_KEYWORDS = [
  "follow4follow", "f4f", "followback", "free followers", "promo", "onlyfans",
  "cashapp", "telegram", "whatsapp", "crypto", "bitcoin", "forex", "dm me", "link in bio",
];

// A finsta ("fake insta") marker in the name/username = a real person's private alt, not a bot.
export const FINSTA_KEYWORDS = [
  "privato", "private", "priv", "prv", "pvt", "finsta", "fake", "spam",
];

// --- COMMENT SCORING ---
export const COMMENT_WHITELIST_STORAGE_KEY = "cs_comment-whitelist";

export const COMMENT_W_LINK = 25;
export const COMMENT_W_SPAM_PHRASE = 25;
export const COMMENT_W_MENTION_SPAM = 20;
export const COMMENT_W_COPYPASTA = 25;
export const COMMENT_W_EMOJI_ONLY = 15;
export const COMMENT_W_GENERIC = 10;
export const COMMENT_W_CAPS = 10;

export const COMMENT_AUTHOR_CAP = 30;
export const COMMENT_CANDIDATE_THRESHOLD = 25;
export const COMMENT_ACTION_THRESHOLD = 60;

export const COMMENT_MENTION_SPAM_MIN = 3;
export const COPYPASTA_MIN_AUTHORS = 3;

// Promo/spam phrases common in comment spam (in addition to SPAM_KEYWORDS).
export const COMMENT_SPAM_PHRASES = [
  "check my page", "check my profile", "dm me", "dm for promo", "gain followers",
  "buy followers", "free followers", "follow me", "follow back", "promo", "click my bio",
];
// Low-value one-liners; only flagged when the whole comment is essentially just this.
export const COMMENT_GENERIC_PHRASES = ["nice", "cool", "wow", "first", "follow me", "follow back"];

// Comment-scan anti-block pacing. Default post cap stops "scan all posts" from
// running unbounded (the read-rate-limit foot-gun); long pauses break up the
// GET flood, mirroring the follower scan's periodic cooldown.
export const DEFAULT_SCAN_POST_CAP = 20;
export const SCAN_LONG_PAUSE_EVERY_POSTS = 10;
export const SCAN_LONG_PAUSE_EVERY_COMMENT_PAGES = 20;
