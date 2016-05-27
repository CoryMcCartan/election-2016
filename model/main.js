let csv = require("fast-csv");
let gaussian = require("gaussian");

require("./electoral-college.js")(global);
require("./states.js")(global);
let predictor = require("./predict.js");
let util = require("./util.js");

function * main() {
    console.log("======= 2016 PRESIDENTIAL RACE PREDICTIONS =======");
    let iterations = +process.argv[2] || 2e4;
    let addToHistory = process.argv[3] !== "--dry";

    yield* predictor.init();

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
    let recounts = 0;
    let demWinPopLoseEC = 0;
    let gopWinPopLoseEC = 0;
    let demLandslide = 0;
    let gopLandslide = 0;
    let stateData = abbrs.map(a => ({state: a, probability: 0}) ); // probability of winning each state

    for (let i = 0; i < iterations; i++) {
        let election = {};
        let nationalShift = shiftDist.ppf(Math.random());
        let recount = false;
        let demPopularVote = 0;
        let gopPopularVote = 0;
        // for every state
        for (let s = 0; s < 51; s++) {
            let result = predictor.modelState(s, nationalShift);

            if (Math.abs(result.dem - result.gop) < 0.005 * result.turnout)
                recount = true; 

            demPopularVote += result.dem;
            gopPopularVote += result.gop;

            if (result.dem > result.gop)
                stateData[s].probability += 1 / iterations;

            election[abbrs[s]] = [result.dem, result.gop];
        }

        let democraticElectors = sumElectors(election)[0]; 
        outcomes[democraticElectors]++;

        if (recount && Math.abs(democraticElectors - 270) < 20) recounts++;

        let total = demPopularVote + gopPopularVote;
        let gap = demPopularVote - gopPopularVote;
        if (gap / total > 0.1)
            demLandslide++;
        else if (gap / total < -0.1)
            gopLandslide++;

        if (democraticElectors >= 270) {
            demWins++;
            if (demPopularVote < gopPopularVote)
                gopWinPopLoseEC++;
        } else if (gopPopularVote < demPopularVote) {
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
        date: Date.now(),
        avgElectors: demElectors,
        calledElectors,
        probability: demWins / iterations,
        iterations,
        recounts: recounts / iterations,
        ties: outcomes[269] / iterations,
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
    csv.writeToPath("output/states.csv", data.stateData, {headers: true});
    csv.writeToPath("output/electors.csv", data.outcomes, {headers: true});
    if (addToHistory) 
        csv.writeToPath("output/history.csv", data.history, {headers: true});

    let current = data.history[0];
    let percent = current.probability * 100;
    console.log("Wrote data to output folder.");
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning the election.`);
    console.log(`Expected Democratic Electors: ${current.avgElectors.toFixed(0)}.`);
}

function loadHistory() {
   let history = [];

   return new Promise((resolve, reject) => {
       csv.fromPath("output/history.csv", {headers: true})
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