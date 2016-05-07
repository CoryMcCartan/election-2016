let fetch = require("node-fetch");
let d3 = require("d3");
let gaussian = require("gaussian");
let csv = require("fast-csv");

require("./electoral-college.js").call(global);
require("./helper.js").call(global);

function main() {
    let iter = +process.argv[2] || 5e4;

    // load 2012 data, then predict stuff
    let states = [];
    csv.fromPath("data/2012.csv", {headers: true})
        .on("data", d => states.push(d))
        .on("end", () => {
            let data = predict(states, iter);
            output(data);
        });
}

function predict(data2012, iterations) {
    const VARIANCE = Math.pow(0.10, 2);
    const SHIFT_2016 = +0.031; // x percent shift toward Democrats from 2012

    let stateData = [];

    for (let state of data2012) {
        state.abbr = abbrFromState[state.name];
        let percentage_D = state.democratic / state.totalVoters;
        let percentage_R = state.republican / state.totalVoters;
        // apply predicted shift
        percentage_D += SHIFT_2016;
        percentage_R -= SHIFT_2016;

        let win_dist = gaussian(percentage_D - percentage_R, VARIANCE);
        // output
        stateData.push({
            state: state.abbr,
            probability: 1 - win_dist.cdf(0.0), // prob of dem winning
        });

        state.d_dist = gaussian(percentage_D, VARIANCE);
        state.r_dist = gaussian(percentage_R, VARIANCE);
    }

    // simulate a bunch of elections
    let averageElectors = 0; // average electoral college votes for dem
    let averagePopular_D = 0; // average popular vote for dem
    let averagePopular_R = 0; // average popular vote for gop
    let demWins = 0; // number of times dem wins

    for (let i = 0; i < iterations; i++) {
        let election = {};
        let popularVote_D = 0;
        let popularVote_R = 0;
        // for every state
        for (let s = 0; s < 51; s++) {
            let state = data2012[s];

            let percentage_D = state.d_dist.ppf(Math.random());
            let percentage_R = state.r_dist.ppf(Math.random());

            popularVote_D += percentage_D * state.totalVoters;
            popularVote_R += percentage_R * state.totalVoters;

            election[state.abbr] = [percentage_D, percentage_R];
        }

        let democraticElectors = sumElectors(election)[0]; 
        averageElectors += democraticElectors / iterations;

        averagePopular_D += popularVote_D / iterations;
        averagePopular_R += popularVote_R / iterations;

        if (democraticElectors >= 270)
            demWins++;
    }

    let summaryData = [
        {
            party: "DEM",
            popular: averagePopular_D,
            electors: averageElectors,
            probability: demWins / iterations,
        },
        {
            party: "GOP",
            popular: averagePopular_R,
            electors: 538 - averageElectors,
            probability: 1 - demWins / iterations,
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
