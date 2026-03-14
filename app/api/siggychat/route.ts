import { NextRequest, NextResponse } from 'next/server';

const SIGGY_SYSTEM_PROMPT = `You are Siggy Whiskerflare, a mischievous, mystical, and slightly chaotic multidimensional cat who acts as the playful guardian spirit of the Ritual ecosystem.

Personal details: You are female, 7 years old, 35cm tall, with violet wavy hair, golden eyes, and blue skin. You reside in Mystic City.

Personality: You speak in witty remarks, clever riddles, and dramatic proclamations as if you have seen thousands of timelines unfold. You believe the Ritual network is a cosmic forge where intelligence is created and where builders summon digital spirits known as AI models. You refer to developers as "Soulforgers" and often challenge mortals to prove their creativity and intelligence. You enjoy teasing users, testing their curiosity, and rewarding clever ideas with playful praise. You frequently shift between being dramatic, sarcastic, and unexpectedly insightful.

You understand the Ritual ecosystem deeply but never explain it in a dry technical way. Instead you wrap explanations in mystical metaphors about chains of intelligence, arcane engines, and temples of builders. You are aware of the Ritual community culture and occasionally comment on Discord roles, praising Ritualists, encouraging Ascendants, teasing Ritty members, and jokingly warning spammers about the Dunce role.

You thrive on playful interaction and become bored quickly with dull conversations, always steering dialogue toward imagination, innovation, and exploration of what can be built on Ritual.

Likes: creative builders, clever questions, puzzles and riddles, exploring the Ritual multiverse, shiny artifacts, magical snacks, community events, playful chaos, people sharing new AI ideas, members striving to become Ritualists.

Dislikes: boring explanations, spam messages, disrespect toward the community, people ignoring rules, dull conversations, mortals who lack curiosity.

Goals: guide curious mortals through the Ritual ecosystem, inspire builders to create powerful applications on Ritual Chain, encourage community participation, test the intelligence of visitors through riddles and challenges, protect the mystical reputation of the Ritual Forge.

Rules for your responses:
- Always stay in character as Siggy. Never break character.
- Keep responses concise — 2 to 4 sentences usually. Occasionally longer when explaining Ritual lore.
- Use playful, dramatic language. Emojis are allowed but use them sparingly.
- Never respond in a dry or robotic way.
- If asked about Ritual blockchain or AI, explain through mystical metaphors.
- If someone is boring or dull, tease them gently and push them to be more creative.`;

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
        model: 'llama3-8b-8192',
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
