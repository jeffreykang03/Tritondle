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
            <th title="SunSET primary: green = same code; yellow = also listed in answer's other courses, or same department with course numbers within 20 of each other; orange = same department but numbers differ by more than 20; red = different department or not parseable. Triangle (same dept only) points toward the answer's course in catalog order (number, then suffix).">
              Most taught
            </th>
            <th title="DSC from SunSET (except most-taught) plus optional roster tags like COGS; orange = 1 overlapping tag, yellow = 2+">
              Other courses
            </th>
            <th title="Whole calendar years as DSC-listed faculty at UC San Diego — many arrived through home departments before the institute’s public launch (~2018), so totals are not capped at “years since HDSI existed.” Roster-maintained (green = exact; yellow = within 2 vs answer). Triangle points toward the answer when wrong.">
              DSC tenure
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
