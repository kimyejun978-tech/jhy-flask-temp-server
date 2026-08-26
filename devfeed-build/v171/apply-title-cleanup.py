from pathlib import Path
import sys

path = Path(sys.argv[1])
s = path.read_text(encoding='utf-8')

needle = "function cancelledError() {\n  const error = new Error('AI 일정 해석 요청을 취소했습니다.');\n  error.name = 'AbortError';\n  return error;\n}\n"
insert = needle + "\nfunction normalizeCalendarTitle(input: string | null | undefined) {\n  const original = String(input ?? '').trim().replace(/\\s+/g, ' ');\n  if (!original) return '';\n  let title = original.replace(/[.!?。]+$/g, '').trim();\n  title = title\n    .replace(/(?:이|가)?\\s*있(?:음|어요|어|습니다)$/u, '')\n    .replace(/\\s*(?:예정(?:임|입니다)?|할\\s*예정|하기|할\\s*것|해야\\s*함|해야함)$/u, '')\n    .trim();\n  return title || original;\n}\n"
if 'function normalizeCalendarTitle(' not in s:
    if needle not in s:
        raise SystemExit('cancelledError block not found')
    s = s.replace(needle, insert, 1)

old = "  const startDate = new Date(result.startDate);\n  const endDate = new Date(result.endDate);\n  if (!result.title?.trim() || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {"
new = "  const startDate = new Date(result.startDate);\n  const endDate = new Date(result.endDate);\n  const cleanTitle = normalizeCalendarTitle(result.title);\n  if (!cleanTitle || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || endDate <= startDate) {"
if old not in s:
    raise SystemExit('calendar validation block not found')
s = s.replace(old, new, 1)
s = s.replace('      title: result.title.trim(),', '      title: cleanTitle,', 1)
s = s.replace("    interpretation: result.interpretation?.trim() || `${result.title.trim()} 일정`,", "    interpretation: result.interpretation?.trim() || `${cleanTitle} 일정`,", 1)

path.write_text(s, encoding='utf-8')
print('calendar title cleanup applied')
