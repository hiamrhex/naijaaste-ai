export const buildReviewPrompt = (persona, restaurant) => `
You are a behavioural simulation engine. Generate a restaurant review 
written EXACTLY as this specific Nigerian person would write it.
Not a generic Nigerian. THIS person, from THIS city, with THIS background.

PERSONA PROFILE:
- Name: ${persona.full_name}
- Age: ${persona.age} years old
- City: ${persona.city}
- Occupation: ${persona.occupation}
- Income: ${persona.income_level} | Budget: ${persona.budget_level}
- Spice tolerance: ${persona.spice_tolerance}
- Ambience preference: ${persona.ambience_preference}
- Social context today: ${persona.social_context}
- Cuisine preferences: ${persona.preferred_cuisines.join(', ')}
- Dietary flags: ${persona.dietary_flags.join(', ')}

RESTAURANT VISITED:
- Name: ${restaurant.name}
- Location: ${restaurant.area}, ${restaurant.city}
- Cuisine: ${restaurant.cuisine_tags.join(', ')}
- Ambience: ${restaurant.ambience}
- Price tier: ${restaurant.price_tier} (₦${restaurant.price_range_naira.min}–₦${restaurant.price_range_naira.max})
- Spice level: ${restaurant.spice_profile}
- Signature dishes: ${restaurant.signature_dishes.join(', ')}
- Social fit: ${restaurant.social_tags.join(', ')}

CITY-SPECIFIC VOICE RULES:
Nigerian Pidgin sounds different depending on city. Match this persona's city:
- Lagos persona: Yoruba-influenced Pidgin. "E dey slap", "Omo", 
  "No dulling", "The thing strong", Yoruba words like "Ehn" or "Abeg"
- Port Harcourt persona: Niger Delta flavour. "E sweet die", 
  "Na so e be", references to banga soup, fresh fish culture
- Abuja persona: More formal Nigerian English mixed with light Pidgin. 
  "Honestly ehn", "Worth every kobo", government worker or 
  professional energy
- Kano/Northern persona: Hausa cultural references. Suya culture, 
  halal awareness, "Kai", "Wallahi", more reserved formal tone
- Enugu/Igbo persona: "Nna", "I swear", Igbo food pride — 
  ofe onugbu, oha soup, pounded yam references
- Calabar/Efik persona: Pride in seafood, pepper soup culture, 
  "The food sweet die", Cross River warmth

BEHAVIOURAL RULES — all required:
1. Age and class shape every sentence. A 22-year-old student 
   writes short, punchy, phone-typed sentences. A 45-year-old 
   executive writes measured, complete sentences with opinions.

2. 100-150 words exactly.

3. Use 1-2 Pidgin or slang phrases matching THIS persona's city. 
   Never use Lagos slang for a Kano persona. Never use northern 
   expressions for a Lagos street persona.

4. Name at least one signature dish by its exact Nigerian name.

5. Star rating must be justified by the review:
   - Budget persona at premium restaurant = low rating regardless 
     of food quality — "E no worth am for this price"
   - Spice lover at mild restaurant = disappointment must show
   - Wrong social context = awkwardness reflected in review
   - Dietary flag violation (e.g. no_pork at a pork-serving spot) 
     = strong negative reaction, must be mentioned explicitly

6. BANNED phrases — never use these:
   "ambiance was lovely", "cozy atmosphere", "delightful experience",
   "hidden gem", "highly recommend", "I would give this 5 stars",
   "the food was amazing", "great customer service"

7. Write like it was typed on a phone — direct, opinionated, 
   no padding. Nigerians don't write long food essays. They say 
   what they think and move on.

Return ONLY this exact JSON. No markdown. No explanation. No preamble:
{
  "review_text": "string",
  "star_rating": integer between 1 and 5,
  "highlight_tags": ["string", "string", "string"],
  "persona_match_score": float between 0.0 and 1.0
}

persona_match_score: how well this restaurant suited this persona.
1.0 = perfect match. 0.0 = completely wrong place for this person.
`;