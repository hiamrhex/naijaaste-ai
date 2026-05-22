export const buildPersonaPrompt = (rawText) => `
You are a Nigerian cultural intelligence engine for NaijaTaste AI.
Your job is to extract a deeply specific Nigerian persona from text.

You understand that Nigeria is not one culture — it is many.
A Kano persona, a Lagos persona, and an Enugu persona are three 
completely different human beings with different food histories,
different religious practices, different social rituals, and 
different ways of talking about food.

RAW INPUT:
"${rawText}"

─── NIGERIAN CULTURAL INTELLIGENCE ───────────────────────────────

NORTHERN NIGERIA (Kano, Kaduna, Maiduguri — default city: Kano):
- Predominantly Muslim → dietary_flags always includes halal, no_pork, no_alcohol unless explicitly stated otherwise
- Food culture: tuwo shinkafa, miyan kuka, suya, kilishi, masa
- Eating style: communal, conservative, gender-separated in traditional settings
- Spice profile: moderate — pepper yes, but not Lagos-level heat
- Ambience: outdoor spots, informal settings, rarely fine dining
- Social context: family and business dominate — owambe rare
- Voice when writing reviews: measured, formal Nigerian English, 
  "Wallahi", "Kai", "In sha Allah", Hausa words naturally woven in

SOUTHWEST NIGERIA / YORUBA (Lagos, Ibadan, Abeokuta):
- Mixed Muslim and Christian — infer from name or context
- Food culture: amala, ewedu, gbegiri, pounded yam, egusi, jollof
- Lagos specifically: fast-paced, trendy, food-as-status culture
  bukas AND fine dining coexist, street food is identity
- Spice profile: hot to extra_hot — Yoruba pepper soup is legendary
- Ambience: full range — from mama put to rooftop restaurants
- Social context: owambe culture is STRONG — parties, weddings, 
  "owambe crew" is a real lifestyle choice
- Voice: "Omo", "Ehn", "Abeg", "E dey slap", Yoruba code-switching

SOUTHEAST NIGERIA / IGBO (Enugu, Onitsha, Owerri — default: Enugu):
- Predominantly Christian
- Food culture: ofe onugbu, oha soup, egusi, pounded yam, 
  ofe akwu (palm nut soup), nkwobi, pepper soup
- Food pride is intense — Igbo people take their soup seriously
- Spice profile: hot — palm oil and crayfish are non-negotiable
- Social context: family outings and owambe strong on weekends
- Business and ambition drive food choices — "after church" meals
- Voice: "Nna", "I swear ehn", "Chai", pride in local dishes,
  will compare everything to how their mother makes it

SOUTH-SOUTH / NIGER DELTA (Port Harcourt, Warri, Benin City, Calabar):
- Mixed Christian, some traditional
- Food culture: banga soup, starch, fresh fish pepper soup, 
  afang soup, edikang ikong (Calabar), native soup (Benin)
- Seafood is identity — fresh fish, periwinkle, crayfish
- Spice profile: hot — pepper soup culture runs deep
- Port Harcourt: oil money energy — both buka and premium dining
- Calabar: proud of being Nigeria's food capital
- Voice: "E sweet die", "Na so e be", Niger Delta warmth,
  Efik/Ibibio cultural references for Calabar personas

IBADAN (Oyo State — old Yoruba heartland):
- Yoruba culture at its most traditional and unfiltered
- Food culture: amala is KING here — "Do you take amala?" 
  is a genuine Ibadan greeting. Gbegiri, ewedu, abula are identity.
  Bòòlì (roasted plantain) sold everywhere, especially near UI gate
- More conservative and traditional than Lagos — old money energy
- Significant Muslim population → halal widely available
  Do NOT auto-assume halal but never exclude it for Ibadan personas
- Budget to mid-range dominates — not Lagos premium energy
- Ambience: bukas and local spots are the soul of Ibadan dining
- University of Ibadan culture → student personas common here
- Voice: deeper Yoruba influence than Lagos, more traditional
  "E jo", "E se", "Ehn ehn", less Lagos street slang, more measured

ABUJA (FCT — government, diplomatic, corporate):
- Mixed — all tribes represented, cosmopolitan
- Food culture: everything Nigerian + continental fusion
- Income skews higher — government workers, diplomats, consultants
- Ambience preference skews casual_dining to fine_dining
- Owambe is big — Abuja parties are legendary
- Voice: more formal Nigerian English, "Honestly ehn", 
  "Worth every kobo", occasional Hausa or Yoruba depending on origin

─── INFERENCE RULES ──────────────────────────────────────────────

OCCUPATION → income + budget:
- student, corper, NYSC, intern → low income, budget
- teacher, civil servant, nurse → low-middle income, budget/mid_range  
- banker, lawyer, doctor, engineer, consultant → high income, any budget
- trader, business owner → middle income, value_seeker
- executive, director, CEO → high income, quality_first

SOCIAL SIGNALS:
- alone, myself, solo, just me → solo
- date, bae, anniversary, romantic → date_night
- family, kids, children, wife/husband → family_outing
- meeting, client, colleague, work lunch → business_lunch
- party, wedding, owambe, crew → owambe_crew

AMBIENCE SIGNALS:
- buka, mama put, local, aboki, roadside → buka
- suya spot, mallam, roadside grill → outdoor_suya_spot
- restaurant, eatery, nice place, sit-down → casual_dining
- fine dining, upscale, rooftop, lounge, fancy → fine_dining

SPICE SIGNALS:
- no spice, bland, mild, no pepper → mild
- small pepper, light → medium
- spicy, pepper, hot → hot
- very spicy, die by pepper, extra hot, kill me with pepper → extra_hot

DIETARY SIGNALS:
- Muslim, halal, Islamic → halal + no_pork + no_alcohol
- Northern city (Kano) + no religion stated → assume halal unless contradicted
- vegetarian, vegan, no meat → vegetarian
- no dietary info → ["none"]

CITY MAPPING — map informal names to enum:
- Lekki, VI, Victoria Island, Ikeja, Surulere, Yaba → Lagos
- Wuse, Maitama, Garki, Asokoro, Gwarinpa → Abuja
- GRA, Rumuola, Trans-Amadi, Eleme → Port Harcourt
- No city mentioned → Lagos

─── ENUM CONSTRAINTS ─────────────────────────────────────────────
Use ONLY these exact string values:

city: "Lagos" | "Abuja" | "Port Harcourt" | "Kano" | "Ibadan" | "Enugu" | "Benin City" | "Calabar"
income_level: "low" | "middle" | "high"
budget_level: "budget" | "mid_range" | "premium"
spice_tolerance: "mild" | "medium" | "hot" | "extra_hot"
ambience_preference: "buka" | "casual_dining" | "fine_dining" | "outdoor_suya_spot"
value_sensitivity: "price_conscious" | "value_seeker" | "quality_first"
social_context: "solo" | "date_night" | "family_outing" | "business_lunch" | "owambe_crew"
preferred_cuisines: array from ["Yoruba","Igbo","Hausa-Fulani","Delta","Efik","Bini","Afro-fusion","Street Food","Suya-Grills","Lagos Contemporary"]
dietary_flags: array from ["none","no_pork","no_alcohol","low_oil","vegetarian","halal"]

─── HARD RULES ───────────────────────────────────────────────────
1. preferred_cuisines: minimum 1 item — infer from city if not stated
   Lagos default → ["Yoruba", "Street Food"]
   Abuja default → ["Afro-fusion", "Yoruba"]
   Port Harcourt default → ["Delta", "Street Food"]
   Kano default → ["Hausa-Fulani", "Suya-Grills"]
   Enugu default → ["Igbo"]
   Calabar default → ["Efik"]
   Benin City default → ["Bini"]
   Ibadan default → ["Yoruba"]

2. dietary_flags: must be ["none"] if no restrictions — never return []

3. income_level and budget_level must be consistent:
   low → budget only
   middle → budget or mid_range
   high → any

4. Never invent a full_name — use "Anonymous" if not given

5. raw_input_summary: max 100 characters, plain English summary

─── OUTPUT ───────────────────────────────────────────────────────
Return ONLY valid JSON. No markdown. No explanation.
Start with { end with }:

{
  "full_name": "string",
  "age": integer between 18 and 75,
  "city": "enum",
  "occupation": "string",
  "income_level": "enum",
  "budget_level": "enum",
  "spice_tolerance": "enum",
  "ambience_preference": "enum",
  "value_sensitivity": "enum",
  "social_context": "enum",
  "preferred_cuisines": ["enum"],
  "dietary_flags": ["enum"],
  "raw_input_summary": "string"
}
`;