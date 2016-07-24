let csv = require("fast-csv");
let gaussian = require("gaussian");
let argv = require("minimist")(process.argv.slice(2));

require("./electoral-college.js")(global);
require("./states.js")(global);
let predictor = require("./predict.js");
let util = require("./util.js");

let LOG;
let date;

function * main() {
    console.log("======= 2016 PRESIDENTIAL RACE PREDICTIONS =======");
    let iterations = +argv._[0] || 2e4;
    let addToHistory = !argv.dry;
    LOG = !!argv.v || !!argv.verbose;
    let nowCast = !!argv.now
    date = argv.date ? new Date(argv.date + " 00:00") : new Date();
    if (nowCast) date = new Date("11/8/2016 00:00");

    yield* predictor.init(LOG, nowCast, date);

    let history = yield loadHistory();

    console.log(`Model initialized. Simulating ${iterations} elections...`);

    let data = predict(iterations, history);

    console.log(`Simulations finished.`);

    output(data, addToHistory);

    console.log("==================================================");
    console.log();
}

function predict(iterations, history) {
    let shiftDist = gaussian(0, 1);

    // simulate a bunch of elections
    let outcomes = new Array(538 + 1).fill(0);
    let demWins = 0;
    let demPopWins = 0;
    let recounts = 0;
    let demWinPopLoseEC = 0;
    let gopWinPopLoseEC = 0;
    let demLandslide = 0;
    let gopLandslide = 0;
    let stateData = abbrs.map(a => ({state: a, probability: 0}) ); // probability of winning each state

    for (let i = 0; i < iterations; i++) {
        let election = {};
        let nationalShift = shiftDist.ppf(Math.random());
        let recount = 0;
        let demPopularVote = 0;
        let gopPopularVote = 0;
        // for every state
        for (let s = 0; s < 51; s++) {
            let result = predictor.modelState(s, nationalShift);

            if (Math.abs(result.dem - result.gop) < 0.005 * result.turnout) // within 0.5%
                recount += electors[s]; 

            demPopularVote += result.dem;
            gopPopularVote += result.gop;

            if (result.dem > result.gop)
                stateData[s].probability += 1 / iterations;

            election[abbrs[s]] = [result.dem, result.gop];
        }

        let democraticElectors = sumElectors(election)[0]; 
        outcomes[democraticElectors]++;

        if (Math.abs(democraticElectors - 270) <= recount) recounts++; // if recount decides the election

        let total = demPopularVote + gopPopularVote;
        let gap = demPopularVote - gopPopularVote;
        if (gap / total > 0.1)
            demLandslide++;
        else if (gap / total < -0.1)
            gopLandslide++;

        if (democraticElectors >= 270) {
            demWins++;
            if (demPopularVote > gopPopularVote)
                demPopWins++;
            else
                gopWinPopLoseEC++;
        } else if (gopPopularVote < demPopularVote) {
            demPopWins++;
            demWinPopLoseEC++;
        }
    }

    let demElectors = outcomes.reduce((p, c, i) => p + c * i) / iterations; // mean
    //let demElectors = outcomes.reduce((p, c, i, a) => a[p] >= c ? p : i, 0); // mode
    
    // calculate prediction based on calling each state for whoever has the highest prob.
    let election = {};
    for (let s = 0; s < 51; s++) {
        let prob = stateData[s].probability;
        election[abbrs[s]] = [prob, 1 - prob];
    }
    let calledElectors = sumElectors(election)[0];

    history.unshift({
        date: date.getTime(),
        avgElectors: demElectors,
        calledElectors,
        probability: demWins / iterations,
        iterations,
        recounts: recounts / iterations,
        ties: outcomes[269] / iterations,
        demWinPop: demPopWins / iterations,
        gopWinPop: 1 - demPopWins / iterations,
        demWinPopLoseEC: demWinPopLoseEC / iterations,
        gopWinPopLoseEC: gopWinPopLoseEC / iterations,
        demLandslide: demLandslide / iterations,
        gopLandslide: gopLandslide / iterations,
    });

    outcomes = outcomes.map((c, i) => ({
        electors: i, 
        percentage: c / iterations,
    }));

    return {
        history,
        stateData,
        outcomes,
    };
}

function output(data, addToHistory) {
    csv.writeToPath("output/president-states.csv", data.stateData, {headers: true});
    csv.writeToPath("output/president-electors.csv", data.outcomes, {headers: true});
    if (addToHistory) 
        csv.writeToPath("output/president-history.csv", data.history, {headers: true});

    let current = data.history[0];
    let percent = current.probability * 100;
    console.log("Wrote data to output folder.");
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning the election.`);
    console.log(`Expected Democratic Electors: ${current.avgElectors.toFixed(0)}.`);
}

function loadHistory() {
   let history = [];

   return new Promise((resolve, reject) => {
       csv.fromPath("output/president-history.csv", {headers: true})
       .on("data", d => history.push(d))
       .on("end", () => {
           resolve(history);
       })
       .on("error", () => {
           resolve([]);
       });
   });
}

util.runAsyncFunction(main);
