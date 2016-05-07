let fetch = require("node-fetch");
let d3 = require("d3");
let gaussian = require("gaussian");
let csv = require("fast-csv");

require("./electoral-college.js").call(global);
require("./helper.js").call(global);

function main() {
    // load 2012 data, then predict stuff
    let states = [];
    csv.fromPath("data/2012.csv", {headers: true})
        .on("data", d => states.push(d))
        .on("end", () => {
            let data = predict(states);
            output(data);
        });
}

function predict(data2012) {
    const VARIANCE = Math.pow(0.05, 2);
    const SHIFT_2016 = +0.08; // x percent shift toward Democrats
    const ITER = 10e3;

    let stateData = [];
    let totalVoters = 0;

    for (let state of data2012) {
        state.abbr = abbrFromState[state.name];
        let percentage = state.democratic / state.totalVoters;
        // this makes states closer to 50% have more standard deviation
        let variance = 4 * VARIANCE * (1 - percentage) * percentage;
        state.dist = gaussian(percentage, variance);
        // output
        stateData.push({
            state: state.abbr,
            probability: 1 - state.dist.cdf(0.5), // prob of dem winning
        });

        // tally all voters
        totalVoters += +state.totalVoters;
    }

    // simulate a bunch of elections
    let averageElectors = 0; // average electoral college votes for dem
    let averagePopular = 0; // average popular vote for dem
    let demWins = 0; // number of times dem wins

    for (let i = 0; i < ITER; i++) {
        let election = {};
        let popularVote = 0;
        // for every state
        for (let s = 0; s < 51; s++) {
            let state = data2012[s];
            if (!state) debugger;
            let percentage = state.dist.ppf(Math.random());
            popularVote += percentage * state.totalVoters;
            election[state.abbr] = percentage;
        }

        let democraticElectors = sumElectors(election)[0]; 
        averageElectors += democraticElectors / ITER;

        averagePopular += popularVote / ITER;

        if (democraticElectors >= 270)
            demWins++;
    }

    let summaryData = [
        {
            party: "DEM",
            popular: averagePopular,
            electors: averageElectors,
            probability: demWins / ITER,
        },
        {
            party: "GOP",
            popular: totalVoters - averagePopular,
            electors: 538 - averageElectors,
            probability: 1 - demWins / ITER,
        }
    ];

    return {
        summaryData,
        stateData,
    };
}


function output(data) {
    csv.writeToPath("output/prob.csv", data.stateData, {headers: true});

    csv.writeToPath("output/overall.csv", data.summaryData, {headers: true});

    console.log("Wrote data to output folder.");
    let percent = data.summaryData[0].probability * 100;
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning the election.`);
}



main();
