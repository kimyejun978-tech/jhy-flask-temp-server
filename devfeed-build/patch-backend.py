from pathlib import Path
p=Path('api/src/index.ts')
s=p.read_text(encoding='utf-8-sig')
repls=[
("WHERE e.end_date IS NULL OR e.end_date >= date('now','-1 day')", "WHERE e.source_key <> 'sample' AND (e.end_date IS NULL OR e.end_date >= date('now','-1 day'))"),
("SELECT * FROM articles\n      ORDER BY CASE importance", "SELECT * FROM articles\n      WHERE source_key <> 'sample'\n      ORDER BY CASE importance"),
("'SELECT * FROM videos ORDER BY COALESCE(published_at,created_at) DESC LIMIT 30'", "\"SELECT * FROM videos WHERE source_key <> 'sample' ORDER BY COALESCE(published_at,created_at) DESC LIMIT 30\""),
("for (const rawItem of items.slice(0, 8))", "for (const rawItem of items.slice(0, 30))"),
("      if (!tech) continue;", "      if (!tech && /(회고|일상|여행|독서|맛집|운동)/i.test(title)) continue;"),
("      .slice(0, 12);", "      .slice(0, 20);"),
("  let summaryBudget = 2;", "  let summaryBudget = 4;"),
("      if (!videoId || !title || !/(AI\\s*뉴스|AI News)/i.test(title)) continue;", "      if (!videoId || !title || !/(AI|인공지능|GPT|ChatGPT|OpenAI|Claude|Gemini|LLM|에이전트|Agent|Codex|Cursor|바이브\\s*코딩|Vibe\\s*Coding)/i.test(title)) continue;"),
]
old='''    const page = await fetch('https://www.youtube.com/@jocoding', {\n      headers: { 'user-agent': 'Mozilla/5.0 DevFeed/0.1' },\n    });\n    if (!page.ok) return 0;\n    const html = await readTextLimited(page, 1_500_000, true);\n    const channelMatch = html.match(/"channelId":"(UC[^"]+)"/);\n    if (!channelMatch) return 0;\n\n    const feed = await fetch(\n      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelMatch[1]}`,\n    );'''
new='''    // JoCoding's immutable YouTube channel id. The handle page embeds IDs\n    // for related channels, so taking the first channelId is unreliable.\n    const channelId = 'UCQNE2JmbasNYbjGAcuBiRRg';\n    const feed = await fetch(\n      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,\n    );'''
repls.append((old,new))
for old,new in repls:
    if old not in s:
        raise SystemExit('backend patch target missing: '+old[:80])
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')
print('backend collector patch applied')
