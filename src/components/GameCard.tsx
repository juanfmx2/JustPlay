// import { Game } from '../schema/game'


// function GameCard({game}: {game: Game}) {
//     return (
//         <article key={game.id} className="spring-league-game-card">
//         <header className="spring-league-game-header">
//             <span className="fw-semibold">{game.start} - {game.end}</span>
//             <span className="small text-body-secondary">{game.id.toUpperCase()}</span>
//         </header>

//         <div className="spring-league-game-row">
//             <span className="small text-body-secondary">Team A</span>
//             <TeamBadge teamLabel={game.teamALabel} team={game.teamA} />
//         </div>

//         <div className="spring-league-game-row">
//             <span className="small text-body-secondary">Team B</span>
//             <TeamBadge teamLabel={game.teamBLabel} team={game.teamB} />
//         </div>

//         <div className="spring-league-game-row">
//             <span className="small text-body-secondary">Ref</span>
//             <TeamBadge teamLabel={game.refLabel} team={game.ref} />
//         </div>

//         <div className="spring-league-score-grid">
//             <label className="spring-league-score-field">
//             <span className="small text-body-secondary">Score A</span>
//             <input
//                 aria-label={`${division.division_short} ${game.id} score for team A`}
//                 className="form-control form-control-sm spring-league-score-input"
//                 type="number"
//                 min={0}
//                 value={scores[scoreKey]?.teamA ?? ''}
//                 onChange={(event) => handleScoreChange(division.division_short, game.id, 'teamA', event.currentTarget.value)}
//             />
//             </label>

//             <label className="spring-league-score-field">
//             <span className="small text-body-secondary">Score B</span>
//             <input
//                 aria-label={`${division.division_short} ${game.id} score for team B`}
//                 className="form-control form-control-sm spring-league-score-input"
//                 type="number"
//                 min={0}
//                 value={scores[scoreKey]?.teamB ?? ''}
//                 onChange={(event) => handleScoreChange(division.division_short, game.id, 'teamB', event.currentTarget.value)}
//             />
//             </label>
//         </div>
//         </article>
//     )
// }

// export default SpringLeague