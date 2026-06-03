#!/usr/bin/env node
/**
 * Draft **`ucsdStartYear`** values by fetching HDSI faculty bios and parsing join-year phrases.
 *
 * Profiles use: https://datascience.ucsd.edu/people/{slug}/
 * Slug lookup: overrides JSON first, then **display name ↔ slug** scraped from `/faculty/`
 * (`<h4><a …/people/SLUG/">Name</a></h4>`), then roster `id` as URL slug.
 *
 *   node scripts/draft-dsc-start-years-from-site.mjs               # dry-run → JSON only
 *   node scripts/draft-dsc-start-years-from-site.mjs --limit=5      # smoke-test first 5
 *   node scripts/draft-dsc-start-years-from-site.mjs --apply        # merge matches into professors.json
 *
 * If TLS fails locally (corporate proxy), try once:
 *   PROFDLE_FETCH_INSECURE_TLS=1 node scripts/draft-dsc-start-years-from-site.mjs
 *
 * Fallback order after HDSI bio regexes:
 *   **Personal site** linked as “Website” / “CV” on the HDSI people page → crawl for `cv.pdf` (or HTML CV) and read employment lines.
 *   **UCSD Profiles** (`profiles.ucsd.edu`) when HTML mentions UC San Diego + Halıcıoğlu/HDSI.
 *   **English Wikipedia** career section (e.g. “moved to … UC San Diego in 2020”) when the article mentions UCSD/HDSI/SDSC.
 * Set `PROFDLE_ALLOW_PHD_PROXY=1` to re-enable weak Ph.D.-year guesses (off by default).
 * Optional slugs: `src/data/hdsi/hdsi-profiles-slug-overrides.json` (`"prof-id": "first.last"`).
 *
 * Always review output before --apply; regexes miss or mis-parse some bios.
 */
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PKG_ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(PKG_ROOT, 'src', 'data')
const HDSI_DATA = path.join(DATA_DIR, 'hdsi')
const PROF_PATH = path.join(DATA_DIR, 'professors.json')
const SLUG_MAP_PATH = path.join(HDSI_DATA, 'hdsi-people-slug-overrides.json')
const PROFILES_SLUG_MAP_PATH = path.join(HDSI_DATA, 'hdsi-profiles-slug-overrides.json')
const OUT_MATCH = path.join(HDSI_DATA, 'ucsd-start-years.web-draft.json')
const OUT_FAIL = path.join(HDSI_DATA, 'ucsd-start-years.web-draft.unmatched.json')

const BASE = 'https://datascience.ucsd.edu'
const PROFILES_BASE = 'https://profiles.ucsd.edu'
const PROFILES_GAP_MS = 380
const UA = 'ProfdleStartYearDraft/1.0 (+education; contact: repo maintainer)'

/** @type {[RegExp, number][]} — higher priority = tried first among matches */
const PATTERNS = [
  [/joined\s+(?:the\s+)?Hal[\u0130\u0131iI]c[\u0130\u0131iI]o[\u011Fg]lu\s+Data\s+Science\s+Institute[^.]{0,160}?\b(20\d{2})\b/i, 100],
  [/joined\s+HDSI[^.]{0,160}?\s+in\s+\b(20\d{2})\b/i, 98],
  [
    /joined\s+(?:the\s+)?(?:University of California,?\s+San Diego|UC\s*San\s*Diego|UCSD)\b[^.]{0,200}?\s+in\s+\b(20\d{2})\b/i,
    92,
  ],
  [
    /\bBefore\s+joining\s+(?:UC\s*San\s*Diego|UCSD)\b[^.]{0,220}?\s+in\s+\b(20\d{2})\b/i,
    91,
  ],
  [
    /\bPrior\s+to\s+(?:his|her|their)\s+appointment\s+at\s+(?:UC\s*San\s*Diego|UCSD)\b[^.]{0,180}?\s+in\s+\b(20\d{2})\b/i,
    86,
  ],
  [
    /faculty\s+member\s+of\s+(?:the\s+)?Hal[\u0130\u0131iI]c[\u0130\u0131iI]o[\u011Fg]lu\s+Data\s+Science\s+Institute[^.]{0,120}?\s+in\s+\b(20\d{2})\b/i,
    90,
  ],
  [
    /\bjoined\s+(?:the\s+)?Hal[\u0130\u0131iI]c[\u0130\u0131iI]o[\u011Fg]lu\s+Data\s+Science\s+Institute\s+as\b[^.]{0,140}?\s+in\s+\b(20\d{2})\b/i,
    96,
  ],
  [
    /\bAssistant\s+Professor[^.]{0,220}?(?:UC\s*San\s*Diego|UCSD|Hal[\u0130\u0131iI]c[\u0130\u0131iI]o[\u011Fg]lu\s+Data\s+Science|HDSI)\b[^.]{0,60}?\s+in\s+\b(20\d{2})\b/i,
    75,
  ],
  [
    /\bAssociate\s+(?:Teaching\s+)?Professor[^.]{0,220}?(?:UC\s*San\s*Diego|UCSD|HDSI)\b[^.]{0,80}?\s+in\s+\b(20\d{2})\b/i,
    75,
  ],
  [
    /\bjoined\s+the\s+faculty[^.]{0,260}?(?:UC\s*San\s*Diego|UCSD)\s+in\s+\b(20\d{2})\b/i,
    94,
  ],
  [
    /\buntil\s+(20\d{2})\b[^.]{0,80}?,\s*when\s+(?:he|she|they)\s+joined\s+(?:UC\s*San\s*Diego|UCSD)\b/i,
    93,
  ],
  [
    /moved\s+to\s+(?:her|his|their)\s+current\s+position\s+at[^.]{0,200}?(?:University of California,?\s+San Diego|UC\s*San\s*Diego|UCSD)\s+in\s+\b(20\d{2})\b/i,
    98,
  ],
  [
    /joined\s+the\s+faculty\s+of[^.]{0,220}?(?:Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu|HDSI|University of California,?\s+San Diego|UCSD)[^.]{0,140}?\s+in\s+\b(20\d{2})\b/i,
    97,
  ],
  [
    /\b(20\d{2})\s*[–—\-]\s*(?:Present|present|current)\b[^.]{0,220}?(?:Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu|HDSI|Halicioglu|UC\s*San\s*Diego|UCSD)/i,
    96,
  ],
  [
    /\bSince\s+(20\d{2})\b,?\s+[^.]{0,160}?\b(?:has\s+served|served|been)\b[^.]{0,240}?(?:San\s+Diego\s+Supercomputer|SDSC|UC\s*San\s*Diego|UCSD|HDSI|Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu)/i,
    88,
  ],
  [/returned\s+to\s+(?:UC\s*San\s*Diego|UCSD)\b[^.]{0,80}?\s+in\s+\b(20\d{2})\b/i, 88],
  [
    /\bcame\s+to\s+(?:UC\s*San\s*Diego|UCSD)\b[^.]{0,120}?\s+in\s+\b(20\d{2})\b/i,
    70,
  ],
  [
    /\barrived\s+(?:at|in)\s+(?:UC\s*San\s*Diego|UCSD)\b[^.]{0,120}?\s+in\s+\b(20\d{2})\b/i,
    68,
  ],
  [/Since\s+joining\s+SDSC\s+in\s+\b(20\d{2})\b/i, 52],
  [
    /Since\s+joining\s+the\s+San\s+Diego\s+Supercomputer\s+Center\s+in\s+\b(20\d{2})\b/i,
    52,
  ],
  [
    /\bSince\s+\b(20\d{2})\b,?\s+(?:he|she|they)\s+(?:joined|became\s+a\s+faculty|has\s+been\s+(?:an?\s+)?(?:Assistant|Associate)\s+Professor)/i,
    51,
  ],
  [/since\s+\b(20\d{2})\b,?\s+(?:he|she|they|Dr\.)\s+has\s+been[^.]{0,40}?(?:UC|San Diego|faculty)/i, 50],
]

const MIN_YEAR = 1995
const MAX_YEAR = new Date().getFullYear()
const DELAY_MS = 450
const WIKI_GAP_MS = 350
const CV_GAP_MS = 420
const MAX_CV_BYTES = 2_500_000

function loadSlugOverrides() {
  if (!fs.existsSync(SLUG_MAP_PATH)) return {}
  try {
    const j = JSON.parse(fs.readFileSync(SLUG_MAP_PATH, 'utf8'))
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

/** Optional `profiles.ucsd.edu` username per roster id (`"mary-smith": "mary.jane.smith"`). */
function loadProfilesSlugOverrides() {
  if (!fs.existsSync(PROFILES_SLUG_MAP_PATH)) return {}
  try {
    const j = JSON.parse(fs.readFileSync(PROFILES_SLUG_MAP_PATH, 'utf8'))
    return j && typeof j === 'object' && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const FETCH_TIMEOUT_MS = Number(process.env.PROFDLE_FETCH_TIMEOUT_MS) || 25_000

function fetchBuffer(urlStr, maxRedirects = 6, maxBytes = MAX_CV_BYTES) {
  const insecure = process.env.PROFDLE_FETCH_INSECURE_TLS === '1'
  return new Promise((resolve, reject) => {
    const tryOne = (u, left) => {
      const uo = new URL(u)
      const isHttps = uo.protocol === 'https:'
      const lib = isHttps ? https : http
      /** @type {import('node:http').RequestOptions} */
      const opts = {
        hostname: uo.hostname,
        port: uo.port || (isHttps ? 443 : 80),
        path: uo.pathname + uo.search,
        method: 'GET',
        headers: { 'User-Agent': UA, Accept: '*/*' },
        ...(isHttps ? { rejectUnauthorized: !insecure } : {}),
      }
      const req = lib.request(opts, (res) => {
        const loc = res.headers.location
        if (res.statusCode >= 300 && res.statusCode < 400 && loc && left > 0) {
          const next = new URL(loc, u).href
          res.resume()
          tryOne(next, left - 1)
          return
        }
        /** @type {Buffer[]} */
        const chunks = []
        let total = 0
        res.on('data', (c) => {
          total += c.length
          if (total <= maxBytes) chunks.push(c)
          else res.destroy()
        })
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} for ${u}`))
            return
          }
          resolve(Buffer.concat(chunks))
        })
      })
      req.setTimeout(FETCH_TIMEOUT_MS, () => {
        req.destroy()
        reject(new Error(`timeout after ${FETCH_TIMEOUT_MS}ms for ${u}`))
      })
      req.on('error', reject)
      req.end()
    }
    tryOne(urlStr, maxRedirects)
  })
}

function fetchHtml(urlStr, maxRedirects = 6) {
  return fetchBuffer(urlStr, maxRedirects, MAX_CV_BYTES).then((buf) => buf.toString('utf8'))
}

const PERSONAL_HOST_BLOCK =
  /(?:linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|scholar\.google|researchgate\.net|orcid\.org|github\.com\/orgs|openaccess\.thecvf\.com|arxiv\.org|doi\.org|ieee\.org|acm\.org)/i

const CV_URL_HINT =
  /(?:^|[/_.-])(?:cv|c\.v\.|curriculum[-_]?vitae|resume)(?:[._-]|\.pdf|$)/i

function unwrapUrlDefense(href) {
  const h = String(href ?? '').trim()
  const m = h.match(/^https?:\/\/urldefense\.com\/v3\/__([^_]+)__;/i)
  if (!m) return h
  return m[1].replace(/\*/g, '/')
}

/** Contact links on HDSI people pages (`Website`, `CV`, etc.) — scan full page (sidebar often empty). */
function extractPersonalUrlsFromPeopleHtml(html) {
  if (!html) return { website: null, cvUrls: [] }
  const scan = html

  /** @type {string | null} */
  let website = null
  /** @type {string[]} */
  const cvUrls = []

  const labeled =
    /<a[^>]+href=["']([^"']+)["'][^>]*>\s*(Website|Home\s*page|Homepage|CV|C\.V\.|Curriculum\s*Vitae)\s*<\/a>/gi
  let m
  while ((m = labeled.exec(scan)) !== null) {
    const href = unwrapUrlDefense(m[1].trim())
    const label = m[2].toLowerCase()
    if (!/^https?:\/\//i.test(href) || PERSONAL_HOST_BLOCK.test(href)) continue
    if (/website|home\s*page|homepage/.test(label)) website = website ?? href
    if (/cv|curriculum/.test(label)) cvUrls.push(href)
  }

  const pdfRe = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi
  while ((m = pdfRe.exec(scan)) !== null) {
    const href = unwrapUrlDefense(m[1].trim())
    if (CV_URL_HINT.test(href) && !PERSONAL_HOST_BLOCK.test(href)) cvUrls.push(href)
  }

  return { website, cvUrls: [...new Set(cvUrls)] }
}

function resolveUrl(base, href) {
  try {
    return new URL(href, base).href
  } catch {
    return null
  }
}

/** Discover CV PDF links from a personal homepage. */
function discoverCvUrlsFromPersonalSite(siteUrl, siteHtml) {
  /** @type {string[]} */
  const out = []
  const pdfRe = /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi
  let m
  while ((m = pdfRe.exec(siteHtml)) !== null) {
    const abs = resolveUrl(siteUrl, m[1].trim())
    if (abs && CV_URL_HINT.test(abs) && !PERSONAL_HOST_BLOCK.test(abs)) out.push(abs)
  }
  for (const tail of ['/cv.pdf', '/CV.pdf', '/files/cv.pdf', '/wp-content/uploads/cv.pdf']) {
    const abs = resolveUrl(siteUrl, tail)
    if (abs) out.push(abs)
  }
  return [...new Set(out)]
}

/** Text from PDF bytes (`pdf-parse` v2 `PDFParse`; latin1 fallback if parse fails). */
async function pdfBufferToPlain(buf) {
  try {
    const { PDFParse } = await import('pdf-parse')
    const parser = new PDFParse({ data: buf })
    const result = await Promise.race([
      parser.getText(),
      sleep(20_000).then(() => {
        throw new Error('pdf text extraction timeout')
      }),
    ])
    await parser.destroy()
    const text = String(result?.text ?? '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text.length > 40) return text
  } catch {
    // fall through
  }
  return buf
    .toString('latin1')
    .replace(/[^\x20-\x7E\n\r–—\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function guessUcsdStartFromCvPlain(plain) {
  if (!plain || plain.length < 40) return null
  const head = plain.slice(0, Math.min(14000, plain.length))
  return guessYearFromPlainText(head, { allowPhdProxy: false })
}

async function fetchCvPlainFromUrl(cvUrl) {
  const buf = await fetchBuffer(cvUrl, 4, MAX_CV_BYTES)
  const sniff = buf.slice(0, 8).toString('latin1')
  if (sniff.startsWith('%PDF')) return pdfBufferToPlain(buf)
  return htmlToPlain(buf.toString('utf8'))
}

async function tryPersonalSiteCvStartYear(peopleHtml) {
  const { website, cvUrls: sidebarCv } = extractPersonalUrlsFromPeopleHtml(peopleHtml)
  /** @type {string[]} */
  const candidates = [...sidebarCv]

  if (website && !PERSONAL_HOST_BLOCK.test(website)) {
    try {
      const siteHtml = await fetchHtml(website)
      candidates.push(...discoverCvUrlsFromPersonalSite(website, siteHtml))
      const onPage = guessUcsdStartFromCvPlain(htmlToPlain(siteHtml))
      if (onPage) return { year: onPage.year, pattern: `personal_html_${onPage.pattern}`, url: website }
    } catch {
      // try CV links only
    }
  }

  const uniq = [...new Set(candidates)].slice(0, 4)
  for (const cvUrl of uniq) {
    try {
      const plain = await fetchCvPlainFromUrl(cvUrl)
      const guessed = guessUcsdStartFromCvPlain(plain)
      if (guessed) return { year: guessed.year, pattern: `personal_cv_${guessed.pattern}`, url: cvUrl }
    } catch {
      // next candidate
    }
    await sleep(80)
  }
  return null
}

/** Pull HDSI `/people/{slug}/` bio HTML (WP “person-page” layout) so regexes skip global nav/footer. */
function extractPersonBioHtml(html) {
  const m = html.match(
    /<div class="info span\d+">\s*<div class="content">([\s\S]*?)<\/div>\s*<\/div>/i,
  )
  if (!m) return null
  const inner = m[1].trim().replace(/^(?:&nbsp;\s*|&#160;\s*|\u00a0\s*)+/iu, '').trim()
  return inner.length > 0 ? m[1] : null
}

function decodeBasicEntities(text) {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#038;/g, '&')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, '–')
    .replace(/&#(\d{2,6});/g, (_, n) => {
      const cp = Number(n)
      if (!Number.isFinite(cp) || cp < 1 || cp > 0x10ffff) return ' '
      try {
        return String.fromCodePoint(cp)
      } catch {
        return ' '
      }
    })
}

function htmlToPlain(html) {
  return decodeBasicEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim(),
  )
}

/** Snippet aimed at Assistant/join phrases — not the site chrome at the top of full-page plaintext. */
function excerptForReview(plain) {
  const triggers =
    /\b(?:Assistant|Associate(?:\s+Teaching)?)\s+Professor\b|joined\s+|Since\s+joining|faculty\s+member|came\s+to\s+UC|\b(?:HDSI|Hal[ıi]c[ıi]o[ğg]lu)\b/is
  let idx = plain.search(triggers)
  if (idx < 0) idx = 0
  const start = Math.max(0, idx - 30)
  return plain.slice(start, start + 380).replace(/\s+/g, ' ').trim()
}

/** Normalize roster / directory display names so `/faculty/` labels match `professors.json` `name`. */
function normProfessorLabel(raw) {
  return decodeBasicEntities(String(raw ?? ''))
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[.\u2019']/g, ' ')
    .replace(/[^\p{L}\p{N}\s()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Scrape `/faculty/` grid headings (`<h4>…`) so display names resolve to canonical profile slugs. */
async function loadFacultySlugByProfessorNameLabel() {
  const html = await fetchHtml(`${BASE}/faculty/`)
  /** @type {Record<string,string>} */
  const map = Object.create(null)
  const escBase = BASE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`<a href="${escBase}/people/([^/]+)/">([^<]+)</a></h4>`, 'gi')
  let m
  while ((m = re.exec(html)) !== null) {
    const slug = m[1]
    const key = normProfessorLabel(m[2])
    if (key) map[key] = slug
  }
  return map
}

const UCSD_OR_HDSI =
  /UC\s*San\s*Diego|UCSD|University of California,?\s+San\s+Diego|HDSI|Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu\s+Data\s+Science/i

/** HDSI directory / Halicioğlu / ASCII-spelling anchors in bios. */
const HDSI_HAL_ANCHOR = new RegExp(
  String.raw`\b(?:HDSI\b|Halicioglu[^\n]{0,55}?Data\s+Science|Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu[^\n]{0,55}?(?:Data\s+Science|Institute|DSI\b))`,
  'i',
)

/**
 * Assistant / Associate ladder bios often omit hire year but list doctorate “… in YEAR”.
 * Prefer latest Ph.D. completion as a pragmatic proxy for UC San Diego tenure-track start (~first assistant year).
 *
 * Associate path is **more fragile** — excluded when the “before/prior to joining UCSD” preamble looks like a
 * lateral professorship elsewhere (Berkeley/campus peers…) or emphasizes postdoctoral training.
 *
 * @returns {{ year: number, score: number, pattern: string } | null}
 */
function guessLadderProfPhdApproxAtUcsd(plain) {
  if (!plain || plain.length < 80) return null
  const head = plain.slice(0, Math.min(1400, plain.length))
  const early = plain.slice(0, Math.min(1600, plain.length))

  if (/\bAssociate\s+Director\b/i.test(head)) return null
  if (/\bis a professor\b/i.test(head)) return null

  /** @type {'assistant' | 'associate' | null} */
  let rank = null
  if (/\bAssociate\s+(?:Teaching\s+)?Professor\b/i.test(head)) rank = 'associate'
  else if (/\bAssistant\s+(?:Teaching\s+)?Professor\b/i.test(head)) rank = 'assistant'
  else return null

  if (/\bprior\s+to\s+(?:his|her|their)\s+appointment\s+at\b/i.test(head) && rank === 'assistant')
    return null

  /** UCSD transfer window: preamble before lateral hire cues at another major appointment. */
  const xferStarts = []
  let x
  if ((x = early.search(/\bBefore\s+joining\s+(?:UC\s*San\s*Diego|UCSD)\b/i)) >= 0) xferStarts.push(x)
  if ((x = early.search(/\bPrior\s+to\s+joining\s+(?:UC\s*San\s*Diego|UCSD)\b/i)) >= 0) xferStarts.push(x)

  const peerUni =
    /\b(?:UC\s*)?Berkeley\b|Ohio\s+State|Georgia\s+Tech|Cornell\b|Stanford\b|MIT\b|Carnegie\s+Mellon|Michigan\b|Columbia\b|UCLA\b|Harvard\b|UW-Madison|Wisconsin-Madison|Massachusetts\b.*\bAmherst|Penn\b|Princeton\b|Yale\b/i

  for (const xferIdx of xferStarts) {
    const seg = early.slice(xferIdx, xferIdx + Math.min(800, early.length - xferIdx))
    if (/\b(?:postdoctoral|Post-?Doc|research\s+fellow)\b/i.test(seg)) return null

    const lateralBerkeley =
      /\b(?:Associate\s+[Pp]rofessor|Assistant\s+[Pp]rofessor|Professor)\s+(?:of|at)\s+[^\n]{0,240}?/i.test(
        seg,
      ) &&
      /\b(?:at|of)\s+[^\n]{0,260}?\b(?:University\b[^\n]{0,120}?)?(?:UC\s*)?Berkeley\b/i.test(seg)

    const lateralPeers =
      /\b(?:Associate\s+[Pp]rofessor|Assistant\s+[Pp]rofessor|Professor)\s+(?:of|at)\s+[^\n]{0,220}?/i.test(
        seg,
      ) && peerUni.test(seg)

    if (lateralBerkeley || lateralPeers) return null
  }

  if (
    !/\b(?:UC\s*San\s*Diego|UCSD)\b/i.test(head) ||
    !HDSI_HAL_ANCHOR.test(head)
  )
    return null

  /** @type {number[]} */
  const phdYears = []
  const phdAnchors = plain.matchAll(/\b(?:Ph\.?\s*D\.?|Ph\s*D)\b/gi)
  for (const am of phdAnchors) {
    const ix = am.index ?? 0
    const chunk = plain.slice(ix, ix + Math.min(780, plain.length - ix))
    let yr = null
    const mf = chunk.match(/\bfrom\b[\s\S]{0,660}?\bin\s+(19\d{2}|20\d{2})\b/i)
    if (mf) yr = Number(mf[1])
    else {
      const ins = [...chunk.matchAll(/\bin\s+(19\d{2}|20\d{2})\b/gi)]
      if (ins.length === 0) continue
      const firstOff = ins[0].index ?? 0
      const beforeFirst = chunk.slice(0, firstOff)
      const looksLikeDegrees =
        /\bBachelor\b|\bMaster\b|M\.?\s*S\b|B\.?\s*E\b|B\.?\s*Sc\b|\bB\.?\s*S\b/i.test(beforeFirst)
      yr = Number((looksLikeDegrees ? ins[ins.length - 1] : ins[0])[1])
    }
    if (Number.isInteger(yr) && yr >= MIN_YEAR && yr <= MAX_YEAR) phdYears.push(yr)
  }

  if (phdYears.length === 0) return null
  const y = Math.max(...phdYears)
  if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) return null

  const patt =
    rank === 'associate' ? 'associate_hdsi_ucsd_latest_phd_in_year_approx' : 'assistant_hdsi_ucsd_latest_phd_in_year_approx'
  return { year: y, score: rank === 'associate' ? 70 : 71, pattern: patt }
}

/**
 * Last resort when fixed regexes miss: year near UC/HDSI plus tenure/join language.
 * @returns {{ year: number, score: number, pattern: string } | null}
 */
function guessYearKeywordHeuristic(plain) {
  let best = null
  const yearRe = /\b(19[89]\d|20\d{2})\b/g
  let m
  while ((m = yearRe.exec(plain)) !== null) {
    const y = Number(m[1])
    if (y < MIN_YEAR || y > MAX_YEAR) continue
    const i = m.index
    const ctx = plain.slice(Math.max(0, i - 130), Math.min(plain.length, i + 130))
    if (!UCSD_OR_HDSI.test(ctx)) continue

    const clauseStart = plain.lastIndexOf('.', Math.max(0, i - 95))
    const clauseHead = plain.slice(Math.max(0, clauseStart), i)
    if (/\b(?:Ph\.?D\.?|PhD)\b/i.test(clauseHead) && /(?:from|degree|dissertation|thesis)/i.test(clauseHead))
      continue

    let score = 0
    if (/\bjoined\b/i.test(ctx)) score += 48
    if (/\bfaculty\b/i.test(ctx)) score += 22
    if (/\bfaculty\s+in\b|\bfaculty\s+at\b|\bjoined\s+HDSI\b/i.test(ctx)) score += 20
    if (/\bappointed\b|\bappointment\b|\bwas\s+hired\b/i.test(ctx)) score += 28
    if (/\bPrior\s+to\s+joining\b|\bbefore\s+joining\b/i.test(ctx)) score += 24
    if (/\bcame\s+to\b|\barrived\b/i.test(ctx)) score += 18
    const wideAround = plain.slice(Math.max(0, i - 240), Math.min(plain.length, i + 200))
    if (
      /\bjoin(?:ed|ing)?\b/i.test(ctx) &&
      /\bfaculty\b/i.test(wideAround) &&
      /\b(?:UC\s*San\s*Diego|UCSD)\b/i.test(wideAround) &&
      HDSI_HAL_ANCHOR.test(wideAround)
    )
      score += 42

    if (/\bIEEE\b|\bACM\b|\bdoi:\b|\bISBN\b|\bvol\.\s*\d/i.test(ctx) && score < 75) score -= 50
    if (score < 82) continue

    if (!best || score > best.score || (score === best.score && y < best.year)) {
      best = { year: y, score, pattern: `heuristic_keywords_${score}` }
    }
  }
  return best
}

/** @returns {{ year: number, score: number, pattern: string } | null} */
function guessYearFromPatterns(plain) {
  let best = null
  for (const [re, score] of PATTERNS) {
    const m = plain.match(re)
    if (!m) continue
    const y = Number(m[1])
    if (!Number.isInteger(y) || y < MIN_YEAR || y > MAX_YEAR) continue
    if (!best || score > best.score || (score === best.score && y < best.year)) {
      best = { year: y, score, pattern: re.source.slice(0, 80) }
    }
  }
  return best
}

const WIKI_UCSD_ANCHOR =
  /UC\s*San\s*Diego|UCSD|University of California,?\s+San\s+Diego|HDSI|Hal[ıIiİi]c[ıIiİi]o[ğgĞG]lu|Halicioglu|San\s+Diego\s+Supercomputer|\bSDSC\b/i

function wikiTitleFromName(name) {
  return decodeBasicEntities(String(name ?? ''))
    .replace(/\([^)]*\)/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('_')
}

/**
 * @returns {{ year: number, score: number, pattern: string } | null}
 */
function guessYearFromPlainText(plain, { allowPhdProxy = false } = {}) {
  const fromPatterns = guessYearFromPatterns(plain)
  if (fromPatterns) return fromPatterns
  if (allowPhdProxy) {
    const fromPhd = guessLadderProfPhdApproxAtUcsd(plain)
    if (fromPhd) return fromPhd
  }
  return guessYearKeywordHeuristic(plain)
}

async function fetchWikipediaExtractByTitle(title) {
  const api =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&explaintext=1&titles=` +
    encodeURIComponent(title)
  const res = await fetch(api, { headers: { 'User-Agent': UA } })
  if (!res.ok) return null
  const text = await res.text()
  if (text.includes('too many requests')) return null
  const data = JSON.parse(text)
  const page = Object.values(data?.query?.pages ?? {})[0]
  if (!page || page.missing != null) return null
  const extract = String(page.extract ?? '')
  if (!extract || !WIKI_UCSD_ANCHOR.test(extract)) return null
  return { extract, title: String(page.title ?? title) }
}

async function resolveWikipediaTitle(professor) {
  const direct = wikiTitleFromName(professor.name)
  if (!direct || direct.length < 3) return null
  const hit = await fetchWikipediaExtractByTitle(direct)
  if (hit) return hit

  const searchQ = `${professor.name} UC San Diego`
  const searchUrl =
    `https://en.wikipedia.org/w/api.php?action=opensearch&format=json&search=` +
    encodeURIComponent(searchQ) +
    '&limit=3'
  try {
    const res = await fetch(searchUrl, { headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const [, titles] = await res.json()
    if (!Array.isArray(titles)) return null
    for (const t of titles) {
      if (!t || typeof t !== 'string') continue
      const h = await fetchWikipediaExtractByTitle(t.replace(/ /g, '_'))
      if (h) return h
      await sleep(120)
    }
  } catch {
    return null
  }
  return null
}

async function tryWikipediaStartYear(professor) {
  try {
    const hit = await resolveWikipediaTitle(professor)
    if (!hit) return null
    const guessed = guessYearFromPlainText(hit.extract, { allowPhdProxy: false })
    if (!guessed) return null
    return { year: guessed.year, pattern: `wikipedia_${guessed.pattern}`, wikiTitle: hit.title }
  } catch {
    return null
  }
}

/** First `profiles.ucsd.edu/foo.bar` linked from HDSI HTML (prefer real profile links). */
function extractProfilesSlugFromPeopleHtml(html) {
  if (!html) return null
  const re =
    /https?:\/\/(?:www\.)?profiles\.(?:ucsd\.edu|researcherprofiles\.org)\/(?:profile\/)?([a-z0-9.-]+)/gi
  const badChunk =
    /search|privacy|cookies|grantome|Adobe|Aspx|\bCSS\b|\bPNG\b|\bGIF\b|^profile$/i
  /** @type {string | null} */
  let picked = null
  let m
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].split(/[#?/]/)[0].replace(/\/*$/, '')
    if (!slug.includes('.') || slug.length < 3 || badChunk.test(slug)) continue
    picked = slug
  }
  return picked
}

/** Build `firstname.lastname` etc. Slugs always contain a `.` on UCSD Profiles. */
function profileSlugCandidatesFromName(name) {
  if (!name || typeof name !== 'string') return []
  const noParen = decodeBasicEntities(name).replace(/\([^)]*\)/g, ' ')
  const tokens = normProfessorLabel(noParen)
    .split(/\s+/)
    .filter((t) => t.length > 0)
  /** @type {string[]} */
  const out = []
  if (tokens.length >= 2) {
    out.push(`${tokens[0]}.${tokens[tokens.length - 1]}`)
  }
  if (tokens.length >= 3 && /^[a-z]$/i.test(tokens[0]) && tokens[1].length > 1) {
    out.push(`${tokens[1]}.${tokens[tokens.length - 1]}`)
  }
  return [...new Set(out)]
}

function profileSlugCandidates(p, embeddedSlug, overrides) {
  /** @type {string[]} */
  const out = []

  const ovrRaw = overrides[p.id]
  if (typeof ovrRaw === 'string') {
    const t = ovrRaw
      .trim()
      .replace(/^https?:\/\/profiles\.(?:ucsd\.edu|researcherprofiles\.org)\//i, '')
      .replace(/^\/+/, '')
    const cut = t.split(/[/#?]/)[0]
    if (cut.includes('.')) out.push(cut)
  }

  if (embeddedSlug && embeddedSlug.includes('.')) out.push(embeddedSlug)
  out.push(...profileSlugCandidatesFromName(p.name))
  const dotId = String(p.id).replace(/-/g, '.')
  if (dotId.includes('.')) out.push(dotId)

  const segs = String(p.id).split('-').filter(Boolean)
  if (segs.length >= 2) out.push(`${segs[segs.length - 2]}.${segs[segs.length - 1]}`)

  const seen = new Set()
  /** @type {string[]} */
  const uniq = []
  for (const s of out) {
    if (!s || !s.includes('.') || seen.has(s)) continue
    seen.add(s)
    uniq.push(s)
  }
  return uniq.slice(0, 6)
}

/**
 * UC San Diego appointment line that also mentions HDSI / Halıcıoğlu (Profiles overview / RDF HTML).
 */
function guessYearFromUcsdProfilesHtml(html) {
  if (!html) return null
  const plain = htmlToPlain(html)
  /** @type {number[]} */
  const yrs = []

  const reSnippet =
    /\bUC\s+San\s+Diego\s+(19\d{2}|20\d{2})\b\s*-\s*[\s\S]{2,1600}?(?:Fellow\s*:\s*Hal[ıIiİ]?c[^\n.;]{4,340}?\bData\s+Science\s+Institute|Hal[ıIiİ]?c[^\n.;]{6,340}?\bData\s+Science\s+Institute|Halicioglu\s+Data\s+Science\s+Institute|\bHDSI\b(?:\s|[.,;!?]|$))/gi

  let m
  while ((m = reSnippet.exec(plain)) !== null) yrs.push(Number(m[1]))

  for (const line of html.split(/\r?\n/)) {
    if (!/\|\s*UC\s+San\s+Diego\s*\|/i.test(line)) continue
    if (
      !/(?:Hal[ıIiİ]?c[^\n]{0,60}?(?:Data\s+Science\s+Institute|oglu))|HDSI|Data\s+Science\s+Institute/i.test(line)
    ) {
      continue
    }
    const pipeYear = line.match(/\b(19\d{2}|20\d{2})\b/)
    if (pipeYear) yrs.push(Number(pipeYear[1]))
  }

  let best = null
  for (const y of yrs) {
    if (!Number.isFinite(y) || y < MIN_YEAR || y > MAX_YEAR) continue
    if (best === null || y < best) best = y
  }
  return best
}

async function tryProfilesStartYear(professor, peoplePageHtml, profileOverrides, maxAttempts = 5) {
  const embedded = peoplePageHtml ? extractProfilesSlugFromPeopleHtml(peoplePageHtml) : null
  const candidates = profileSlugCandidates(professor, embedded, profileOverrides)
  let n = 0
  for (const slug of candidates) {
    if (n >= maxAttempts) break
    n++
    try {
      const url = `${PROFILES_BASE}/${encodeURIComponent(slug)}`
      const phtml = await fetchHtml(url)
      const yr = guessYearFromUcsdProfilesHtml(phtml)
      await sleep(PROFILES_GAP_MS)
      if (yr != null) return { year: yr, profilesSlug: slug }
    } catch {
      await sleep(PROFILES_GAP_MS >> 1)
    }
  }
  return null
}

function applyToProfessors(yearById) {
  const list = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
  let n = 0
  for (const p of list) {
    if (p.active === false) continue
    const y = yearById[p.id]
    if (y == null) continue
    p.ucsdStartYear = y
    n++
  }
  fs.writeFileSync(PROF_PATH, JSON.stringify(list, null, 2) + '\n')
  console.log(`draft-site: wrote ucsdStartYear on ${n} professor row(s)`)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))
  const limitN = limitArg != null ? Number(limitArg.slice('--limit='.length)) : NaN
  const limit = Number.isFinite(limitN) && limitN > 0 ? limitN : null

  const slugOverrides = loadSlugOverrides()
  const profilesSlugOverrides = loadProfilesSlugOverrides()
  const skipProfiles = process.env.PROFDLE_SKIP_PROFILES === '1'
  const allowPhdProxy = process.env.PROFDLE_ALLOW_PHD_PROXY === '1'
  const skipWiki = process.env.PROFDLE_SKIP_WIKIPEDIA === '1'
  const skipCv = process.env.PROFDLE_SKIP_CV === '1'
  if (skipProfiles) {
    console.warn('draft-site: PROFDLE_SKIP_PROFILES=1 — skipping profiles.ucsd.edu fallback')
  }
  if (skipCv) {
    console.warn('draft-site: PROFDLE_SKIP_CV=1 — skipping personal-site / CV fallback')
  }
  if (allowPhdProxy) {
    console.warn('draft-site: PROFDLE_ALLOW_PHD_PROXY=1 — Ph.D.-year proxy enabled (less accurate)')
  }
  if (skipWiki) {
    console.warn('draft-site: PROFDLE_SKIP_WIKIPEDIA=1 — skipping Wikipedia fallback')
  }

  let facultySlugByName = /** @type {Record<string,string>} */ ({})
  try {
    facultySlugByName = await loadFacultySlugByProfessorNameLabel()
    console.log(`draft-site: loaded ${Object.keys(facultySlugByName).length} name→slug pairs from ${BASE}/faculty/`)
    await sleep(DELAY_MS)
  } catch (e) {
    console.warn(`draft-site: could not scrape /faculty/ for slug map (${String(e?.message ?? e)})`)
  }

  const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
  const active = professors.filter((p) => p.active !== false)
  const toProcess = limit != null && Number.isFinite(limit) ? active.slice(0, limit) : active

  const matched = {}
  const unmatched = {}

  let i = 0
  for (const p of toProcess) {
    i++
    const fromDirectory =
      typeof p.name === 'string'
        ? facultySlugByName[normProfessorLabel(p.name)]
        : undefined
    const slug = slugOverrides[p.id] ?? fromDirectory ?? p.id
    const url = `${BASE}/people/${encodeURIComponent(slug)}/`
    process.stdout.write(`\r[${i}/${toProcess.length}] ${p.id}… `)

    /** @type {string | null} */
    let peopleHtml = null
    /** @type {string | undefined} */
    let pageErrMsg
    try {
      peopleHtml = await fetchHtml(url)
    } catch (err) {
      pageErrMsg = String(err?.message ?? err)
    }

    /** @type {number | null} */
    let yearOut = null

    if (peopleHtml != null && peopleHtml.length > 0) {
      const bioHtml = extractPersonBioHtml(peopleHtml)
      const plainBio = bioHtml ? htmlToPlain(bioHtml) : ''
      let plain = plainBio.length > 0 ? plainBio : htmlToPlain(peopleHtml)
      let guessed = guessYearFromPlainText(plain, { allowPhdProxy })
      if (!guessed && bioHtml && plainBio.length > 0) {
        plain = htmlToPlain(peopleHtml)
        guessed = guessYearFromPlainText(plain, { allowPhdProxy })
      }
      if (guessed) yearOut = guessed.year
    }

    if (yearOut == null && !skipCv && peopleHtml != null && peopleHtml.length > 0) {
      const cvHit = await tryPersonalSiteCvStartYear(peopleHtml)
      if (cvHit) yearOut = cvHit.year
      await sleep(CV_GAP_MS)
    }

    if (yearOut == null && !skipProfiles) {
      const prHit = await tryProfilesStartYear(p, peopleHtml, profilesSlugOverrides)
      if (prHit) yearOut = prHit.year
      await sleep(PROFILES_GAP_MS >> 1)
    }

    if (yearOut == null && !skipWiki) {
      const wikiHit = await tryWikipediaStartYear(p)
      if (wikiHit) yearOut = wikiHit.year
      await sleep(WIKI_GAP_MS)
    }

    if (yearOut != null) {
      matched[p.id] = yearOut
    } else {
      /** @type {string} */
      let excerptPlain = ''
      let bioExtracted = false
      if (peopleHtml != null && peopleHtml.length > 0) {
        const bh = extractPersonBioHtml(peopleHtml)
        const pb = bh ? htmlToPlain(bh) : ''
        excerptPlain = pb.length > 0 ? pb : excerptForReview(htmlToPlain(peopleHtml))
        bioExtracted = Boolean(bh)
      }
      unmatched[p.id] = pageErrMsg
        ? { url, reason: 'fetch_or_http_error', error: pageErrMsg }
        : {
            url,
            excerpt: excerptForReview(excerptPlain),
            bioExtracted,
            reason: skipProfiles
              ? 'no_match_profiles_skipped'
              : skipCv
                ? 'no_hdsi_match_cv_skipped'
                : 'no_hdsi_cv_profiles_or_wiki_match',
          }
    }
    await sleep(DELAY_MS)
  }
  console.log('')

  fs.mkdirSync(HDSI_DATA, { recursive: true })
  fs.writeFileSync(OUT_MATCH, `${JSON.stringify(matched, null, 2)}\n`)
  fs.writeFileSync(OUT_FAIL, `${JSON.stringify(unmatched, null, 2)}\n`)
  console.log(`draft-site: wrote ${OUT_MATCH} (${Object.keys(matched).length} ids)`)
  console.log(`draft-site: wrote ${OUT_FAIL} (${Object.keys(unmatched).length} ids to review)`)

  if (apply) {
    applyToProfessors(matched)
    console.log('draft-site: run `npm run years:populate` to sync derived JSON + provenance')
  } else {
    console.log('draft-site: dry-run only. Review JSON, fix slug overrides / manual JSON, then:')
    console.log('  node scripts/draft-dsc-start-years-from-site.mjs --apply')
    console.log('  npm run years:populate')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
