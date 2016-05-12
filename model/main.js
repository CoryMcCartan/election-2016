let fetch = require("node-fetch");
let csv = require("fast-csv");
let gaussian = require("gaussian");

require("./electoral-college.js")(global);
require("./helper.js")(global);
require("./predict.js")(global);

function main() {
    let iterations = +process.argv[2] || 5e4;

    loadData().then(() => {
        let data = predict(iterations);
        output(data);
    });
}

function predict(iterations) {
    let shiftDist = gaussian(0, 0.05 * 0.05);

    // simulate a bunch of elections
    let outcomes = new Array(538 + 1).fill(0);
    let demWins = 0;
    let stateData = abbrs.map(a => ({state: a, probability: 0}) ); // probability of winning each state

    for (let i = 0; i < iterations; i++) {
        let election = {};
        let nationalShift = shiftDist.ppf(Math.random());
        // for every state
        for (let s = 0; s < 51; s++) {
            let result = modelState(s, nationalShift);

            if (result.dem > 0.5)
                stateData[s].probability += 1 / iterations;
            election[abbrs[s]] = [result.dem, result.gop];
        }

        let democraticElectors = sumElectors(election)[0]; 
        outcomes[democraticElectors]++;

        if (democraticElectors >= 270)
            demWins++;
    }

    // find index of max, which represents mode of electors distribution
    let demElectors = outcomes.reduce((p, c, i) => outcomes[p] > c ? p : i);

    let summaryData = [
        {
            party: "DEM",
            electors: demElectors,
            probability: demWins / iterations,
        },
        {
            party: "GOP",
            electors: 538 - demElectors,
            probability: 1 - demWins / iterations,
        }
    ];

    outcomes = outcomes.map((c, i) => ({
        electors: i, 
        percentage: c / iterations,
    }));

    return {
        summaryData,
        stateData,
        outcomes,
    };
}

function output(data) {
    csv.writeToPath("output/states.csv", data.stateData, {headers: true});
    csv.writeToPath("output/electors.csv", data.outcomes, {headers: true});
    csv.writeToPath("output/overall.csv", data.summaryData, {headers: true});

    console.log("Wrote data to output folder.");
    let percent = data.summaryData[0].probability * 100;
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning the election.`);
}



main();
