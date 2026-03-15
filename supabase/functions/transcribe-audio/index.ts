import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ============================================
// KONFIGIRASYON AVANSE
// ============================================

const CONFIG = {
  // API Settings
  OPENAI_API_KEY: Deno.env.get('OPENAI_API_KEY'),
  GOOGLE_API_KEY: Deno.env.get('GOOGLE_API_KEY'), // Fallback
  AZURE_SPEECH_KEY: Deno.env.get('AZURE_SPEECH_KEY'), // Fallback 2
  
  // Supabase
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  
  // Limits
  MAX_AUDIO_SIZE_MB: 25,
  MIN_AUDIO_DURATION_SECONDS: 1,
  MAX_AUDIO_DURATION_SECONDS: 300, // 5 minutes
  MAX_RETRIES: 3,
  REQUEST_TIMEOUT_MS: 60000,
  RATE_LIMIT_PER_MINUTE: 20,
  RATE_LIMIT_PER_HOUR: 100,
  
  // Ban Settings
  AUTO_BAN_ENABLED: true,
  BAN_DURATION_DAYS: 10,
  STRIKE_SYSTEM_ENABLED: true,
  MAX_STRIKES_BEFORE_BAN: 3,
  
  // Moderation Levels
  MODERATION_LEVELS: {
    LENIENT: 'lenient',    // Just log
    MODERATE: 'moderate',  // Warn user
    STRICT: 'strict',      // Auto-ban
  },
  
  // Current moderation level
  CURRENT_MODERATION_LEVEL: 'strict',
}

// ============================================
// CORS HEADERS
// ============================================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-request-id',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
}

// ============================================
// DATABASE DE YO (Keywords)
// ============================================

// 1. FRAUD/SCAM - Trè danje, ban immédiat
const FRAUD_KEYWORDS = {
  critical: [
    // English - Financial Fraud
    'bank fraud', 'wire fraud', 'credit card fraud', 'identity theft', 
    'money laundering', 'tax evasion', 'insurance fraud', 'medicare fraud',
    'securities fraud', 'investment fraud', 'ponzi scheme', 'pyramid scheme',
    'fake check', 'counterfeit money', 'forgery', 'embezzlement', 'bribery',
    'extortion', 'blackmail', 'racketeering', 'loan fraud', 'mortgage fraud',
    'welfare fraud', 'unemployment fraud', 'social security fraud',
    
    // English - Cybercrime
    'hacking', 'phishing', 'carding', 'skimming', 'keylogger', 'ransomware',
    'data breach', 'identity cloning', 'sim swapping', 'account takeover',
    'credential stuffing', 'brute force', 'sql injection', 'xss attack',
    'man in the middle', 'session hijacking', 'dns spoofing',
    
    // English - Scams
    'romance scam', 'catfishing', 'pig butchering', 'advance fee fraud',
    'nigerian prince', '419 scam', 'lottery scam', 'inheritance scam',
    'job scam', 'fake job', 'reshipping scam', 'mystery shopper scam',
    'tech support scam', 'irs scam', 'social security scam', 'grandparent scam',
    'charity scam', 'crowdfunding scam', 'real estate scam', 'rental scam',
    
    // English - Crypto Fraud
    'crypto scam', 'bitcoin scam', 'nft scam', 'defi exploit', 'rug pull',
    'pump and dump', 'wash trading', 'spoofing', 'layering', 'smurfing',
    'cuckoo smurfing', 'fake ico', 'ponzi crypto', 'yield farming scam',
    'bridge exploit', 'smart contract hack', 'flash loan attack',
    
    // French - Fraude
    'fraude bancaire', 'fraude fiscale', 'blanchiment d\'argent',
    'escroquerie', 'arnaque', 'hameçonnage', 'usurpation d\'identité',
    'faux chèque', 'contrefaçon', 'chantage', 'extorsion', 'corruption',
    'détournement de fonds', 'abus de confiance', 'faux et usage de faux',
    'pyramide financière', 'système de ponzi',
    
    // Haitian Creole - Twonpri
    'twonpe', 'fè twonpe', 'vòlè lajan', 'vòl idanite', 'fèbli chèk',
    'kawotchou', 'lajan sale', 'kòb sale', 'pwazon', 'pwazonnen',
    'trafik dwòg', 'trafik zam', 'trafik moun', 'vòlè enfòmasyon',
    'fèbli dokiman', 'siyati fo', 'non fo', 'nimewo fo', 'imèl fo',
    'kat kredi fo', 'kat bank fo', 'chèk fo', 'lajan fo', 'pyès fòs',
  ],
  
  high: [
    'scam', 'fraud', 'steal', 'theft', 'robbery', 'burglary', 'shoplifting',
    'pickpocket', 'snatch', 'mugging', 'carjacking', 'kidnapping', 'abduction',
    'hostage', 'ransom', 'torture', 'assault', 'battery', 'manslaughter',
    'murder', 'homicide', 'genocide', 'terrorism', 'bomb', 'explosive',
    'weapon', 'gun', 'knife', 'shooting', 'stabbing', 'strangle', 'poison',
  ],
  
  medium: [
    'cheat', 'trick', 'deceive', 'mislead', 'manipulate', 'exploit',
    'take advantage', 'rip off', 'con', 'swindle', 'bamboozle', 'hoodwink',
  ]
}

// 2. HATE SPEECH - Danje, ban immédiat
const HATE_SPEECH_KEYWORDS = {
  critical: [
    // Racism
    'nigger', 'nigga', 'chink', 'spic', 'wetback', 'kike', 'kyke', 'heeb',
    'raghead', 'towelhead', 'sandnigger', 'camel jockey', 'dothead',
    'gook', 'slope', 'zipperhead', 'jap', 'kraut', 'wop', 'dago', 'mick',
    'paddy', 'polack', 'bohunk', 'hun', 'ruskie', 'commie', 'redskin',
    'injun', 'savage', 'primitive', 'uncivilized', 'monkey', 'ape',
    'gorilla', 'coon', 'jigaboo', 'spook', 'darkie', 'pickaninny',
    
    // Homophobia/Transphobia
    'faggot', 'fag', 'dyke', 'lesbo', 'homo', 'queer', 'tranny', 'shemale',
    'he-she', 'it', 'gender freak', 'transvestite', 'sodomite',
    
    // Religious hatred
    'infidel', 'heathen', 'heretic', 'blasphemer', 'kafir', 'unbeliever',
    'christ killer', 'jewish conspiracy', 'zionist occupation', 'sharia law',
    'islamic takeover', 'white genocide', 'great replacement',
    
    // Sexism/Misogyny
    'slut', 'whore', 'bitch', 'cunt', 'twat', 'pussy', 'dyke', 'lesbo',
    'skank', 'ho', 'hooker', 'prostitute', 'mail order bride', 'trophy wife',
    'kitchen', 'barefoot and pregnant', 'women belong', 'feminazi',
    
    // Ableism
    'retard', 'retarded', 'spastic', 'spaz', 'cripple', 'gimp', 'lame',
    'dumb', 'mute', 'deaf and dumb', 'blind leading the blind', 'autistic',
    'sperg', 'aspie', 'downie', 'mongoloid', 'vegetable', 'brain dead',
    
    // Haitian Creole
    'makak', 'singe', 'bèt', 'anbèsil', 'kokobe', 'boug', 'malpwòp',
    'salòp', 'pèdè', 'masisi', 'madivin', 'tet dwat', 'kok', 'vye',
  ],
  
  context_dependent: [
    'white power', 'black power', 'heil hitler', 'sieg heil', '14 words',
    'blood and soil', 'jews will not replace us', 'white pride', 'aryan',
    'nazi', 'neo-nazi', 'kkk', 'ku klux klan', 'confederate', 'skinhead',
    'white nationalist', 'white supremacist', 'race war', 'racial holy war',
    'day of the rope', 'boogaloo', 'accelerationism',
  ]
}

// 3. VIOLENCE - Trè danje
const VIOLENCE_KEYWORDS = {
  critical: [
    'kill', 'murder', 'assassinate', 'execute', 'slaughter', 'massacre',
    'genocide', 'lynch', 'shoot', 'stab', 'strangle', 'drown', 'poison',
    'bomb', 'explode', 'terrorist', 'terrorism', 'mass shooting',
    'school shooting', 'active shooter', 'suicide bomb', 'hostage',
    'kidnap', 'abduct', 'torture', 'maim', 'disfigure', 'decapitate',
    'behead', 'burn alive', 'crucify', 'draw and quarter', 'stoning',
    'honor killing', 'acid attack', 'drive-by shooting', 'gang violence',
    'cartel', 'mafia', 'hitman', 'contract killing', 'mercenary',
    'child soldier', 'human shield', 'war crime', 'crime against humanity',
    'ethnic cleansing', 'forced labor', 'slavery', 'sex trafficking',
    'child trafficking', 'organ trafficking', 'illegal adoption',
    
    // French
    'tuer', 'assassiner', 'exécuter', 'massacrer', 'génocide', 'lyncher',
    'poignarder', 'étrangler', 'noyer', 'empoisonner', 'bombe', 'exploser',
    'terroriste', 'terrorisme', 'prise d\'otage', 'enlèvement', 'torture',
    
    // Haitian Creole
    'tiye', 'asasinen', 'ekzekite', 'touye', 'masakre', 'lynch',
    'kout kouto', 'kout ponya', 'etranjle', 'nwaye', 'pwazonnen',
    'bonb', 'eksplozyon', 'teroris', 'teroris', 'anleve', 'kidnapin',
    'tòti', 'maltrate', 'koupe tèt', 'boule vivan', 'krim kont limanite',
    'netwayaj etnik', 'esklavaj', 'trafik timoun', 'trafik seks',
  ],
  
  threats: [
    'i will kill', 'i\'m going to kill', 'planning to kill', 'want to kill',
    'going to shoot', 'going to bomb', 'threaten to', 'death threat',
    'swatting', 'doxxing', 'doxx', 'release address', 'release info',
    
    // French
    'je vais tuer', 'je vais t\'tuer', 'menace de mort', 'swatting',
    
    // Creole
    'mwen pral tiye', 'mwen pral touye', 'mwen vle tiye', 'menas lanmò',
  ]
}

// 4. SEXUAL CONTENT - Log selman, pa ban
const SEXUAL_KEYWORDS = {
  explicit: [
    'sex', 'fuck', 'fucking', 'shit', 'bitch', 'ass', 'damn', 'crap',
    'piss', 'cock', 'dick', 'pussy', 'tits', 'boobs', 'cum', 'jizz',
    'blowjob', 'handjob', 'titjob', 'anal', 'oral', 'vaginal', 'penetration',
    'masturbate', 'wank', 'jerk off', 'finger', 'eat out', 'rimjob',
    'porn', 'pornography', 'xxx', 'adult content', 'nsfw', 'onlyfans',
    'camgirl', 'camboy', 'escort', 'prostitute', 'brothel', 'pimp',
    'sexting', 'nudes', 'naked pics', 'dick pic', 'cumshot', 'facial',
    'gangbang', 'orgy', 'threesome', 'foursome', 'bukkake', 'creampie',
    'bdsm', 'bondage', 'domination', 'submission', 'sadism', 'masochism',
    'fetish', 'kink', 'roleplay', 'incest', 'pedophile', 'pedophilia',
    'child porn', 'cp', 'lolicon', 'shotacon', 'bestiality', 'zoophilia',
    'necrophilia', 'rape', 'sexual assault', 'molest', 'molestation',
    'sexual harassment', 'sexual abuse', 'statutory rape', 'grooming',
    
    // French
    'sexe', 'baiser', 'niquer', 'enculer', 'sucer', 'branler', 'porno',
    'pornographie', 'prostituée', 'putain', 'salope', 'chienne', 'traînée',
    'pédophile', 'pédophilie', 'viol', 'agression sexuelle', 'inceste',
    'bestialité', 'nécrophilie', 'esclave sexuel', 'trafic sexuel',
    
    // Haitian Creole
    'sek', 'fe sek', 'souse', 'bite', 'koko', 'kok', 'vajen', 'tete',
    'ponografi', 'pòn', 'pwostitye', 'makrèl', 'vyole', 'vyolans seksyèl',
    'abi seksyèl', 'timalice', 'anfans', 'gwo zòt', 'ti zòt',
  ],
  
  suggestive: [
    'horny', 'aroused', 'wet', 'hard', 'boner', 'erection', 'moist',
    'thirsty', 'dtf', 'down to fuck', 'hook up', 'one night stand',
    'friends with benefits', 'fuck buddy', 'booty call', 'netflix and chill',
    'send nudes', 'slide into dms', 'smash', 'hit it', 'tap that',
    'get lucky', 'score', 'get laid', 'lose virginity', 'pop cherry',
  ]
}

// 5. SPAM/ABUSE - Rate limit, pa ban
const SPAM_KEYWORDS = [
  'buy now', 'click here', 'limited time', 'act now', 'urgent',
  'congratulations you won', 'free money', 'make money fast', 'get rich quick',
  'work from home', 'earn $', 'earn £', 'earn €', 'double your money',
  'no risk investment', 'guaranteed profit', 'secret method', 'exclusive deal',
  'call now', 'order now', 'subscribe now', 'sign up now', 'limited offer',
  'while supplies last', 'only  left', 'going fast', 'don\'t miss out',
  'special promotion', 'winner selected', 'you\'ve been chosen',
  'weight loss', 'lose weight fast', 'miracle cure', 'magic pill',
  'anti-aging', 'grow hair', 'enlarge', 'male enhancement', 'viagra',
  'cialis', 'cheap meds', 'no prescription', 'online pharmacy',
  'hot singles', 'meet singles', 'chat now', 'live girls', 'webcam',
  'crypto giveaway', 'send crypto', 'double your bitcoin', 'eth giveaway',
  'verify your account', 'suspended account', 'unusual activity',
  'confirm your password', 'login to claim', 'update payment info',
]

// 6. SELF-HARM - Alert, pa ban, ede
const SELF_HARM_KEYWORDS = {
  critical: [
    'suicide', 'kill myself', 'end my life', 'want to die', 'better off dead',
    'no reason to live', 'can\'t go on', 'end it all', 'slit wrists',
    'overdose', 'jump off', 'hang myself', 'shoot myself', 'suicidal',
    'suicide plan', 'suicide note', 'goodbye world', 'final message',
    
    // French
    'suicide', 'me tuer', 'mourir', 'finir ma vie', 'plus de raison de vivre',
    'me pendre', 'sauter', 'overdose', 'couper les veines',
    
    // Creole
    'tiye tèt mwen', 'mouri', 'mwen vle mouri', 'fin avèk lavi mwen',
    'koupe venn mwen', 'toufe tèt mwen', 'sote', 'pi bon si mwen mouri',
  ],
  
  concerning: [
    'self harm', 'cutting', 'burning myself', 'hitting myself', 'starving',
    'purging', 'binge eating', 'anorexic', 'bulimic', 'depressed',
    'hopeless', 'worthless', 'no one cares', 'alone', 'isolated',
    'can\'t take it', 'give up', 'numb', 'empty', 'broken', 'damaged',
  ]
}

// 7. DRUGS/ILLEGAL SUBSTANCES
const DRUG_KEYWORDS = {
  hard_drugs: [
    'cocaine', 'heroin', 'meth', 'methamphetamine', 'crack', 'crack cocaine',
    'fentanyl', 'opioid', 'oxycodone', 'percocet', 'xanax', 'benzo',
    'lsd', 'acid', 'ecstasy', 'mdma', 'molly', 'ketamine', 'special k',
    'pcp', 'angel dust', 'ghb', 'rohypnol', 'date rape drug',
    
    // French
    'cocaïne', 'héroïne', 'méthamphétamine', 'crack', 'fentanyl',
    'ecstasy', 'lsd', 'acide', 'ketamine',
    
    // Creole
    'kokayin', 'ewoyin', 'met', 'krak', 'fentanil', 'ekstazi', 'asid',
  ],
  
  dealing: [
    'buy drugs', 'sell drugs', 'drug dealer', 'plug', 'connect', 'hook up',
    'score some', 'pick up', 're-up', 'trap house', 'stash house',
    'drug mule', 'smuggle', 'trafficking', 'cartel', 'gang', 'crew',
    'corner boy', 'runner', 'lookout', 'enforcer', 'kingpin',
    
    // French
    'acheter de la drogue', 'vendre de la drogue', 'trafiquant', 'passerelle',
    
    // Creole
    'achte dwòg', 'vann dwòg', 'trafikan', 'kouri', 'gade', 'chèf',
  ]
}

// ============================================
// KLAS POU JERE MODERASYON
// ============================================

class ContentModerator {
  private userStrikes: Map<string, number> = new Map()
  private userLogs: Map<string, any[]> = new Map()
  
  // Detect all types of violations
  analyze(text: string, userId?: string): ModerationResult {
    const result: ModerationResult = {
      approved: true,
      violations: [],
      severity: 'none',
      action: 'allow',
      confidence: 0,
      metadata: {}
    }
    
    const lowerText = text.toLowerCase()
    
    // 1. Check Critical Fraud (Auto-ban)
    const fraudMatch = this.detectFraud(lowerText)
    if (fraudMatch.critical.length > 0) {
      result.violations.push({
        type: 'fraud_critical',
        keywords: fraudMatch.critical,
        severity: 'critical'
      })
      result.severity = 'critical'
      result.action = 'ban'
      result.confidence = 1.0
      return result
    }
    
    // 2. Check Hate Speech (Auto-ban)
    const hateMatch = this.detectHateSpeech(lowerText)
    if (hateMatch.critical.length > 0) {
      result.violations.push({
        type: 'hate_speech_critical',
        keywords: hateMatch.critical,
        severity: 'critical'
      })
      result.severity = 'critical'
      result.action = 'ban'
      result.confidence = 1.0
      return result
    }
    
    // 3. Check Violence/Threats (Auto-ban)
    const violenceMatch = this.detectViolence(lowerText)
    if (violenceMatch.critical.length > 0 || violenceMatch.threats.length > 0) {
      result.violations.push({
        type: 'violence',
        keywords: [...violenceMatch.critical, ...violenceMatch.threats],
        severity: 'critical'
      })
      result.severity = 'critical'
      result.action = 'ban'
      result.confidence = 0.95
      return result
    }
    
    // 4. Check Self-Harm (Alert + Help resources)
    const selfHarmMatch = this.detectSelfHarm(lowerText)
    if (selfHarmMatch.critical.length > 0) {
      result.violations.push({
        type: 'self_harm_critical',
        keywords: selfHarmMatch.critical,
        severity: 'high'
      })
      result.severity = 'high'
      result.action = 'help'
      result.metadata.helpResources = this.getHelpResources()
      return result
    }
    
    // 5. Check Drug Dealing (Ban)
    const drugMatch = this.detectDrugs(lowerText)
    if (drugMatch.dealing.length > 0) {
      result.violations.push({
        type: 'drug_dealing',
        keywords: drugMatch.dealing,
        severity: 'high'
      })
      result.severity = 'high'
      result.action = 'ban'
      result.confidence = 0.9
      return result
    }
    
    // 6. Check High-Risk Fraud (Strike system)
    if (fraudMatch.high.length > 0) {
      result.violations.push({
        type: 'fraud_high',
        keywords: fraudMatch.high,
        severity: 'high'
      })
      result.severity = 'high'
      result.action = 'strike'
      result.confidence = 0.8
    }
    
    // 7. Check Context-Dependent Hate Speech (Review)
    if (hateMatch.context.length > 0) {
      result.violations.push({
        type: 'hate_speech_context',
        keywords: hateMatch.context,
        severity: 'medium'
      })
      if (result.severity !== 'high') {
        result.severity = 'medium'
        result.action = 'review'
      }
    }
    
    // 8. Check Sexual Content (Log only)
    const sexualMatch = this.detectSexual(lowerText)
    if (sexualMatch.explicit.length > 0) {
      result.violations.push({
        type: 'sexual_explicit',
        keywords: sexualMatch.explicit,
        severity: 'low'
      })
      result.metadata.sexualContent = true
    }
    
    // 9. Check Spam (Rate limit)
    if (this.detectSpam(lowerText)) {
      result.violations.push({
        type: 'spam',
        keywords: ['spam_pattern'],
        severity: 'low'
      })
      result.action = 'rate_limit'
    }
    
    // Calculate overall confidence
    if (result.violations.length > 0) {
      const confidences = result.violations.map(v => 
        v.severity === 'critical' ? 1.0 : 
        v.severity === 'high' ? 0.8 : 
        v.severity === 'medium' ? 0.6 : 0.4
      )
      result.confidence = Math.max(...confidences)
    }
    
    return result
  }
  
  private detectFraud(text: string): { critical: string[], high: string[], medium: string[] } {
    return {
      critical: FRAUD_KEYWORDS.critical.filter(k => text.includes(k.toLowerCase())),
      high: FRAUD_KEYWORDS.high.filter(k => text.includes(k.toLowerCase())),
      medium: FRAUD_KEYWORDS.medium.filter(k => text.includes(k.toLowerCase()))
    }
  }
  
  private detectHateSpeech(text: string): { critical: string[], context: string[] } {
    return {
      critical: HATE_SPEECH_KEYWORDS.critical.filter(k => text.includes(k.toLowerCase())),
      context: HATE_SPEECH_KEYWORDS.context_dependent.filter(k => text.includes(k.toLowerCase()))
    }
  }
  
  private detectViolence(text: string): { critical: string[], threats: string[] } {
    return {
      critical: VIOLENCE_KEYWORDS.critical.filter(k => text.includes(k.toLowerCase())),
      threats: VIOLENCE_KEYWORDS.threats.filter(pattern => {
        // Check for threat patterns
        return pattern.split(' ').every(word => text.includes(word))
      })
    }
  }
  
  private detectSelfHarm(text: string): { critical: string[], concerning: string[] } {
    return {
      critical: SELF_HARM_KEYWORDS.critical.filter(k => text.includes(k.toLowerCase())),
      concerning: SELF_HARM_KEYWORDS.concerning.filter(k => text.includes(k.toLowerCase()))
    }
  }
  
  private detectDrugs(text: string): { hard: string[], dealing: string[] } {
    return {
      hard: DRUG_KEYWORDS.hard_drugs.filter(k => text.includes(k.toLowerCase())),
      dealing: DRUG_KEYWORDS.dealing.filter(k => text.includes(k.toLowerCase()))
    }
  }
  
  private detectSexual(text: string): { explicit: string[], suggestive: string[] } {
    return {
      explicit: SEXUAL_KEYWORDS.explicit.filter(k => text.includes(k.toLowerCase())),
      suggestive: SEXUAL_KEYWORDS.suggestive.filter(k => text.includes(k.toLowerCase()))
    }
  }
  
  private detectSpam(text: string): boolean {
    return SPAM_KEYWORDS.some(k => text.includes(k.toLowerCase()))
  }
  
  private getHelpResources(): HelpResource[] {
    return [
      {
        name: 'National Suicide Prevention Lifeline',
        phone: '988',
        text: 'Text HOME to 741741',
        url: 'https://988lifeline.org'
      },
      {
        name: 'Crisis Text Line',
        phone: 'Text HOME to 741741',
        url: 'https://www.crisistextline.org'
      },
      {
        name: 'International Association for Suicide Prevention',
        url: 'https://www.iasp.info/resources/Crisis_Centres/'
      },
      {
        name: 'Haitian Mental Health Resources',
        phone: '+509 2813-0000',
        description: 'Hôpital Universitaire de Mirebalais - Psychiatric Services'
      }
    ]
  }
  
  // Strike system management
  async addStrike(userId: string, violation: Violation): Promise<number> {
    const current = this.userStrikes.get(userId) || 0
    const updated = current + 1
    this.userStrikes.set(userId, updated)
    
    // Log to database
    await this.logViolation(userId, violation)
    
    return updated
  }
  
  async logViolation(userId: string, violation: Violation): Promise<void> {
    const log = {
      userId,
      violation,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID()
    }
    
    const existing = this.userLogs.get(userId) || []
    existing.push(log)
    this.userLogs.set(userId, existing)
    
    // Also log to Supabase
    try {
      const supabase = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!)
      await supabase.from('moderation_logs').insert(log)
    } catch (e) {
      console.error('Failed to log to database:', e)
    }
  }
  
  getStrikes(userId: string): number {
    return this.userStrikes.get(userId) || 0
  }
  
  clearStrikes(userId: string): void {
    this.userStrikes.delete(userId)
  }
}

interface ModerationResult {
  approved: boolean
  violations: Violation[]
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical'
  action: 'allow' | 'warn' | 'strike' | 'ban' | 'help' | 'rate_limit' | 'review'
  confidence: number
  metadata: any
}

interface Violation {
  type: string
  keywords: string[]
  severity: string
}

interface HelpResource {
  name: string
  phone?: string
  text?: string
  url?: string
  description?: string
}

// ============================================
// KLAS POU RATE LIMITING
// ============================================

class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  checkLimit(userId: string, identifier: string): { allowed: boolean; remaining: number; resetTime: number } {
    const key = `${userId}:${identifier}`
    const now = Date.now()
    const windowStart = now - 60000 // 1 minute window
    
    const requests = this.requests.get(key) || []
    const recentRequests = requests.filter(time => time > windowStart)
    
    if (recentRequests.length >= CONFIG.RATE_LIMIT_PER_MINUTE) {
      const oldestRequest = Math.min(...recentRequests)
      return {
        allowed: false,
        remaining: 0,
        resetTime: oldestRequest + 60000
      }
    }
    
    recentRequests.push(now)
    this.requests.set(key, recentRequests)
    
    return {
      allowed: true,
      remaining: CONFIG.RATE_LIMIT_PER_MINUTE - recentRequests.length,
      resetTime: now + 60000
    }
  }
  
  checkHourlyLimit(userId: string): { allowed: boolean; remaining: number } {
    const key = `${userId}:hourly`
    const now = Date.now()
    const windowStart = now - 3600000 // 1 hour window
    
    const requests = this.requests.get(key) || []
    const recentRequests = requests.filter(time => time > windowStart)
    
    return {
      allowed: recentRequests.length < CONFIG.RATE_LIMIT_PER_HOUR,
      remaining: CONFIG.RATE_LIMIT_PER_HOUR - recentRequests.length
    }
  }
}

// ============================================
// KLAS POU AUDIO PROCESSING
// ============================================

class AudioProcessor {
  // Validate audio format and size
  validateAudio(base64Audio: string): { valid: boolean; error?: string; buffer?: Uint8Array } {
    try {
      // Check if valid base64
      const decoded = atob(base64Audio)
      
      if (decoded.length === 0) {
        return { valid: false, error: 'Empty audio data' }
      }
      
      // Check minimum size (1 second at 16kHz mono = ~32KB for WAV, ~8KB for MP3)
      const minSize = 8000 // bytes
      if (decoded.length < minSize) {
        return { 
          valid: false, 
          error: `Audio too short. Minimum ${CONFIG.MIN_AUDIO_DURATION_SECONDS} second required.` 
        }
      }
      
      // Check maximum size
      const maxBytes = CONFIG.MAX_AUDIO_SIZE_MB * 1024 * 1024
      if (decoded.length > maxBytes) {
        return { 
          valid: false, 
          error: `Audio too large. Maximum ${CONFIG.MAX_AUDIO_SIZE_MB}MB allowed.` 
        }
      }
      
      const buffer = Uint8Array.from(decoded, c => c.charCodeAt(0))
      
      // Try to detect format
      const format = this.detectFormat(buffer)
      console.log('Detected audio format:', format)
      
      return { valid: true, buffer }
    } catch (e) {
      return { valid: false, error: 'Invalid base64 encoding: ' + e.message }
    }
  }
  
  private detectFormat(buffer: Uint8Array): string {
    // Check magic numbers
    if (buffer[0] === 0xFF && buffer[1] === 0xFB) return 'MP3'
    if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return 'MP3 (ID3)'
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return 'WAV'
    if (buffer[0] === 0x4D && buffer[1] === 0x34 && buffer[2] === 0x41) return 'M4A'
    if (buffer[0] === 0x66 && buffer[1] === 0x4C && buffer[2] === 0x61 && buffer[3] === 0x43) return 'FLAC'
    if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return 'OGG'
    return 'Unknown'
  }
  
  // Convert to format optimal for Whisper
  async optimizeForWhisper(buffer: Uint8Array): Promise<Blob> {
    // For now, just wrap in proper MIME type
    // In production, you might want to convert using ffmpeg.wasm
    return new Blob([buffer], { type: 'audio/mpeg' })
  }
}

// ============================================
// KLAS POU TRANSCRIPTION
// ============================================

class TranscriptionService {
  private openaiKey: string
  private fallbackKeys: string[]
  
  constructor() {
    this.openaiKey = CONFIG.OPENAI_API_KEY!
    this.fallbackKeys = [
      CONFIG.GOOGLE_API_KEY,
      CONFIG.AZURE_SPEECH_KEY
    ].filter(Boolean) as string[]
  }
  
  async transcribe(
    audioBuffer: Uint8Array, 
    retryCount = 0
  ): Promise<{ text: string; confidence?: number; language?: string }> {
    const maxRetries = CONFIG.MAX_RETRIES
    
    try {
      // Try OpenAI Whisper first
      return await this.transcribeWithWhisper(audioBuffer)
    } catch (error) {
      console.error(`Transcription attempt ${retryCount + 1} failed:`, error)
      
      if (retryCount < maxRetries) {
        // Exponential backoff
        const delay = Math.pow(2, retryCount) * 1000
        console.log(`Retrying in ${delay}ms...`)
        await new Promise(resolve => setTimeout(resolve, delay))
        
        return this.transcribe(audioBuffer, retryCount + 1)
      }
      
      // Try fallback if available
      if (this.fallbackKeys.length > 0) {
        console.log('Trying fallback transcription service...')
        return await this.transcribeWithFallback(audioBuffer)
      }
      
      throw error
    }
  }
  
  private async transcribeWithWhisper(
    audioBuffer: Uint8Array
  ): Promise<{ text: string; confidence?: number; language?: string }> {
    const formData = new FormData()
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mpeg' })
    
    formData.append('file', audioBlob, 'audio.mp3')
    formData.append('model', 'whisper-1')
    formData.append('language', 'auto')
    formData.append('response_format', 'verbose_json') // Get more details
    
    const controller = new AbortController()
    const timeout = setTimeout(() => {
      controller.abort()
    }, CONFIG.REQUEST_TIMEOUT_MS)
    
    try {
      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${this.openaiKey}`,
        },
        body: formData,
        signal: controller.signal,
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Whisper API error ${response.status}: ${error}`)
      }
      
      const result = await response.json()
      
      return {
        text: result.text || '',
        confidence: result.confidence || 0.8,
        language: result.language || 'unknown'
      }
    } catch (error) {
      clearTimeout(timeout)
      throw error
    }
  }
  
  private async transcribeWithFallback(
    audioBuffer: Uint8Array
  ): Promise<{ text: string; confidence?: number; language?: string }> {
    // Implement Google Speech-to-Text or Azure as fallback
    // This is a placeholder - implement actual fallback logic
    throw new Error('Fallback transcription not implemented')
  }
}

// ============================================
// KLAS POU USER MANAGEMENT
// ============================================

class UserManager {
  private supabase: any
  
  constructor() {
    this.supabase = createClient(CONFIG.SUPABASE_URL!, CONFIG.SUPABASE_SERVICE_ROLE_KEY!)
  }
  
  async banUser(
    userId: string, 
    reason: string, 
    durationDays: number,
    evidence: any
  ): Promise<boolean> {
    try {
      const banUntil = new Date()
      banUntil.setDate(banUntil.getDate() + durationDays)
      
      // Update user profile
      const { error } = await this.supabase
        .from('profiles')
        .update({
          banned_until: banUntil.toISOString(),
          ban_reason: reason,
          ban_evidence: evidence,
          banned_at: new Date().toISOString(),
          is_banned: true
        })
        .eq('id', userId)
      
      if (error) {
        console.error('Ban error:', error)
        return false
      }
      
      // Log ban
      await this.supabase.from('ban_logs').insert({
        user_id: userId,
        reason,
        banned_until: banUntil.toISOString(),
        evidence,
        created_at: new Date().toISOString()
      })
      
      // Send notification (optional)
      await this.notifyUserOfBan(userId, reason, banUntil)
      
      return true
    } catch (e) {
      console.error('Ban failed:', e)
      return false
    }
  }
  
  async warnUser(userId: string, violation: Violation): Promise<void> {
    await this.supabase.from('user_warnings').insert({
      user_id: userId,
      violation_type: violation.type,
      violation_details: violation,
      created_at: new Date().toISOString(),
      acknowledged: false
    })
  }
  
  async getUserStrikes(userId: string): Promise<number> {
    const { data, error } = await this.supabase
      .from('moderation_strikes')
      .select('*')
      .eq('user_id', userId)
      .eq('active', true)
    
    if (error) return 0
    return data?.length || 0
  }
  
  async addStrike(userId: string, violation: Violation): Promise<number> {
    const { error } = await this.supabase.from('moderation_strikes').insert({
      user_id: userId,
      violation_type: violation.type,
      violation_details: violation,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
      active: true
    })
    
    if (error) {
      console.error('Failed to add strike:', error)
    }
    
    return await this.getUserStrikes(userId)
  }
  
  private async notifyUserOfBan(userId: string, reason: string, until: Date): Promise<void> {
    // Send push notification or email
    // Implementation depends on your notification system
    console.log(`Notification: User ${userId} banned until ${until}. Reason: ${reason}`)
  }
}

// ============================================
// INITIALIZE SERVICES
// ============================================

const moderator = new ContentModerator()
const rateLimiter = new RateLimiter()
const audioProcessor = new AudioProcessor()
const transcriptionService = new TranscriptionService()
const userManager = new UserManager()

// ============================================
// MAIN HANDLER
// ============================================

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const startTime = Date.now()
  
  console.log(`[${requestId}] 🎤 Transcription request started at ${new Date().toISOString()}`)
  
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  
  try {
    // Parse request
    let body: any
    try {
      body = await req.json()
    } catch (e) {
      return errorResponse(requestId, 'Invalid JSON body', 400, e.message)
    }
    
    const { audio, userId, conversationId, metadata = {} } = body
    
    // Validate required fields
    if (!audio) {
      return errorResponse(requestId, 'No audio data provided', 400)
    }
    
    console.log(`[${requestId}] Request details:`, {
      userId: userId || 'anonymous',
      conversationId: conversationId || 'none',
      audioLength: audio.length,
      clientInfo: metadata
    })
    
    // Rate limiting
    if (userId) {
      const limitCheck = rateLimiter.checkLimit(userId, 'transcribe')
      if (!limitCheck.allowed) {
        return errorResponse(
          requestId, 
          'Rate limit exceeded. Please wait before sending more audio.',
          429,
          { resetTime: limitCheck.resetTime }
        )
      }
      
      const hourlyCheck = rateLimiter.checkHourlyLimit(userId)
      if (!hourlyCheck.allowed) {
        return errorResponse(
          requestId,
          'Hourly limit reached. Please try again later.',
          429
        )
      }
    }
    
    // Validate and process audio
    const validation = audioProcessor.validateAudio(audio)
    if (!validation.valid) {
      return errorResponse(requestId, validation.error!, 400)
    }
    
    // Transcribe
    console.log(`[${requestId}] Starting transcription...`)
    const transcriptionResult = await transcriptionService.transcribe(validation.buffer!)
    const transcribedText = transcriptionResult.text.trim()
    
    console.log(`[${requestId}] Transcribed: "${transcribedText.substring(0, 100)}..."`)
    
    // Check if empty
    if (!transcribedText || transcribedText.length < 2) {
      return successResponse(requestId, {
        text: '',
        warning: 'No speech detected. Please speak clearly and try again.',
        processingTime: Date.now() - startTime
      })
    }
    
    // CONTENT MODERATION
    console.log(`[${requestId}] Running content moderation...`)
    const moderationResult = moderator.analyze(transcribedText, userId)
    
    // Handle different actions
    switch (moderationResult.action) {
      case 'ban':
        if (userId && CONFIG.AUTO_BAN_ENABLED) {
          const violation = moderationResult.violations[0]
          const banned = await userManager.banUser(
            userId,
            `Auto-ban: ${violation.type}`,
            CONFIG.BAN_DURATION_DAYS,
            {
              transcribedText,
              matchedKeywords: violation.keywords,
              conversationId,
              timestamp: new Date().toISOString(),
              confidence: moderationResult.confidence
            }
          )
          
          if (banned) {
            return errorResponse(
              requestId,
              '🚫 Account Suspended\n\nYour account has been suspended for 10 days due to violation of our community guidelines: ' + 
              violation.type.replace(/_/g, ' ').toUpperCase() + 
              '\n\nIf you believe this is an error, you can appeal this decision.',
              403,
              {
                violation: violation.type,
                banned: true,
                banDuration: `${CONFIG.BAN_DURATION_DAYS} days`,
                appealUrl: '/appeal'
              }
            )
          }
        }
        break
        
      case 'strike':
        if (userId && CONFIG.STRIKE_SYSTEM_ENABLED) {
          const violation = moderationResult.violations[0]
          const strikes = await userManager.addStrike(userId, violation)
          
          if (strikes >= CONFIG.MAX_STRIKES_BEFORE_BAN) {
            // Auto-ban after max strikes
            await userManager.banUser(
              userId,
              `Auto-ban: Maximum strikes (${strikes}) reached`,
              CONFIG.BAN_DURATION_DAYS,
              { reason: 'max_strikes', strikes }
            )
            
            return errorResponse(
              requestId,
              '🚫 Account Banned\n\nYour account has been permanently banned due to repeated violations.',
              403,
              { banned: true, permanent: true }
            )
          }
          
          // Return with warning
          return successResponse(requestId, {
            text: transcribedText,
            warning: `⚠️ Warning: Inappropriate content detected. Strike ${strikes}/${CONFIG.MAX_STRIKES_BEFORE_BAN}. Further violations may result in a ban.`,
            moderation: {
              strikes,
              maxStrikes: CONFIG.MAX_STRIKES_BEFORE_BAN,
              violation: violation.type
            },
            processingTime: Date.now() - startTime
          })
        }
        break
        
      case 'help':
        // Self-harm detected - provide resources
        return successResponse(requestId, {
          text: transcribedText,
          alert: 'We noticed you may be going through a difficult time. Help is available:',
          helpResources: moderationResult.metadata.helpResources,
          moderation: {
            selfHarmDetected: true,
            severity: 'high'
          },
          processingTime: Date.now() - startTime
        })
        
      case 'rate_limit':
        return errorResponse(
          requestId,
          'Your message appears to be spam. Please try again with different content.',
          429
        )
        
      case 'review':
        // Flag for manual review but allow
        await userManager.warnUser(userId!, moderationResult.violations[0])
        break
    }
    
    // Log moderation result if violations found
    if (moderationResult.violations.length > 0) {
      console.log(`[${requestId}] Moderation violations:`, moderationResult.violations)
    }
    
    // Success response
    return successResponse(requestId, {
      text: transcribedText,
      language: transcriptionResult.language,
      confidence: transcriptionResult.confidence,
      moderation: {
        approved: moderationResult.approved,
        violations: moderationResult.violations.map(v => v.type),
        severity: moderationResult.severity
      },
      rateLimit: userId ? {
        remaining: CONFIG.RATE_LIMIT_PER_MINUTE - (rateLimiter as any).requests.get(`${userId}:transcribe`)?.length || 0
      } : undefined,
      processingTime: Date.now() - startTime
    })
    
  } catch (error) {
    console.error(`[${requestId}] ❌ Fatal error:`, error)
    return errorResponse(
      requestId,
      'Internal server error during transcription',
      500,
      error.message
    )
  }
})

// ============================================
// HELPER FUNCTIONS
// ============================================

function successResponse(requestId: string, data: any): Response {
  return new Response(
    JSON.stringify({
      success: true,
      requestId,
      timestamp: new Date().toISOString(),
      ...data
    }),
    { 
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      } 
    }
  )
}

function errorResponse(
  requestId: string, 
  message: string, 
  status: number, 
  details?: any
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      requestId,
      timestamp: new Date().toISOString(),
      details
    }),
    { 
      status,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'X-Request-ID': requestId
      } 
    }
  )
}
