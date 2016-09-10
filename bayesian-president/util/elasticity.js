/*
 * 2016 PRESIDENTIAL ELECTION PREDICTIONS
 * State polling elasticity calculator
 *
 * © 2016 Cory McCartan
 */

let fetch = require("node-fetch");
let csv = require("fast-csv");
const path = require("path");
let async = require("./async.js");
require("./states.js")(global);

// get past polling data at state and national levels
// interpolate for daily estimated polling average
// calculate elasticity (perhaps as function of date or other variable)
// export

const one_day = 1000 * 60 * 60 * 24;
const startDate = new Date("10/1/2015");

function * calculateElasticities() {
    let polls = yield getPollList();
    let averages = yield* getPastAverages();
    let nationalPolling = interpolateNationalPolling(polls, averages);
    let statePolling = interpolateStatePolling(polls, averages);

    let elasticities = [];
    let days = nationalPolling.length;
    for (let s = 0; s < 51; s++) {
        let elasticity = [];
        let state = statePolling[s];

        for (let d = 1; d < days; d++) {
            let nat_d_0 = nationalPolling[d-1].dem;
            let nat_d_1 = nationalPolling[d].dem;
            let nat_r_0 = nationalPolling[d-1].gop;
            let nat_r_1 = nationalPolling[d].gop;
            let s_d_0 = state[d-1].dem;
            let s_d_1 = state[d].dem;
            let s_r_0 = state[d-1].gop;
            let s_r_1 = state[d].gop;

            let pct_nat_dem = 2 * (nat_d_1 - nat_d_0) / (nat_d_0 + nat_d_1);
            let pct_nat_gop = 2 * (nat_r_1 - nat_r_0) / (nat_r_0 + nat_r_1);
            let pct_s_dem = 2 * (s_d_1 - s_d_0) / (s_d_0 + s_d_1);
            let pct_s_gop = 2 * (s_r_1 - s_r_0) / (s_r_0 + s_r_1);

            elasticity.push({
                dem: pct_s_dem / pct_nat_dem,
                gop: pct_s_gop / pct_nat_gop,
            });
        }

        elasticities.push(elasticity);
    }

    let combined = [];
    let length= elasticities[0].length;
    for (let j = 0; j < length; j++) {
        let obj = {};

        for (let [i, state] of abbrs.entries()) {
            obj[state + "_dem"] = elasticities[i][j].dem;
            obj[state + "_gop"] = elasticities[i][j].gop;
        }

        combined.push(obj);
    }

    csv.writeToPath(path.join(__dirname, "../data/elasticity.csv"), 
                    combined, {headers: true});
}

function interpolateNationalPolling(polls, averages) {
    return interpolatePolling(polls, averages, "US");
}

function interpolatePolling(polls, averages, state) {
    let consolidated = [];
    let interpolated = [];

    polls = polls.filter(p => p.state === state);

    // consolidate all polls on a given day
    for (let date = +startDate; date < Date.now(); date += one_day) {
        let day = new Date(date).toDateString(); 
        let todaysPolls = polls.filter(p => new Date(p.date).toDateString() === day);

        if (todaysPolls.length === 0) {
            consolidated.push(null);
            continue;
        }

        let average = {
            dem: 0,
            gop: 0,
        };

        let weights = 0;
        for (let poll of todaysPolls) {
            average.dem += +poll.dem * +poll.weight;
            average.gop += +poll.gop * +poll.weight;
            weights += +poll.weight;
        }

        average.dem /= weights;
        average.gop /= weights;

        consolidated.push(average);
    }

    let startIndex = consolidated.findIndex(c => c !== null);

    // interpolate, using priors from previous elections
    let last;
    if (state === "US")
        last = { dem: 0.5, gop: 0.5 };
    else
        last = averages[abbrs.indexOf(state)];

    let lastIndex = -1, nextIndex, next;
    for (let i = 0; i < consolidated.length; i++) {
        if (consolidated[i] === null) {
            nextIndex = consolidated.findIndex((el, j) => j > i && el !== null); 
            if (nextIndex === -1) {
                nextIndex = i;
                next = last;
            } else {
                next = consolidated[nextIndex];
            }

            let fraction = (i - lastIndex) / (nextIndex - lastIndex);
            interpolated.push({
                dem: last.dem + fraction * (next.dem - last.dem),
                gop: last.gop + fraction * (next.gop - last.gop),
            });
        } else {
            last = consolidated[i];
            interpolated.push(consolidated[i]);
            lastIndex = i;
        }
    }

    return interpolated;
}


function interpolateStatePolling(polls, averages) {
    let states = [];

    for (let abbr of abbrs) {
        states.push(interpolatePolling(polls, averages, abbr));
    }

    return states;
}

function * getPastAverages() {
    let elections = [];

    let totalFactor = 0;
    for (let yr = 1996; yr < new Date().getFullYear(); yr += 4) {
        let data = yield getElectionData(yr);

        // weight each value
        let factor = Math.pow((yr - 1995) / 20, 2);
        totalFactor += factor;
        for (let entry of data) {
            entry.total *= factor;
            entry.dem *= factor;
            entry.gop *= factor;
        }

        elections.push(data);
    }

    let averages = new Array(51);
    for (let i = 0; i < 51; i++) {
        let total = 0;
        averages[i] = {
            dem: 0,
            gop: 0,
        };

        for (let j = 0; j < elections.length; j++) {
            total += elections[j][i].total / totalFactor;
            averages[i].dem += elections[j][i].dem / totalFactor;
            averages[i].gop += elections[j][i].gop / totalFactor;
        }

        averages[i].dem /= total;
        averages[i].gop /= total;
    }

    return averages;
}

function getPollList() {
    let polls = [];
    let filename = path.join(__dirname, "../data/polls.csv");
    
    return new Promise((resolve, reject) => {
        csv.fromPath(filename, {headers: true})
        .on("data", d => polls.push(d))
        .on("end", () => {
            resolve(polls);
        })
        .on("error", reject);
    });
}

function getElectionData(yr) {
    let data = [];
    const filename = path.join(__dirname, `../data/elections/${yr}.csv`);
    
    return new Promise((resolve, reject) => {
        csv.fromPath(filename, {headers: true})
        .on("data", d => data.push(d))
        .on("end", () => {
            resolve( data.map((d, i)=> ({
                state: abbrs[i],
                total: +d.total,
                dem: +d.dem,
                gop: +d.gop,
            })) );
        })
        .on("error", reject);
    });
}



if (require.main === module) // called directly as a script
    async.run(calculateElasticities); 
else
    module.exports = {
        calculateElasticities,
    };
