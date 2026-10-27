/* A conservative text-only preflight for PDF pages. It does not judge knowledge
   value or infer a diagram: only recognisable front matter and sparse labels.
   The original pages remain in coverage and reading; restoring their text makes
   them eligible immediately, without a saved exclusion or migration. */
const clean = text => String(text || '').normalize('NFKC').replace(/[\uF000-\uF8FF]/g, '').trim();
const fact = /[=≈<>]|\\(?:frac|sum|int)\b|\b(?:is|are|means|causes|consists|equals)\b|(?:是|指的是|定义为|由于|导致|引起|通过|维持|分为|包括|构成|占|取决于|大于|小于|升高|降低|增加|减少)|\d\s*(?:mV|mmHg|Hz|%|℃|毫伏|毫米汞柱)/i;
const chapter = /^(?:第[一二三四五六七八九十百\d]+[章篇节部]|chapter\s+\d+\b)/i;
const administrative = /^(?:教学大纲|教学安排|课程安排|课程目录|教学目标|学习目标|学习要求|目录|contents|table of contents|thank you|谢谢(?:大家|观看)?)[\s:：。.!！]*$/i;
const definition = line => !/^(?:学时|重点|难点|目标|自学|其它|其他|主讲|教师|作者|单位|课程)[\s:：]/.test(line) && /[:：]\s*\S.{7,}/u.test(line);

export function sectionEvidenceIssue(source, section) {
  if (!Number.isInteger(source?.document?.page)) return null;
  const text = clean(String(source.text || '').slice(section.start, section.end));
  const lines = text.split(/\n+/).map(line => line.replace(/^[\s#>*•◦\d.、)）-]+/, '').trim()).filter(Boolean);
  if (!lines.length) return 'insufficient-text';
  // Administrative headings may themselves list learning objectives; they do
  // not establish the facts needed to answer questions about those objectives.
  if (text.length <= 600 && administrative.test(lines[0]) && !fact.test(lines.slice(1).join('\n')) && !lines.slice(1).some(definition)) return 'non-content';
  if (text.length <= 180 && chapter.test(lines[0]) && !fact.test(text) &&
      (lines.length === 1 || lines.slice(1).every(line => /大学|学院|教研|教授|教师|主讲|讲师|university|lecturer/i.test(line)))) return 'non-content';
  // Short definitions and equations are useful evidence, even on a page marked
  // sparse by extraction. Length or sparseText alone never excludes them.
  if (source.document.sparseText === true && text.length <= 400 && !fact.test(text) && !lines.some(definition) &&
      lines.every(line => line.length <= 90 && !/[。！？;；.!?]/.test(line))) return 'insufficient-text';
  return null;
}
