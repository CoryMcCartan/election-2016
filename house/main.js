let csv = require("fast-csv");
let loader = require("./loader.js") 
let gaussian = require("gaussian");
let util = require("./util.js");
let argv = require("minimist")(process.argv.slice(2));
require("./states.js")(global);

const one_day = 1000 * 60 * 60 * 24;
let NOW;
let untilElection;
let date_multiplier;

let pollsters;

const demSeats = 188;
const gap2014 = 0.455 - 0.512;
const turnout2014 = 78235240;
const turnout2012 = 122346020;

const topicName = "2016-national-house-race";

function * main() {
    console.log("======= 2016 U.S. HOUSE RACE PREDICTIONS =======");
    let iterations = +argv._[0] || 2e4;
    let addToHistory = !argv.dry;
    LOG = !!argv.v || !!argv.verbose;
    let nowCast = !!argv.now
    date = argv.date ? new Date(argv.date + " 00:00") : new Date();

    NOW = nowCast ? new Date(2016, 10, 8) : date;
    untilElection = (new Date(2016, 10, 8) - NOW) / one_day;
    date_multiplier = Math.exp(untilElection / 180);  // MAGIC NUMBER

    console.log(`${~~untilElection} days until Election Day.`);

    let history = yield loadHistory();

    let data2014 = yield loader.get2014Election();
    processElection(data2014);

    pollsters = yield loader.getPollsterRatings();
    processPollsterData(pollsters);

    let polls = yield loader.getPolls(topicName, date);
    processPolls(polls);

    weightPolls(polls);

    let averages = calculateAverages(data2014, polls);

    console.log(`Model initialized. Simulating ${iterations} elections...`);

    let data = predict(averages, data2014, iterations, history);

    console.log(`Simulations finished.`);

    output(data, addToHistory);

    console.log("==================================================");
    console.log();
}

function processElection(data) {
    for (let district of data) {
        district.gap2014 = (district.dem - district.gop) / district.total;
    }
}

function processPollsterData(data) {
    let length = data.length;
    let avgPredictive = 0;

    for (let pollster of data) {
        // data cleanup
        pollster.advancedPlusMinus = +pollster.advancedPlusMinus;
        pollster.predictivePlusMinus = +pollster.predictivePlusMinus;
        pollster.simplePlusMinus = +pollster.simplePlusMinus;
        pollster.simpleAverageError = +pollster.simpleAverageError;
        pollster.meanRevertedBias = +pollster.meanRevertedBias;
        pollster.racesCalled = +pollster.racesCalled;
        pollster.polls = +pollster.polls;
        pollster.callsCellPhones = pollster.callsCellPhones === "yes";
        pollster.internet = pollster.internet === "yes";
        pollster.banned = pollster.banned === "yes";
        delete pollster.ncpp_aapor_roper;

        avgPredictive += pollster.meanRevertedBias;
    }

    averagePollster = {
        pollster: "AVERAGE",
        predictivePlusMinus: avgPredictive / length + 2.0, // assume worse than average b/c unknown
        meanRevertedBias: 0,
    };
}

function processPolls(polls) {
    let isHousePoll = q => {
        if (q.name === null) return false;
        let name = q.name.toLowerCase();
        if (!name.includes("house") 
           && !name.includes("national")) return false;
        if (name.includes("primary")) return false;
        if (!q.subpopulations.length) return false;
        let responses = q.subpopulations[0].responses;
        if (!responses.find(r => r.choice.toLowerCase().includes("democrat"))) return false;
        if (!responses.find(r => r.choice.toLowerCase().includes("republican"))) return false;
        return true; 
    };

    const default_moe = 5.0; // MAGIC NUMBER
    const default_n = 400; // MAGIC NUMBER

    for (let poll of polls) {
        if (poll.skip) continue;
        // data cleanup
        poll.date = new Date(poll.start_date);
        poll.partisan = poll.partisan.toLowerCase !== "nonpartisan";
        poll.skip = new Date(poll.last_updated) > NOW;
        delete poll.affiliation;
        delete poll.last_updated;
        delete poll.end_date;
        delete poll.start_date;
        delete poll.pollster;
        delete poll.source;
        delete poll.id;

        // remove questions we don't care about
        let questions = poll.questions.filter(q => isHousePoll(q));
        let question = questions[0];
        if (!question) {
            if (LOG) {
                let str = questions.map(q => q.subpopulations[0].responses
                                    .map(r => r.choice).join("/")).join(" | ");
                console.log(`NO MATCHING QUESTIONS: ${str}`);
            }
            poll.skip = true;
            continue;
        }

        if (LOG) {
            if (questions.length > 1) {
                let str = questions.map(q => q.subpopulations[0].responses
                                    .map(r => r.choice).join("/")).join(" | ");
                console.log(`EXTRA QUESTIONS: ${str}`);
            }
            if (question.subpopulations.length > 1) 
                console.log(`EXTRA SUBPOPULATIONS: ${question.subpopulations.slice(1).map(x => x.name).join(" | ")}`);
        }

        delete poll.questions;
        // remove extraneous data
        poll.moe = question.subpopulations[0].margin_of_error || default_moe;
        poll.type = question.subpopulations[0].name.toLowerCase();
        poll.n = question.subpopulations[0].observations || default_n;
        let responses  = question.subpopulations[0].responses;

        let dem = responses.find(r => r.choice.toLowerCase().includes("democrat")).value;
        let gop = responses.find(r => r.choice.toLowerCase().includes("republican")).value;

        poll.gap = (dem - gop) / 100; // assume undecideds split evenly
        // add undecideds/3rd party to MOE
        poll.moe += (100 - (dem + gop)) * 0.5 * date_multiplier; // MAGIC NUMBER 
    }
}

function weightPolls(polls) {
    const base_n = Math.log(600);
    const regVoterBias = +0.000; 
    const likelyVoterBias = -0.000; 
    const biasBuffer = 0.005; // ignore biases less than this amount MAGIC NUMBER

    let rv_avg = 0;
    let n_rv = 0;
    let lv_avg = 0;
    let n_lv = 0;

    let now = Math.min(Date.now(), NOW);
    for (let poll of polls) {
        if (poll.skip) continue;
        let dateDiff = (now - poll.date) / one_day;
        let recencyWeight;
        let factor = 20 * date_multiplier; // MAGIC NUMBER
        recencyWeight = Math.exp(-dateDiff / factor); 

        let sampleWeight = Math.log(poll.n) / base_n; 

        let pollsters = getPollsterAverages(poll.survey_houses, poll.method);
        if (pollsters.banned) {
            if (LOG) console.log("Deleted poll — pollster banned.");
            poll.weight = 0;
            delete poll;
            continue;
        }
        let pollsterRating = Math.exp(-pollsters.plusMinus);
        pollsterRating = Math.pow(pollsterRating, 3);

        let partisanWeight = poll.partisan ? 0.7 : 1.0; // MAGIC NUMBERS

        let typeWeight;
        if (poll.type === "likely voters")
            typeWeight = 1;
        else if (poll.type === "registered voters")
            typeWeight = 0.75;
        else if (poll.type === "adults")
            typeWeight = 0.4;
        else {
            if (LOG) {
                console.log("=========");
                console.log("'" + poll.type + "'");
                console.log("=========");
            }
            poll.weight = 0;
            continue;
        }

        poll.weight = 10 * recencyWeight * sampleWeight * pollsterRating
            * partisanWeight * typeWeight;


        let bias = pollsters.meanBias;
        let biasAdj = bias - Math.sign(bias) * biasBuffer;
        if (Math.abs(bias) < biasBuffer)
            biasAdj = 0;

        // if not an LV poll, apply adjustment
        let typeAdj = poll.type === "Likely Voters" ? likelyVoterBias : regVoterBias;

        // stats on registered vs likely voter polls
        if (poll.type === "Likely Voters") {
            lv_avg += poll.gap;
            n_lv++;
        } else {
            rv_avg += poll.gap;
            n_rv++;
        }

        poll.gap += biasAdj - typeAdj;

        if (LOG) console.log(
                `POLL: ${((poll.survey_houses[0] || {name: ""}).name + "                     ").substring(0, 20)}\t\t` +
                `DATE: ${poll.date.toLocaleDateString()}   \t\t` + 
                `WEIGHT: ${poll.weight.toFixed(3)}\t` + 
                `GAP: ${(100 * poll.gap).toFixed(2)}%\t` + 
                `ADJUSTMENT: ${(100 * (biasAdj - typeAdj)).toFixed(2)}%`
        );
    }

    // calculate average and turn into percent
    lv_avg /= 0.01 * n_lv || 1;
    rv_avg /= 0.01 * n_rv || 1;
    if (LOG) console.log(`LV-RV average bias: ${(lv_avg - rv_avg).toFixed(3)}%`);
}

function getPollsterAverages(surveyors, method) {
    let pollster = {
        plusMinus: 0,
        meanBias: 0,
        banned: false,
    };

    let total = surveyors.length;

    for (let surveyor of surveyors) {
        // find pollster with closest name
        let name = surveyor.name;
        let matched = pollsters.filter(p => {
            return p.pollster.includes(name) || name.includes(p.pollster);
        });
        if (matched.length === 0) {
            // special cases
            if (name.includes("Hart")) {
                matched = pollsters.find(p => p.pollster.includes("Hart"));
                break;
            } else if (name.includes("Schoen")) {
                matched = pollsters.find(p => p.pollster.includes("Schoen"));
                break;
            } else if (name.includes("Selzer")) {
                matched = pollsters.find(p => p.pollster.includes("Selzer"));
                break;
            } else if (name.includes("Opinion Research Corporation")) { matched = pollsters.find(p => p.pollster.includes("Opinion Research Corp."));
                break;
            } else if (name.includes("Greenberg Quinlan Rosner")) {
                matched = pollsters.find(p => p.pollster.includes("Greenberg Quinlan Rosner"));
                break;
            } else if (name.includes("Field Poll")) {
                matched = pollsters.find(p => p.pollster.includes("Field Poll"));
                break;
            }

            matched = averagePollster;
            if (LOG)
                console.log(`NOT FOUND: ${name}.`);
        } else if (matched.length > 1) {
            if (method.toLowerCase() === "internet")
                matched = matched.find(p => p.pollster.includes("online")) || averagePollster;
            else
                matched = matched.find(p => p.pollster.includes("telephone")) || averagePollster;
        } else {
            matched = matched[0];
        }

        pollster.plusMinus += matched.predictivePlusMinus / total / 100; 
        pollster.meanBias += matched.meanRevertedBias / total / 100; 
        pollster.banned |= matched.banned;
    }

    return pollster;
}

function calculateAverages(data2014, polls) {
    polls = polls.filter(p => !p.skip);
    let average = polls.reduce((p, c) => p + c.gap * c.weight, 0);
    let variance = polls.reduce((p, c) => p + Math.pow(c.moe / 196, 2) * (c.n - 1) * c.weight, 0);
    let weights = polls.reduce((p, c) => p + c.weight, 0);
    let total_n = polls.reduce((p, c) => p + c.n - 1, 0);
    average /= weights;
    variance /= weights * total_n;
    let mean_var = polls.reduce((p, c) => p + Math.pow(c.gap - average, 2) * c.weight, 0);
    mean_var /= weights;
    variance += mean_var;
    variance *= date_multiplier * 2.1; // MAGIC NUMBER

    let shift = average - gap2014;

    if (LOG) {
        console.log(`Nationwide Average: ${(100 * average).toFixed(2)}%`);
        console.log(`Shift since 2014: ${(100 * shift).toFixed(2)}%`);
        console.log(`StdDev: ${(100 * Math.sqrt(variance)).toFixed(2)}%`);
    }

    for (let district of data2014) {
        let old = district.gap2014;
        district.gap = old + (1 - Math.abs(old)) * shift / date_multiplier;
        district.variance = 5*Math.abs(district.gap) * variance; // MAGIC NUMBER
    }

    return {
        average,
        shift,
        variance,
    };
}

function predict(averages, districts, iterations, history) {
    let shiftDist = gaussian(0, averages.variance);

    let outcomes = new Array(435 + 1).fill(0);
    let districtResults = districts.map(d => ({
        id: d.abbr + (d.district > 0 ? "-" + d.district : ""),
        prob: 0,
        gap: d.gap,
        stddev: Math.sqrt(d.variance + averages.variance),
    }));

    let demWins = 0;
    let demGains = 0;
    let demPopWins = 0;
    let demMismatch = 0;
    let gopMismatch = 0;
    let demLandslide = 0;
    let gopLandslide = 0;
    let demSupermajority = 0;
    let gopSupermajority = 0;

    let one = 1 / iterations;

    for (let i = 0; i < iterations; i++) {
        let seats = 0;
        let demPopularVote = 0;
        let gopPopularVote = 0;

        let nationalShift = shiftDist.ppf(Math.random());
        let d = 0;
        for (let district of districts) {
            let avg = district.gap + nationalShift;
            let result = gaussian(avg, district.variance).ppf(Math.random());

            let turnout = district.total * turnout2014 / turnout2012;
            demPopularVote += turnout * (0.5 + result / 2);
            gopPopularVote += turnout * (0.5 - result / 2);

            if (result > 0) {
                seats++;
                districtResults[d].prob += one;
            }

            d++;
        }

        outcomes[seats] += one;

        // landslide
        let total = demPopularVote + gopPopularVote;
        let gap = demPopularVote - gopPopularVote;
        if (gap / total > 0.1)
            demLandslide += one;
        else if (gap / total < -0.1)
            gopLandslide += one;

        // count wins
        if (seats >= 218) {
            demWins += one;
            if (demPopularVote > gopPopularVote)
                demPopWins += one;
            else
                gopMismatch += one;
        } else if (gopPopularVote < demPopularVote) {
            demPopWins += one;
            demMismatch += one;
        }

        if (seats > demSeats)
            demGains += one;

        if (seats >= 290)
            demSupermajority += one;
        else if (435 - seats >= 290)
            gopSupermajority += one;
    }

    let mean = outcomes.reduce((p, c, i) => p + c * i);
    let mode = outcomes.reduce((p, c, i , a) => a[p] >= c ? p : i, 0);

    // convert to +/- 
    mean -= demSeats;
    mode -= demSeats;

    history.unshift({
        date: date.getTime(),
        mean,
        mode,
        probability: demWins,
        iterations,
        demPopWins,
        gopPopWins: 1 - demPopWins,
        demMismatch,
        gopMismatch,
        demLandslide,
        gopLandslide,
        demGains,
        demLosses: 1 - demGains - outcomes[demSeats],
        demSupermajority,
        gopSupermajority,
    });

    outcomes = outcomes.map((c, i) => ({
        seats: i - demSeats, 
        prob: c,
    }));

    return {
        history,
        districtResults,
        outcomes,
    };
} 

function output(data, addToHistory) {
    csv.writeToPath("output/house-districts.csv", data.districtResults, {headers: true});
    csv.writeToPath("output/house-seats.csv", data.outcomes, {headers: true});
    if (addToHistory) 
        csv.writeToPath("output/house-history.csv", data.history, {headers: true});

    let current = data.history[0];
    let percent = current.probability * 100;
    console.log("Wrote data to output folder.");
    console.log(`Democrats have a ${percent.toFixed(2)}% chance of winning control.`);
    console.log(`Expected Democratic Change: ${current.mean.toFixed(0)} seats.`);
}

function loadHistory() {
   let history = [];

   return new Promise((resolve, reject) => {
       csv.fromPath("output/house-history.csv", {headers: true})
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
