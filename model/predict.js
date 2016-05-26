let gaussian = require("gaussian");
let loader = require("./loader.js")
let levenshtein = require('fast-levenshtein');

const one_day = 1000 * 60 * 60 * 24;
const untilElection = (new Date(2016, 11, 8) - Date.now()) / one_day;

const date_multiplier = Math.exp(untilElection / 281);  // MAGIC NUMBER (from Iowa Caucuses to Election Day)
let mix; // how much of state vs national data to use

let data2012;
let polls;
let pollsters;

let averages;

const topicName = "2016-president";

function * init() { 
    data2012 = yield loader.get2012Election();
    processElection(data2012);

    pollsters = yield loader.getPollsterRatings();
    processPollsterData(pollsters);

    polls = yield loader.getPolls(topicName);
    processPolls(polls);

    weightPolls(polls);

    let pollAverages = calculateAverages();

    add2012Data(data2012, polls, pollAverages);

    averages = calculateAverages();
}

function processElection(data) {
    for (let state of data) {
        state.gap = (state.democratic - state.republican) / state.totalVoters;
    }
}

function processPollsterData(data) {
    for (let pollster of data) {
        // data cleanup
        pollster.advancedPlusMinus = +pollster.advancedPlusMinus;
        pollster.predictivePlusMinus = +pollster.predictivePlusMinus;
        pollster.simplePlusMinus = +pollster.simplePlusMinus;
        pollster.simpleAverageError = +pollster.simpleAverageError;
        pollster.meanRevertedBias = +pollster.meanRevertedBias;
        pollster.polls = +pollster.polls;
        pollster.callsCellPhones = pollster.callsCellPhones === "yes";
        pollster.banned = pollster.banned === "yes";
        delete pollster.ncpp_aapor_roper;
        delete pollster.id;
    }
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
        if (!responses.find(r => r.choice === "Clinton")) return false;
        if (!responses.find(r => r.choice === "Trump")) return false;
        return true; 
    };

    const default_moe = 5.0; // MAGIC NUMBER
    const default_n = 600; // MAGIC NUMBER

    for (let poll of polls) {
        // data cleanup
        poll.date = new Date(poll.start_date);
        delete poll.affiliation;
        delete poll.last_updated;
        delete poll.end_date;
        delete poll.start_date;
        delete poll.pollster;
        delete poll.method;
        delete poll.source;
        delete poll.id;

        // remove questions we don't care about
        let questions = poll.questions.filter(q => isPresidentialPoll(q));
        let question = questions[0];
        if (!question) {
            delete poll;
            continue;
        }
        if (questions.length > 1) 
            console.log(`EXTRA QUESIONTS: ${JSON.stringify(questions)}`);
        if (question.subpopulations.length > 1) 
            console.log(`EXTRA SUBPOPULATIONS: ${JSON.stringify(question.subpopulations)}`);
        delete poll.questions;
        // remove extraneous data
        poll.moe = question.subpopulations[0].margin_of_error || default_moe;
        poll.type = question.subpopulations[0].name;
        poll.n = question.subpopulations[0].observations || default_n;
        poll.state = question.state;
        let responses  = question.subpopulations[0].responses;

        let dem = responses.find(r => r.party == "Dem").value;
        let gop = responses.find(r => r.party == "Rep").value;

        poll.gap = (dem - gop) / (dem + gop); // normalize to 0-1, and assume undecideds split the same way
        // add undecideds/3rd party to MOE
        poll.moe += (100 - (dem + gop)) * 0.07; // MAGIC NUMBER 
    }
}

function weightPolls(polls) {
    const base_n = Math.log(600);
    const likelyVoterAdj = -0.011; // RV surveys less representative MAGIC NUMBER
    const biasBuffer = 0.01; // ignore biases less than this amount MAGIC NUMBER

    let rv_avg = 0;
    let n_rv = 0;
    let lv_avg = 0;
    let n_lv = 0;

    for (let poll of polls) {
        let dateDiff = (Date.now() - poll.date) / one_day;
        let recencyWeight = 0.7 * Math.exp(-dateDiff / 30) + 0.3; // MAGIC NUMBERS

        let sampleWeight = Math.log(poll.n) / base_n; 

        let pollsters = getPollsterAverages(poll.survey_houses);
        let pollsterRating = Math.exp(-pollsters.plusMinus);

        let partisanWeight = poll.partisan === "Nonpartisan" ? 1 : 0.9; // MAGIC NUMBERS
        let typeWeight = poll.type === "Likely Voters" ? 1 : 0.8; // MAGIC NUMBERS

        poll.weight = recencyWeight * sampleWeight * pollsterRating
            * partisanWeight;

        let bias = pollsters.meanBias;
        let biasAdj = bias - Math.sign(bias) * biasBuffer;
        if (Math.abs(bias) < biasBuffer)
            biasAdj = 0;

        // if not an LV poll, apply adjustment
        let typeAdj = poll.type === "Likely Voters" ? 0 : likelyVoterAdj;

        // stats on registered vs likely voter polls
        if (poll.type === "Likely Voters") {
            lv_avg += poll.gap;
            n_lv++;
        } else {
            rv_avg += poll.gap;
            n_rv++;
        }

        poll.gap += biasAdj + typeAdj;
    }

    // calculate average and turn into percent
    lv_avg /= 0.01 * n_lv || 1;
    rv_avg /= 0.01 * n_rv || 1;
    console.log(`RV/LV average bias: ${(lv_avg - rv_avg).toFixed(3)}%`);
}

function getPollsterAverages(surveyors) {
    let pollster = {
        plusMinus: 0,
        meanBias: 0,
    };

    let total = surveyors.length;

    for (let surveyor of surveyors) {
        // find pollster with closest name
        let name = surveyor.name;
        let matchedPollster = pollsters.reduce((p, c) => {
            let distanceC = levenshtein.get(c.pollster, name);
            let distanceP = levenshtein.get(p.pollster, name);
            return distanceC < distanceP ? c : p;
        });

        pollster.plusMinus += matchedPollster.predictivePlusMinus / total / 100; 
        pollster.meanBias += matchedPollster.meanRevertedBias / total / 100; 
    }

    return pollster;
}

function add2012Data(data2012, polls, avgs) {
    let weight = 0.4;

    // adjust 2012 results by adding in the shift since then
    let gap2012 = 0.5107 - 0.4715;
    let gapAdj = avgs.national - gap2012;

    for (let i = 0; i < 51; i++) {
        polls.push({
            state: abbrs[i],
            moe: 0.5, 
            gap: data2012[i].gap + gapAdj,
            n: +data2012[i].totalVoters,
            weight,
        });
    }
}

function calculateAverages() {
    let US_average = 0;
    let state_averages = Array(51).fill(0);

    let US_var = 0;
    let state_var = Array(51).fill(0);
    let US_total_n = 0;
    let state_total_n = Array(51).fill(0);

    let n_us_polls = 0;
    let n_state_polls = 0;
    let us_weight = 0;
    let weights = Array(51).fill(0);

    for (let poll of polls) {
        if (poll.state === "US") {
           US_average += poll.gap * poll.weight;
           US_var += Math.pow(poll.moe / 1.96, 2) * (poll.n - 1); // assuming pollsters using 95% confidence interval
           US_total_n += poll.n - 1;
           us_weight += poll.weight;
           n_us_polls++;
        } else {
            let index = abbrs.indexOf(poll.state);
            state_averages[index] += poll.gap * poll.weight;
            state_var[index] += Math.pow(poll.moe / 1.96, 2) * (poll.n - 1);
            state_total_n[index] += poll.n - 1;
            weights[index] += poll.weight;
            n_state_polls += 1 / 51;
        }
    }

    US_average /= us_weight;
    state_averages = state_averages.map((a, i) => a / weights[i]);
    state_var = state_var.map((a, i) => 0.01 * a * date_multiplier / state_total_n[i]);
    US_var *= 0.01 * date_multiplier / US_total_n;

    // update mix based on poll counts
    mix = Math.pow(n_state_polls / (n_state_polls + n_us_polls), 0.025); // MAGIC NUMBER
    console.log(`State/National mix: ${mix.toFixed(2)}`);

    return {
        national: US_average,
        national_var: US_var,
        national_stddev: Math.sqrt(US_var),
        state: state_averages,
        state_var,
    };
}

function modelState(index, nationalShift) {
    nationalShift *= averages.national_var;

    let expected = mix * averages.state[index] + (1 - mix) * averages.national;
    let variance = mix * averages.state_var[index] + (1 - mix) * averages.national_var;

    let mean = expected + nationalShift;
    let gap = gaussian(mean, variance).ppf(Math.random());

    let dem = 0.5 + gap / 2;
    let gop = 0.5 - gap / 2;
    
    return {
        dem,
        gop,
    };
}


module.exports = {
    init,
    modelState,
};
