import { GuessRow } from './GuessRow.jsx'

export function GuessTable({ guesses, target, puzzleDayKey }) {
  return (
    <div className="table-wrap">
      <table className="guess-table">
        <thead>
          <tr>
            <th>Name</th>
            <th title="Same filter categories as datascience.ucsd.edu/faculty (Associates, Endowed Chairs, Teaching Faculty, Tenure-Track, Visiting). Orange = 1 shared tag, yellow = 2+">
              Faculty listing
            </th>
            <th title="Official theme areas from datascience.ucsd.edu/research (AI/ML, biomedical DS, infrastructure, scientific discovery, society, theory, statistics). Orange = 1 overlapping area vs answer, yellow = 2+">
              Research areas
            </th>
            <th title="SunSET primary: green = same code, or both rows have no primary listed (&quot;—&quot;); yellow = your primary also appears in answer&apos;s other courses, or same department with course numbers within 20 of each other; orange = same department but numbers differ by more than 20; red = different department or not parseable. Triangle (same dept only) points toward the answer&apos;s course in catalog order (number, then suffix).">
              Most taught
            </th>
            <th title="DSC codes from SunSET (except most-taught) plus roster extras like COGS; orange = 1 overlapping real code vs answer, yellow = 2+. Level bands lower/upper/grad are hidden in the table (&quot;—&quot;); rows with only bands or truly empty overlap count as matched with each other.">
              Other courses
            </th>
            <th title="HDSI tenure: whole calendar years at UC San Diego from the roster start year (puzzle calendar year minus start year, floored at 0). Based on scraped public bios / Profiles plus manual tweaks — approximate, not HR tenure. Green = exact; yellow = within 2 vs answer. Triangle points toward the answer when wrong.">
              HDSI tenure
            </th>
          </tr>
        </thead>
        <tbody>
          {[...guesses].reverse().map((g) => (
            <GuessRow key={g.id} guess={g} target={target} puzzleDayKey={puzzleDayKey} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
