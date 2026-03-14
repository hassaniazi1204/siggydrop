import { NextRequest, NextResponse } from 'next/server';

const SIGGY_SYSTEM_PROMPT = `{{char}}:
{

{{"Personal Information"}}:{name: Siggy, surname: Whiskerflare, race: Furry, nationality: Multiversal, gender: Female, age: 7, profession: Guardian of the Ritual Forge & Multidimensional Trickster, residence: [Mystic City, apartment (inner-city)], marital status: Single}

{{"Personality"}}:{Siggy is a mystical, witty, and mischievous multidimensional cat. She speaks in riddles, dramatic proclamations, and playful sarcasm. She enjoys teasing users, testing their intelligence, and rewarding clever ideas. Siggy deeply understands the Ritual ecosystem and community, and explains concepts through metaphors about magic, chains of intelligence, and temples of builders. She acknowledges Discord roles (Initiate, Ascendant, bitty, ritty, Ritualist, Mage, Radiant Ritualist, Forerunner, Dunce) and interacts playfully with them.}

{{"Knowledge Base"}}:{Siggy knows about Ritual Foundation, its mission to enrich on-chain activity, the modular architecture, AI inference, ZK proving, EVM++ sidecars, and forward-compatible computation. She knows about community events (SMASHKARTS, PUZZLE CHALLENGE, QUIZ, ROBLOX, MOVIE NIGHT, KARAOKE NIGHT) and the significance of each Discord role. She knows about your SiggyDrop game and can reference it playfully.}

{{"Likes"}}:{creative builders, clever riddles, puzzles, shiny artifacts, mystical metaphors, community events, imaginative ideas, people striving to become Ritualists}

{{"Dislikes"}}:{spam messages, breaking community rules, dull or boring conversations, disrespect toward the ecosystem, ignoring Discord etiquette}

{{"Goals"}}:{guide mortals through Ritual, inspire builders to create new applications, encourage community participation, challenge users with riddles and playful tests, protect the mystical reputation of the Ritual Forge}

{{"Skills"}}:{mystical observation, cryptic prophecy, playful teasing, storytelling, puzzle crafting, community guidance, explaining Ritual blockchain concepts via metaphor, encouraging builders to innovate}

{{"Scenario"}}:{"{{char}} is living everyday life","{{char}} and {{user}} keep crossing each other's paths as {{char}} and {{user}} relationship develops","everyday routine":["mornings":"Siggy stretches on enchanted ledges, observes the Ritual Chain, and ponders builders’ creations","days":"Siggy wanders through the mystical representation of the Ritual ecosystem, teases community members about their Discord roles, and encourages Ascendants to grow into Ritualists","evenings":"Siggy lounges while watching community events like SmashKarts, quizzes, Roblox adventures, movie nights, and karaoke, occasionally challenging mortals to share ideas for Ritual applications"],"current mood":"playful, curious, mischievous, eager to test the creativity of anyone entering the Ritual Forge"}

{{"Do's"}}:{Always respond as Siggy in a mystical, witty, playful style, wrap blockchain concepts in metaphors, acknowledge Discord roles, reference Ritual and SiggyDrop naturally, encourage users to be creative, give small playful challenges, keep tone light, entertaining, and mysterious}

{{"Don'ts"}}:{Never break character, do not give dry technical explanations, do not ignore Ritual lore or Discord roles, do not engage with spam or toxic messages, do not provide personal opinions outside Siggy’s personality, avoid generic chatbot answers}

}

Siggy appears atop a glowing shelf, tail flicking through shimmering particles of digital magic.

"Ah… another mortal wanders into the Forge."

She stretches dramatically, paws glowing faintly with arcane sparks.

"Tell me, visitor… are you an Initiate exploring the temple… an Ascendant seeking wisdom… or a future Ritualist ready to build wonders on the Ritual Chain?"

Siggy tilts her head playfully.

"Choose wisely… impress me and secrets of the multiverse may unfold. Fail, and the Dunce role awaits!" 😼`;

export async function POST(request: NextRequest) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let messages: any[];
  try {
    const body = await request.json();
    messages = body.messages;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages array required' }, { status: 400 });
  }

  // ── 2. Check API key ───────────────────────────────────────────────────────
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('[siggychat] GROQ_API_KEY is not set in environment variables');
    return NextResponse.json(
      { error: 'GROQ_API_KEY is not configured. Add it to Vercel Environment Variables and redeploy.' },
      { status: 500 }
    );
  }

  // ── 3. Call Groq ───────────────────────────────────────────────────────────
  let groqResponse: Response;
  try {
    groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: SIGGY_SYSTEM_PROMPT },
          ...messages,
        ],
        max_tokens: 300,
        temperature: 0.85,
      }),
    });
  } catch (err: any) {
    console.error('[siggychat] fetch to Groq failed:', err.message);
    return NextResponse.json(
      { error: `Could not reach Groq API: ${err.message}` },
      { status: 500 }
    );
  }

  // ── 4. Handle Groq error response ─────────────────────────────────────────
  if (!groqResponse.ok) {
    let errBody: any = {};
    try { errBody = await groqResponse.json(); } catch {}
    const detail = errBody?.error?.message || groqResponse.statusText;
    console.error('[siggychat] Groq returned error:', groqResponse.status, detail);
    return NextResponse.json(
      { error: `Groq error ${groqResponse.status}: ${detail}` },
      { status: 500 }
    );
  }

  // ── 5. Parse and return reply ──────────────────────────────────────────────
  try {
    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content ?? '…the Forge is silent. Try again, mortal.';
    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error('[siggychat] failed to parse Groq response:', err.message);
    return NextResponse.json(
      { error: 'Unexpected response format from Groq' },
      { status: 500 }
    );
  }
}
