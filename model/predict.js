let gaussian = require("gaussian");
let loader = require("./loader.js")

let LOG;

const one_day = 1000 * 60 * 60 * 24;
const untilElection = (new Date(2016, 11, 8) - Date.now()) / one_day;

const date_multiplier = Math.exp(1.5 * untilElection / 281);  // MAGIC NUMBER (from Iowa Caucuses to Election Day)

let data2012;
let polls;
let pollsters;
let averagePollster;

let averages;

const topicName = "2016-president";

function * init(log) { 
    LOG = log;

    data2012 = yield loader.get2012Election();
    processElection(data2012);

    pollsters = yield loader.getPollsterRatings();
    processPollsterData(pollsters);

    polls = yield loader.getPolls(topicName);
    processPolls(polls);

    weightPolls(polls);

    let pollAverages = calculateAverages(false);
    add2012Data(data2012, polls, pollAverages);


    averages = calculateAverages(LOG);
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
        pollster.polls = +pollster.polls;
        pollster.callsCellPhones = pollster.callsCellPhones === "yes";
        pollster.banned = pollster.banned === "yes";
        delete pollster.ncpp_aapor_roper;
        delete pollster.id;

        avgPredictive += pollster.meanRevertedBias;
    }

    averagePollster = {
        pollster: "AVERAGE",
        predictivePlusMinus: avgPredictive / length + 0.5, // assume slightly worse than average b/c unknown
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

    const default_moe = 3.0; // MAGIC NUMBER
    const default_n = 600; // MAGIC NUMBER

    for (let poll of polls) {
        // data cleanup
        poll.date = new Date(poll.start_date);
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
                console.log(`EXTRA SUBPOPULATIONS: ${JSON.stringify(question.subpopulations)}`);
        }

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
        poll.moe += (100 - (dem + gop)) * 0.5; // MAGIC NUMBER 
    }
}

function weightPolls(polls) {
    const base_n = Math.log(600);
    const regVoterBias = +0.017; // MAGIC NUMBER
    const likelyVoterBias = -0.000; // MAGIC NUMBER
    const biasBuffer = 0.01; // ignore biases less than this amount MAGIC NUMBER

    let rv_avg = 0;
    let n_rv = 0;
    let lv_avg = 0;
    let n_lv = 0;

    for (let poll of polls) {
        let dateDiff = (Date.now() - poll.date) / one_day;
        let recencyWeight;
        if (poll.state === "US") // more US polls, so recency is less important
            recencyWeight = Math.exp(-dateDiff / 30); // MAGIC NUMBER
        else // fewer state polls, so more recent means more accurate
            recencyWeight = Math.exp(-dateDiff / 15); // MAGIC NUMBER

        let sampleWeight = Math.log(poll.n) / base_n; 

        let pollsters = getPollsterAverages(poll.survey_houses, poll.method);
        if (pollsters.banned) {
            if (LOG) console.log("Deleted poll — pollster banned.");
            delete poll;
            continue;
        }
        let pollsterRating = Math.exp(-pollsters.plusMinus);

        let partisanWeight = poll.partisan === "Nonpartisan" ? 1 : 0.8; // MAGIC NUMBERS
        let typeWeight = poll.type === "Likely Voters" ? 1 : 0.8; // MAGIC NUMBERS

        poll.weight = recencyWeight * sampleWeight * pollsterRating
            * partisanWeight;

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
    }

    // calculate average and turn into percent
    lv_avg /= 0.01 * n_lv || 1;
    rv_avg /= 0.01 * n_rv || 1;
    console.log(`RV/LV average bias: ${(lv_avg - rv_avg).toFixed(3)}%`);
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
            } else if (name.includes("Opinion Research Corporation")) {
                matched = pollsters.find(p => p.pollster.includes("Opinion Research Corp."));
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
    let weight = 0.05; // MAGIC NUMBER

    // adjust 2012 results by adding in the shift since then
    let gap2012 = 0.5107 - 0.4715;
    let gapAdj = avgs.national - gap2012;
    if (LOG) console.log(`Shift since 2012: ${(100 * gapAdj).toFixed(2)}%`);

    let moe_multiplier = Math.sqrt(avgs.national_var) * 1.96 * 100;

    for (let i = 0; i < 51; i++) {
        let state = data2012[i];

        polls.push({
            state: abbrs[i],
            moe: (1 + Math.abs(state.gap)) * moe_multiplier,
            gap: state.gap + (1 - Math.abs(state.gap)) * gapAdj, // shift applies more in closer states
            n: +state.totalVoters,
            weight,
        });

        // predict 2016 turnout
        state.turnout2016 = state.population_2015 / state.population * state.totalVoters;
    }
}

function calculateAverages(LOG) {
    let US_average = 0;
    let state_averages = Array(51).fill(0);

    let US_var = 0;
    let state_var = Array(51).fill(0);
    let US_total_n = 0;
    let state_total_n = Array(51).fill(0);

    let n_us_polls = 0;
    let n_state_polls = Array(51).fill(0);
    let us_weight = 0;
    let weights = Array(51).fill(0);

    for (let poll of polls) {
        if (poll.state === "US") {
           US_average += poll.gap * poll.weight;
           US_var += Math.pow(0.01 * poll.moe / 1.96, 2) * (poll.n - 1); // assuming pollsters use 95% interval
           US_total_n += poll.n - 1;
           us_weight += poll.weight;
           n_us_polls++;
        } else {
            let index = abbrs.indexOf(poll.state);
            state_averages[index] += poll.gap * poll.weight;
            state_var[index] += Math.pow(0.01 * poll.moe / 1.96, 2) * (poll.n - 1);
            state_total_n[index] += poll.n - 1;
            weights[index] += poll.weight;
            n_state_polls[index]++;
        }
    }

    US_average /= us_weight;
    state_averages = state_averages.map((a, i) => a / weights[i]);
    state_var = state_var.map((a, i) => a 
                              * date_multiplier 
                              * (0.9 + 1 / n_state_polls[i]) // fewer polls => more uncertainty
                              / state_total_n[i]);
    US_var *= date_multiplier * (1 + 1 / n_us_polls) / US_total_n;

    if (LOG) {
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
    };
}

function modelState(index, nationalShift) {
    nationalShift *= averages.national_var; 

    let variance = averages.state_var[index];

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
