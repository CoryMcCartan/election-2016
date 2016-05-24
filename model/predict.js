let gaussian = require("gaussian");
let loader = require("./loader.js")
let levenshtein = require('fast-levenshtein');

const one_day = 1000 * 60 * 60 * 24;
const untilElection = (new Date(2016, 11, 8) - Date.now()) / one_day;

const date_multiplier = 1 / (1 - untilElection / 365);
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

    add2012Data(data2012, polls);

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
        if (!name.includes("president") && !name.includes("general election")) return false;
        if (name.includes("primary")) return false;
        if (name.includes("caucus")) return false;
        return true; 
    };

    const default_moe = 5.0;

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
        let question = poll.questions.find(q => isPresidentialPoll(q));
        if (!question) {
            delete poll;
            continue;
        }
        delete poll.questions;
        // remove extraneous data
        poll.moe = question.subpopulations[0].margin_of_error || default_moe;
        poll.type = question.subpopulations[0].name;
        poll.n = question.subpopulations[0].observations;
        poll.state = question.state;
        let responses  = question.subpopulations[0].responses;

        let dem = responses.find(r => r.party == "Dem").value;
        let gop = responses.find(r => r.party == "Rep").value;

        poll.gap = (dem - gop) / 100;
    }
}

function weightPolls(polls) {
    const base_n = Math.log(600);
    const likelyVoterAdj = -0.027; // RV surveys favor Dems by 2.7 pts
    const biasBuffer = 0.005; // ignore biases less than this amount

    for (let poll of polls) {
        let dateDiff = (Date.now() - poll.date) / one_day;
        let recencyWeight = 0.7 * Math.exp(-dateDiff / 30) + 0.3;

        let sampleWeight = Math.log(poll.n) / base_n; 

        let pollsters = getPollsterAverages(poll.survey_houses);
        let pollsterRating = Math.exp(-pollsters.plusMinus);

        let partisanWeight = poll.partisan === "Nonpartisan" ? 1 : 0.9;

        poll.weight = recencyWeight * sampleWeight * pollsterRating
            * partisanWeight;

        let bias = pollsters.meanBias;
        let biasAdj = bias - Math.sign(bias) * biasBuffer;
        if (Math.abs(bias) < biasBuffer)
            biasAdj = 0;

        let typeAdj = poll.type === "Likely Voters" ? 0 : likelyVoterAdj;

        poll.gap += biasAdj + typeAdj;
    }
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

function add2012Data(data2012, polls) {
    let weight = 0.1;

    for (let i = 0; i < 51; i++) {
        polls.push({
            state: abbrs[i],
            moe: 0.00,
            gap: data2012[i].gap,
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
           US_var += Math.pow(poll.moe / 1.96, 2) * (poll.n - 1);
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
    mix = Math.pow(n_state_polls / (n_state_polls + n_us_polls), 0.2);

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
