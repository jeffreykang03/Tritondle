#!/usr/bin/env node
/**
 * Writes curated `researchAreas` (official HDSI research hubs) and `appointments`
 * (faculty directory filters). Removes legacy `focus`.
 * Skips `"active": false` rows so archived faculty are left unchanged.
 *
 * Run: npm run research:patch
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APPOINTMENT_SLUGS,
  RESEARCH_THEME_SLUGS,
} from '../src/constants/hdsiCatalog.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROF_PATH = path.join(__dirname, '..', 'src', 'data', 'professors.json')

const themeSet = new Set(RESEARCH_THEME_SLUGS)
const appointmentSet = new Set(APPOINTMENT_SLUGS)

/** @type {Record<string, string[]>} */
const RESEARCH_BY_ID = {
  'ilkay-altintas': ['data-science-for-scientific-discovery', 'data-infrastructure-and-systems'],
  'tiffany-amariuta': ['biomedical-data-science', 'statistics'],
  'mikio-aoi': ['biomedical-data-science', 'artificial-intelligence-and-machine-learning', 'theoretical-foundations-of-data-science'],
  'ery-arias-castro': ['statistics', 'theoretical-foundations-of-data-science'],
  'vineet-bafna': ['biomedical-data-science'],
  'mikhail-belkin': ['artificial-intelligence-and-machine-learning', 'theoretical-foundations-of-data-science'],
  'jelena-bradic': ['statistics', 'theoretical-foundations-of-data-science'],
  'alex-cloninger': ['theoretical-foundations-of-data-science', 'artificial-intelligence-and-machine-learning'],
  'virginia-de-sa': ['artificial-intelligence-and-machine-learning', 'biomedical-data-science'],
  'justin-eldridge': ['theoretical-foundations-of-data-science', 'statistics'],
  'shannon-ellis': ['statistics', 'data-science-for-scientific-discovery', 'data-and-society'],
  'yoav-freund': ['theoretical-foundations-of-data-science', 'artificial-intelligence-and-machine-learning'],
  'r-stuart-geiger': ['data-and-society'],
  'rajesh-gupta': ['data-infrastructure-and-systems'],
  'julian-mcauley': ['artificial-intelligence-and-machine-learning'],
  'gal-mishne': ['theoretical-foundations-of-data-science', 'artificial-intelligence-and-machine-learning'],
  'dimitris-politis': ['statistics', 'theoretical-foundations-of-data-science'],
  'babak-salimi': ['artificial-intelligence-and-machine-learning', 'data-infrastructure-and-systems', 'data-and-society'],
  'jingbo-shang': ['artificial-intelligence-and-machine-learning'],
  'berk-ustun': ['artificial-intelligence-and-machine-learning', 'data-and-society'],
  'yusu-wang': ['theoretical-foundations-of-data-science', 'biomedical-data-science'],
  'lily-weng': ['artificial-intelligence-and-machine-learning'],
  'rose-yu': ['artificial-intelligence-and-machine-learning', 'data-science-for-scientific-discovery'],
  'arun-kumar': ['data-infrastructure-and-systems', 'artificial-intelligence-and-machine-learning'],
  'barna-saha': ['theoretical-foundations-of-data-science'],
  'bradley-voytek': ['biomedical-data-science', 'artificial-intelligence-and-machine-learning'],
  'sam-lau': ['artificial-intelligence-and-machine-learning', 'data-and-society'],
  'soohyun-nam-liao': ['data-and-society'],
  'marina-langlois': ['theoretical-foundations-of-data-science', 'statistics'],
  'terry-sejnowski': ['biomedical-data-science', 'artificial-intelligence-and-machine-learning'],
  'young-han-kim': ['theoretical-foundations-of-data-science', 'statistics'],
  'hao-zhang': ['data-infrastructure-and-systems', 'artificial-intelligence-and-machine-learning'],
  'alex-warstadt': ['artificial-intelligence-and-machine-learning'],
  'zhiting-hu': ['artificial-intelligence-and-machine-learning', 'theoretical-foundations-of-data-science'],
  'yian-ma': ['statistics', 'artificial-intelligence-and-machine-learning', 'theoretical-foundations-of-data-science'],
  'arya-mazumdar': ['theoretical-foundations-of-data-science', 'statistics'],
  'rayan-saab': ['theoretical-foundations-of-data-science', 'statistics'],
  'frank-wuerthwein': ['data-infrastructure-and-systems', 'data-science-for-scientific-discovery'],
  'rob-knight': ['biomedical-data-science'],
  'haojian-jin': ['data-infrastructure-and-systems', 'data-and-society'],
  'ronghui-lily-xu': ['biomedical-data-science', 'statistics'],
  'george-sugihara': ['data-science-for-scientific-discovery', 'statistics'],
  'michael-holst': ['theoretical-foundations-of-data-science', 'data-science-for-scientific-discovery'],
  'biwei-huang': ['artificial-intelligence-and-machine-learning', 'theoretical-foundations-of-data-science'],
  'duncan-watson-parris': ['data-science-for-scientific-discovery', 'artificial-intelligence-and-machine-learning'],
  'tauhidur-rahman': ['data-and-society', 'data-science-for-scientific-discovery'],
  'benjamin-smarr': ['biomedical-data-science', 'data-science-for-scientific-discovery'],
  'albert-hsiao': ['biomedical-data-science', 'artificial-intelligence-and-machine-learning'],
  'tara-javidi': ['theoretical-foundations-of-data-science', 'artificial-intelligence-and-machine-learning'],
  'armin-schwartzman': ['statistics', 'biomedical-data-science'],
  'shankar-subramaniam': ['biomedical-data-science'],
  'peter-chi': ['biomedical-data-science', 'statistics'],
  'janine-tiefenbruck': ['data-and-society', 'statistics'],
  'kyle-shannon': ['theoretical-foundations-of-data-science', 'data-infrastructure-and-systems'],
}

/** Scraped from datascience.ucsd.edu/faculty/ grid (`vc_grid-term-*`), plus manual overrides. */
const APPOINTMENT_BY_ID = {
  'ilkay-altintas': ['tenure-track'],
  'tiffany-amariuta': ['tenure-track'],
  'mikio-aoi': ['tenure-track'],
  'ery-arias-castro': ['tenure-track'],
  'vineet-bafna': ['associate-faculty', 'endowed-chairs'],
  'mikhail-belkin': ['endowed-chairs', 'tenure-track'],
  'jelena-bradic': ['tenure-track'],
  'alex-cloninger': ['tenure-track'],
  'virginia-de-sa': ['endowed-chairs', 'tenure-track'],
  'justin-eldridge': ['teaching-faculty'],
  'shannon-ellis': ['teaching-faculty'],
  'yoav-freund': ['tenure-track'],
  'r-stuart-geiger': ['tenure-track'],
  'rajesh-gupta': ['tenure-track'],
  'julian-mcauley': ['associate-faculty'],
  'gal-mishne': ['tenure-track'],
  'dimitris-politis': ['endowed-chairs', 'tenure-track'],
  'babak-salimi': ['tenure-track'],
  'jingbo-shang': ['tenure-track'],
  'berk-ustun': ['tenure-track'],
  'yusu-wang': ['endowed-chairs', 'tenure-track'],
  'lily-weng': ['tenure-track'],
  'rose-yu': ['associate-faculty', 'tenure-track'],
  'arun-kumar': ['tenure-track'],
  'barna-saha': ['tenure-track'],
  'bradley-voytek': ['tenure-track'],
  'sam-lau': ['teaching-faculty'],
  'soohyun-nam-liao': ['teaching-faculty'],
  'marina-langlois': ['teaching-faculty'],
  'terry-sejnowski': ['associate-faculty'],
  'young-han-kim': ['associate-faculty'],
  'hao-zhang': ['tenure-track'],
  'alex-warstadt': ['tenure-track'],
  'zhiting-hu': ['tenure-track'],
  'yian-ma': ['tenure-track'],
  'arya-mazumdar': ['endowed-chairs', 'tenure-track'],
  'rayan-saab': ['tenure-track'],
  'frank-wuerthwein': ['tenure-track'],
  'rob-knight': ['tenure-track'],
  'haojian-jin': ['tenure-track'],
  'ronghui-lily-xu': ['tenure-track'],
  'george-sugihara': ['tenure-track'],
  'michael-holst': ['tenure-track'],
  'biwei-huang': ['tenure-track'],
  'duncan-watson-parris': ['tenure-track'],
  'tauhidur-rahman': ['tenure-track'],
  'benjamin-smarr': ['tenure-track'],
  'albert-hsiao': ['tenure-track'],
  'tara-javidi': ['tenure-track'],
  'armin-schwartzman': ['tenure-track'],
  'shankar-subramaniam': ['tenure-track'],
  'peter-chi': ['teaching-faculty'],
  'janine-tiefenbruck': ['teaching-faculty'],
  'kyle-shannon': ['teaching-faculty'],
}

function validateTags(tags, allowed, label, profId) {
  for (const t of tags) {
    if (!allowed.has(t)) {
      throw new Error(`${profId}: unknown ${label} tag "${t}"`)
    }
  }
}

const professors = JSON.parse(fs.readFileSync(PROF_PATH, 'utf8'))
let n = 0
for (const p of professors) {
  if (p.active === false) continue

  const research = RESEARCH_BY_ID[p.id]
  const appointments = APPOINTMENT_BY_ID[p.id]
  if (!research) console.warn(`Missing RESEARCH_BY_ID entry for ${p.id}`)
  if (!appointments?.length) console.warn(`Missing APPOINTMENT_BY_ID entry for ${p.id}`)

  if (research) {
    validateTags(research, themeSet, 'research hub', p.id)
    p.researchAreas = research
  }
  if (appointments?.length) {
    validateTags(appointments, appointmentSet, 'appointment', p.id)
    p.appointments = appointments
  }
  delete p.focus
  n++
}

fs.writeFileSync(PROF_PATH, JSON.stringify(professors, null, 2) + '\n')
console.log(`Updated ${n} professors (research hubs + directory appointments, dropped focus) → ${PROF_PATH}`)
