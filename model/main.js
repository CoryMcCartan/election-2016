let csv = require("fast-csv");
let gaussian = require("gaussian");

require("./electoral-college.js")(global);
require("./states.js")(global);
let predictor = require("./predict.js");
let util = require("./util.js");

function * main() {
    console.log("======= 2016 PRESIDENTIAL RACE PREDICTIONS =======");
    let iterations = +process.argv[2] || 2e4;

    yield* predictor.init();

    let history = yield loadHistory();

    console.log(`Model initialized. Simulating ${iterations} elections...`);

    let data = predict(iterations, history);

    console.log(`Simulations finished.`);

    output(data);

    console.log("==================================================");
    console.log();
}

function predict(iterations, history) {
    let shiftDist = gaussian(0, 1);

    // simulate a bunch of elections
    let outcomes = new Array(538 + 1).fill(0);
    let demWins = 0;
    let stateData = abbrs.map(a => ({state: a, probability: 0}) ); // probability of winning each state

    for (let i = 0; i < iterations; i++) {
        let election = {};
        let nationalShift = shiftDist.ppf(Math.random());
        // for every state
        for (let s = 0; s < 51; s++) {
            let result = predictor.modelState(s, nationalShift);

            if (result.dem > 0.5)
                stateData[s].probability += 1 / iterations;
            election[abbrs[s]] = [result.dem, result.gop];
        }

        let democraticElectors = sumElectors(election)[0]; 
        outcomes[democraticElectors]++;

        if (democraticElectors >= 270)
            demWins++;
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

function output(data) {
    csv.writeToPath("output/states.csv", data.stateData, {headers: true});
    csv.writeToPath("output/electors.csv", data.outcomes, {headers: true});
    csv.writeToPath("output/history.csv", data.history, {headers: true});

    let percent = data.history[0].probability * 100;
    console.log("Wrote data to output folder.");
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning the election.`);
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
