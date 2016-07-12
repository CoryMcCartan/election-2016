let gaussian = require("gaussian");
let loader = require("./loader.js") 
let LOG;

const one_day = 1000 * 60 * 60 * 24;
let NOW = Date.now();
let untilElection;
let date_multiplier;

let data2012;
let polls;
let pollsters;
let averagePollster;

let averages;

const topicName = "2016-president";

function * init(log, nowCast, date) { 
    NOW = nowCast ? new Date(2016, 10, 8) : date;
    untilElection = (new Date(2016, 10, 8) - NOW) / one_day;
    date_multiplier = Math.exp(untilElection / 280); 

    LOG = log;

    console.log(`${~~untilElection} days until Election Day.`);

    data2012 = yield loader.get2012Election();
    processElection(data2012);

    pollsters = yield loader.getPollsterRatings();
    processPollsterData(pollsters);

    polls = yield loader.getPolls(topicName, date);
    processPolls(polls);

    weightPolls(polls);

    let pollAverages = calculateAverages(LOG);
    add2012Data(data2012, polls, pollAverages);

    let trendAdj = trendAdjustment(polls, pollAverages);

    averages = calculateAverages(LOG, trendAdj);
}

function processElection(data) {
    for (let state of data) {
        state.gap = (state.democratic - state.republican) / state.totalVoters;
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
    let isPresidentialPoll = q => {
        let name = q.name.toLowerCase();
        if (!name.includes("president") 
            && !name.includes("general election")
           && !name.includes("ge")) return false;
        if (name.includes("primary")) return false;
        if (name.includes("caucus")) return false;
        let responses = q.subpopulations[0].responses;
        if (responses.find(r => r.choice === "Bloomberg")) return false;
        if (!responses.find(r => r.choice === "Clinton")) return false;
        if (!responses.find(r => r.choice === "Trump")) return false;
        return true; 
    };

    const default_moe = 5.0; // MAGIC NUMBER
    const default_n = 400; // MAGIC NUMBER

    for (let poll of polls) {
        // data cleanup
        poll.date = new Date(poll.start_date);
        poll.partisan = poll.partisan.toLowerCase !== "nonpartisan";
        delete poll.affiliation;
        delete poll.last_updated;
        delete poll.end_date;
        delete poll.start_date;
        delete poll.pollster;
        delete poll.source;
        delete poll.id;

        // remove questions we don't care about
        let questions = poll.questions.filter(q => isPresidentialPoll(q));
        let question = questions[0];
        if (!question) {
            if (LOG) console.log("Deleted poll — no matching question.");
            delete poll;
            continue;
        }

        if (LOG) {
            if (questions.length > 1) 
                console.log(`EXTRA QUESTIONS: ${JSON.stringify(questions)}`);
            if (question.subpopulations.length > 1) 
                console.log(`EXTRA SUBPOPULATIONS: ${question.subpopulations.slice(1).map(x => x.name).join(" | ")}`);
        }

        delete poll.questions;
        // remove extraneous data
        poll.moe = question.subpopulations[0].margin_of_error || default_moe;
        poll.type = question.subpopulations[0].name.toLowerCase();
        poll.n = question.subpopulations[0].observations || default_n;
        poll.state = question.state;
        if (!poll.state) {
            let questionName = question.name.toLowerCase();
            for (let i = 0; i < 51; i++) {
                let name = stateFromAbbr[abbrs[i]].toLowerCase(); 
                if (questionName.includes(name + " ")) {
                    poll.state = abbrs[i];
                    if (LOG) console.log(`NO STATE: ${questionName}\n${poll.state}\n`);
                    break;
                }
            }
        }
        let responses  = question.subpopulations[0].responses;

        let dem = responses.find(r => r.party == "Dem").value;
        let gop = responses.find(r => r.party == "Rep").value;

        poll.gap = (dem - gop) / 100; // assume undecideds split evenly
        // add undecideds/3rd party to MOE
        poll.moe += (100 - (dem + gop)) * 0.1; // MAGIC NUMBER 
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

    for (let poll of polls) {
        let now = Math.min(Date.now(), NOW);
        let dateDiff = (now - poll.date) / one_day;
        let recencyWeight;
        let factor = 10 * Math.pow(date_multiplier, 1.5); // MAGIC NUMBER
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

        let partisanWeight = poll.partisan ? 0.75 : 1.0; // MAGIC NUMBERS

        let typeWeight;
        if (poll.type === "likely voters")
            typeWeight = 1;
        else if (poll.type === "registered voters")
            typeWeight = 0.8;
        else if (poll.type === "adults")
            typeWeight = 0.5;
        else {
            if (LOG) {
                console.log("=========");
                console.log("'" + poll.type + "'");
                console.log("=========");
            }
            poll.weight = 0;
            continue;
        }

        poll.weight = recencyWeight * sampleWeight * pollsterRating
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
                `DATE: ${poll.date.toLocaleDateString()}\t\t` + 
                `STATE: ${poll.state}\t` + 
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

function add2012Data(data2012, polls, avgs) {
    let weight = 6e-4 * Math.pow(date_multiplier, 10); // MAGIC NUMBER

    // adjust 2012 results by adding in the shift since then
    let gap2012 = 0.5107 - 0.4715;
    let gapAdj = avgs.national - gap2012;
    if (LOG) console.log(`Shift since 2012: ${(100 * gapAdj).toFixed(2)}%`);

    let moe_multiplier = 0.35 * Math.sqrt(avgs.national_var) * 1.96 * 100; //MAGIC NUMBER

    for (let i = 0; i < 51; i++) {
        let state = data2012[i];

        polls.push({
            state: abbrs[i],
            moe: (1 + 6*Math.abs(state.gap)) * moe_multiplier, // MAGIC NUMBER
            gap: state.gap + gapAdj / date_multiplier, 
            n: +state.totalVoters,
            date: new Date(2012, 10, 08),
            weight,
        });

        // predict 2016 turnout
        state.turnout2016 = state.population_2015 / state.population * state.totalVoters;
    }
}

function trendAdjustment(polls, avgs) {
    let most_recent = Array(51).fill(0);
    let adj = Array(51).fill(0);

    for (let poll of polls) {
        if (poll.state === "US") continue;
        let index = abbrs.indexOf(poll.state);
        most_recent[index] = Math.max(most_recent[index], poll.date);
    }

    // apply trend adjustment
    for (let i = 0; i < 51; i++) {
        let dateDiff = (NOW - most_recent[i]) / one_day;
        let weight = 1 - Math.exp(-dateDiff / 28); // MAGIC NUMBER
        weight /= Math.pow(date_multiplier, 4); // MAGIC NUMBER
        adj[i] = avgs.trend * weight;
    }

    return adj;
}

function calculateAverages(LOG, trendAdj = false) {
    let US_average = 0;
    let US_average_recent = 0;
    let us_weight_recent = 0;
    let US_average_old = 0;
    let us_weight_old = 0;
    let state_averages = Array(51).fill(0);

    let US_var = 0;
    let US_mean_var = 0;
    let state_var = Array(51).fill(0);
    let state_mean_var = Array(51).fill(0);
    let US_total_n = 0;
    let state_total_n = Array(51).fill(0);

    let n_us_polls = 0;
    let n_state_polls = Array(51).fill(0);
    let weights = Array(51).fill(0);

    for (let poll of polls) {
        if (poll.state === "US") {
            US_average += poll.gap * poll.weight;
            let now = Math.min(Date.now(), NOW);
            let dateDiff = (now - poll.date) / one_day;
            if (dateDiff < 14) {
                US_average_recent += poll.gap * poll.weight;
                us_weight_recent += poll.weight;
            } else {
                US_average_old += poll.gap * poll.weight;
                us_weight_old += poll.weight;
            }
            US_var += Math.pow(0.01 * poll.moe / 1.96, 2) * (poll.n - 1); // assuming pollsters use 95% interval
            US_total_n += poll.n - 1;
            n_us_polls++;
        } else {
            if (!('weight' in poll)) debugger;
            let index = abbrs.indexOf(poll.state);
            state_averages[index] += poll.gap * poll.weight;
            state_var[index] += Math.pow(0.01 * poll.moe / 1.96, 2) * (poll.n - 1);
            state_total_n[index] += poll.n - 1;
            weights[index] += poll.weight;
            n_state_polls[index]++;
        }
    }

    US_average /= us_weight_old + us_weight_recent;
    US_average_old /= us_weight_old;
    US_average_recent /= us_weight_recent;
    let trend = US_average_recent - US_average_old;
    if (us_weight_old === 0 || us_weight_recent === 0) trend = 0;
    if (LOG) console.log(`Trend in last week: ${(100 * trend).toFixed(2)}%`);
    state_averages = state_averages.map((a, i) => a / weights[i]);
    if (trendAdj)
        state_averages = state_averages.map((a, i) => a + trendAdj[i]);

    // calculate var in means
    for (let poll of polls) {
        if (poll.state === "US") {
           US_mean_var += Math.pow(poll.gap - US_average, 2) / n_us_polls;
        } else {
            let i = abbrs.indexOf(poll.state);
            state_mean_var[i] += Math.pow(poll.gap - state_averages[i], 2) / n_state_polls[i];
        }
    }

    state_var = state_var.map((a, i) => a + state_mean_var[i] * state_total_n[i]);
    state_var = state_var.map((a, i) => a 
                              * date_multiplier 
                              * Math.exp(1 / n_state_polls[i]) // fewer polls => more uncertainty
                              / state_total_n[i]);

    US_var += US_mean_var * US_total_n; 
    US_var *= date_multiplier * Math.exp(1 / n_us_polls) / US_total_n;

    if (LOG) {
        console.log(`US Mean StdDev: ${(100 * Math.sqrt(US_mean_var)).toFixed(2)}%`);
        console.log(`State\tPolls\tAverage\tStdDev`);
        console.log(`USA\t${n_us_polls}\t${(100 * US_average).toFixed(1)}%\t` + 
                    `${(100 * Math.sqrt(US_var)).toFixed(2)}%`);
        for (let s = 0; s < 51; s++) {
            console.log(`${abbrs[s]}\t${n_state_polls[s]}\t` +
                        `${(100 * state_averages[s]).toFixed(1)}%\t` + 
                        `${(100 * Math.sqrt(state_var[s])).toFixed(2)}%`);
        }
    }

    return {
        national: US_average,
        national_var: US_var,
        national_stddev: Math.sqrt(US_var),
        state: state_averages,
        state_var,
        trend,
    };
}

function modelState(index, nationalShift) {
    nationalShift *= Math.sqrt(averages.national_var); 

    let variance = averages.state_var[index] - 0.5*averages.national_var; // MAGIC NUMBER

    let mean = averages.state[index] + nationalShift;
    let gap = gaussian(mean, variance).ppf(Math.random());

    let turnout = data2012[index].turnout2016;

    let dem = turnout * (0.5 + gap / 2);
    let gop = turnout * (0.5 - gap / 2);
    
    return {
        dem,
        gop,
        turnout,
    };
}


module.exports = {
    init,
    modelState,
};
