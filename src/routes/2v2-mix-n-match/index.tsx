import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/2v2-mix-n-match/')({
  head: () => ({
    meta: [{ title: "2v2 Mix n' Match Mini Cup | JustPlay" }],
  }),
  component: TwoVsTwoMixNMatchHomePage,
})

function TwoVsTwoMixNMatchHomePage() {
  return (
    <section className="container py-4">
      <header className="mb-4">
        <h1 className="h2 mb-1">2v2 Mix n' Match Mini Cup</h1>
        <p className="text-body-secondary mb-0">
          Quick 2v2 cup where you register as an individual, mix with other players, get ranked,
          and then the first 8 players are split in couples to play the final brackets.
        </p>
      </header>

      <div className="d-flex flex-wrap gap-2 mb-4">
        <Link className="btn btn-banana" to="/2v2-mix-n-match/players">
          Go To Players
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/games">
          Go To Games
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/upper-pool">
          Upper Pool
        </Link>
        <Link className="btn btn-outline-secondary" to="/2v2-mix-n-match/lower-pool">
          Lower Pool
        </Link>
      </div>

      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h2 className="h5 mb-3">Rules</h2>
          <ul className="mb-0">
            <li>Individual registration.</li>
            <li>
              Standard 2v2 beach rules:
              <ul>
                <li>Volleying on the other side of the net only with squared shoulders.</li>
                <li>
                  No tipping! Hit, back of the hand, power knuckles or CLAW (MEOWWW!)
                </li>
                <li>Block counts as 1 touch. Blocker can play the ball after the block.</li>
              </ul>
            </li>
            <li>No gender rules, mixed net height.</li>
            <li>Mix with other players for games to 21, win by 2, with a hard cap at 25.</li>
            <li>Play as much as you can in the ranking phase to increase your ranking.</li>
            <li>
              At the end of the ranking phase, the first 8 players in the ranking play semifinals
              and finals.
            </li>
            <li>Everyone starts with 500 points.</li>
          </ul>
        </div>
      </div>

      <div className="card shadow-sm">
        <div className="card-body">
          <h2 className="h5 mb-3">Scoring Rules</h2>
          <p className="mb-3">Each game updates rankings and player stats automatically.</p>

          <ul className="mb-0">
            <li>Point difference is calculated as the absolute score gap.</li>
            <li>
              Ranking swing per player is based on score difference:
              <ul>
                <li>Difference 0-2: 1 point</li>
                <li>Difference 3-7: 2 points</li>
                <li>Difference 8-12: 3 points</li>
                <li>Difference 13+: 4 points</li>
              </ul>
            </li>
            <li>Winning team players each gain the swing amount.</li>
            <li>Losing team players each lose the swing amount.</li>
            <li>
              Each player also updates:
              <ul>
                <li>PF (points for): points scored by that player's team</li>
                <li>PA (points against): points conceded by that player's team</li>
                <li>Coefficient: PF / PA (rounded to 4 decimals)</li>
              </ul>
            </li>
            <li>No tie games are allowed.</li>
          </ul>
        </div>
      </div>
    </section>
  )
}
