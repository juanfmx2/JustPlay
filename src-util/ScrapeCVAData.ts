import { chromium, Browser, Page } from 'playwright';

type VolleyballScore = {// e.g., ["25-20", "22-25", "25-23"]
}

type Match = {
    teamA: Team;
    teamB: Team;
    date: string;
    score: VolleyballScore;
    winner: Team;
    loser: Team;
    forfeit: boolean;
    teamASetsWon: number;
    teamBSetsWon: number;
    teamAPoints: number;
    teamBPoints: number;
    setScores: string[]; 
    toJSON: () => string;
}

type Team = {
    teamName: string;
    points: number;
    matchesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    forfeits: number;
    playedMatches: Match[];
    scheduledMatches: Match[];
    toJSON: () => any;
}   

type ScrapeParameters = {
    urlPath: String;
    parsingFunction: (html: string) => {}; // Define a type for the parsing function
}

function parseCVAData(html: string) {
    return {};
}

const pagesToScrape = {
    men: {
        urlPath: 'RCVALeagueM.php',
        parsingFunction: parseCVAData
    },
    women: {
        urlPath: 'RCVALeagueW.php',
        parsingFunction: parseCVAData   
    },
    local: {
        urlPath: 'RCVALeagueB.php',
        parsingFunction: parseCVAData
    }
}

const teams: Team[] = [];

function getTeamByName(name: string): Team {
    let team = teams.find(t => t.teamName === name);
    if (!team) {
        team = { teamName: name, points: 0, matchesPlayed: 0, wins: 0, losses: 0, draws: 0, forfeits: 0, playedMatches: [], scheduledMatches: [], toJSON: () => name };
        team.toJSON = function () { return this; }
        team.toJSON = team.toJSON.bind(team);
        team.toString = function () { return this.teamName; }
        team.toString = team.toString.bind(team);
        teams.push(team);
    }
    return team;
}

function parseMatchRow(cells: string[]): Match|null {
    const [date, teamAName, sets, teamBName, scoreStr] = cells;
    const [teamASetsWon, teamBSetsWon] = sets.split('-').map(Number);
    if (!isNaN(teamASetsWon) && !isNaN(teamBSetsWon)) {
        const forfeit = scoreStr.includes('F') || scoreStr.includes('f');
        const teamA  = getTeamByName(teamAName);
        const teamB = getTeamByName(teamBName);
        let pointsA = 0;
        let pointsB = 0;
        scoreStr.split(' ')[0].split(',').forEach(setScore => {
            const scoreStr = setScore.split('-');
            pointsA += Number(scoreStr[0]);
            pointsB += Number(scoreStr[1]);
        });
        const winner = teamASetsWon > teamBSetsWon ? teamA : teamB;
        const loser = teamASetsWon < teamBSetsWon ? teamA : teamB;
        const match: Match = {
            teamA: teamA,
            teamB: teamB,
            date: date,
            score: [scoreStr],
            winner: winner,
            loser: loser,
            forfeit: forfeit,
            teamASetsWon: teamASetsWon,
            teamBSetsWon: teamBSetsWon,
            teamAPoints: pointsA,
            teamBPoints: pointsB,
            setScores: scoreStr.split(' ')[0].split(','),
            toJSON: function () {
                const objCopy = {...this} as any;
                objCopy.teamA = this.teamA.toString();
                objCopy.teamB = this.teamB.toString();
                objCopy.winner = this.winner.toString();
                objCopy.loser = this.loser.toString();
                console.log(`Serializing match: ${objCopy.teamA} vs ${objCopy.teamB} on ${objCopy.date}\n\n\n\n\n\n`);
                return objCopy;
            }
        };
        match.toJSON = match.toJSON.bind(match);
        return match;
    }
    return null;
}

async function scrapeCVAPage(params: ScrapeParameters): Promise<Team[]> {
    const browser = await chromium.launch();

    const results: Team[] = [];


    const page = await browser.newPage();
    try {
        await page.goto(`https://www.cambsvolleyball.org.uk/${params.urlPath}`);
        const articleElem = await page.locator('div.article').first();
        const leagueTitle = await articleElem.locator('p').first().textContent();
        const year = leagueTitle?.match(/\d{4}/)?.[0] || 'Unknown Year';
        // const matchesArticle = await page.locator('div.article').first();
        console.log(`League Title: ${leagueTitle}`);
        console.log(`Year: ${year}`);
        for(const row of await articleElem.locator('div.gridnext').all()){
            const cells = await row.locator('div.gridnextitem').allInnerTexts();
            const match = parseMatchRow(cells);
            if(match){
                match.teamA.playedMatches.push(match);
                match.teamB.playedMatches.push(match);
                results.push(match.teamA);
                results.push(match.teamB);
            }
        }
        

    } finally {
        await browser.close();
    }

    return results;
}

scrapeCVAPage(pagesToScrape.men)
    .then(results => {
        console.log(`Men's League Results:`);
        console.log(JSON.stringify(results[0], null, 2));
        // results.forEach(result => {
        //     console.log(result);
        // });
    })
    .catch(console.error);
