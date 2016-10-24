/*
 * 2016 PRESIDENTIAL ELECTION PREDICTIONS
 * Polling fetcher
 *
 * © 2016 Cory McCartan
 */

let fetch = require("node-fetch");
let touch = require("touch");
let csv = require("fast-csv");
const path = require("path");
let async = require("./async.js");
require("./states.js")(global);

let LOG;

function * getNewPolls(topic, log=false) {
    LOG = log;
    const filename = path.join(__dirname, "../data/polls-2012.csv");

    console.log("Fetching polls...");

    let makeURL = n => `http://elections.huffingtonpost.com/pollster/api/` + 
        `polls.json?page=${n+1}&topic=${topic}`;

    let pollsters = yield getPollsterRatings();
    let averagePollster = processPollsterData(pollsters);

    let polls = yield getPollList(filename);
    let mostRecentID = Math.max(...polls.map(p => p.id));

    // get new pages of polls back unti the most recent one we currently have
    let maxNewPolls = 1400;
    let count = 0;
    let exit = false;
    for (let i = 0; i < ~~(maxNewPolls / 10); i++) {
        let recent = yield fetch(makeURL(i)).then(t => t.json());

        let index = recent.findIndex(p => p.id === mostRecentID);
        if (index !== -1) {
            recent = recent.slice(0, index);
            exit = true;
        }

        recent = formatPolls(recent);
        weightPolls(recent, pollsters, averagePollster);
        count += recent.length;
        polls.push(...recent);

        if (exit) break; // reached the end; not all polls used
    }

    csv.writeToPath(filename, polls, {headers: true});
    console.log(`${count} new polls fetched and parsed.`);

    return polls;
}

function formatPolls(polls) {
    // defaults for polls that don't specify
    const default_moe = 5.0;
    const default_n = 400; 

    for (let poll of polls) {
        let start = +(new Date(poll.start_date));
        let end = +(new Date(poll.end_date));
        poll.date = new Date((start + end) / 2);

        poll.partisan = poll.partisan.toLowerCase() !== "nonpartisan";
        delete poll.affiliation;
        delete poll.last_updated;
        delete poll.end_date;
        delete poll.start_date;
        delete poll.pollster;
        delete poll.source;
        delete poll.sponsors;

        let questions = poll.questions.filter(q => isPresidentialPoll(q));
        // include gary johnson if possible
        let question = questions.find(q => q.subpopulations[0].responses.find(r => 
                                     r.choice.toLowerCase().includes("johnson")))
                                     || questions[0];
        if (!question) {
            let str = poll.questions.map(q => q.subpopulations[0].responses 
                        .map(r => r.choice).join("/")).join(" | ");
            log(`NO MATCHING QUESTIONS: ${str}`);
            continue;
        }
        delete poll.questions;


        // find which poll to use
        let index = question.subpopulations.findIndex(s => {
            let type = s.name.toLowerCase();
            return type === "registered voters" || type === "likely voters";
        });
        if (index < 0) index = 0;

        poll.moe = question.subpopulations[index].margin_of_error || default_moe;
        poll.type = question.subpopulations[index].name.toLowerCase();
        poll.n = question.subpopulations[index].observations || default_n;
        poll.state = question.state;

        if (!poll.state) {
            let questionName = question.name.toLowerCase();

            for (let j = 0; j < 51; j++) {
                let name = stateFromAbbr[abbrs[j]].toLowerCase(); 

                if (questionName.includes(name + " ")) {
                    poll.state = abbrs[j];
                    if (LOG) console.log(`NO STATE: ${questionName}\n${poll.state}\n`);
                    break;
                }
            }
        }

        poll.survey_houses = poll.survey_houses.map(s => s.name).join("|").trim();

        let responses  = question.subpopulations[index].responses;

        poll.dem = responses.find(r => r.choice.toLowerCase().includes("obama")).value / 100;
        poll.gop = responses.find(r => r.choice.toLowerCase().includes("romney")).value / 100;
        poll.lib = (responses.find(r => r.choice.toLowerCase().includes("johnson")) 
                   || {value: -100}).value / 100; // use negative val. as flag for no 3rd party

        // split undecideds evenly
        poll.undecided = (responses.find(r => r.choice.toLowerCase().includes("undecided")) 
            || {value: 100*(1 - poll.dem - poll.gop - (poll.lib === -1 ? 0: poll.lib))}).value / 100;

        poll.gap = poll.dem - poll.gop;
    }

    polls = polls.filter(p => "gap" in p); // valid data, not skipped

    return polls;
} 

function weightPolls(polls, pollsterRatings, averagePollster) {
    const base_n = Math.log(600);
    const biasBuffer = 0.005; // ignore biases less than this amount MAGIC NUMBER

    for (let poll of polls) {
        let pollsters = getPollsterAverages(poll.survey_houses.split("|"), 
                                poll.method, pollsterRatings, averagePollster);
        let pollsterRating = Math.exp(-pollsters.plusMinus);

        let partisanWeight = poll.partisan ? 0.5 : 1.0; // MAGIC NUMBERS

        let typeWeight = 0;
        if (poll.type === "likely voters")
            typeWeight = 1;
        else if (poll.type === "registered voters")
            typeWeight = 0.75;
        else if (poll.type === "adults")
            typeWeight = 0.4;
        else
            log("Other type: " + poll.type)

        poll.weight = 10 * pollsterRating * partisanWeight * typeWeight; 

        let bias = pollsters.meanBias;
        let biasAdj = bias - Math.sign(bias) * biasBuffer;
        if (Math.abs(bias) < biasBuffer)
            biasAdj = 0;

        poll.dem -= biasAdj;
        poll.gop += biasAdj;

        // log poll
        log(
            `POLL: ${(poll.survey_houses + "                     ").substring(0, 20)}\t` +
            `DATE: ${poll.date.toLocaleDateString()}  \t` + 
            `STATE: ${poll.state}\t` + 
            `WEIGHT: ${poll.weight.toFixed(2)}\t` + 
            `GAP: ${(100 * poll.gap).toFixed(2)}%\t` +
            `ADJUSTMENT: ${(-100 * biasAdj).toFixed(2)}%`
        );
    }
}

/*
 * Ensure a given poll is asking the right question
 */
function isPresidentialPoll(poll) {
    if (poll.name === null) return false;
    let name = poll.name.toLowerCase();

    if (!name.includes("president") 
        && !name.includes("general election")
    && !name.includes("ge")) return false;
    if (name.includes("primary")) return false;
    if (name.includes("caucus")) return false;

    if (!poll.subpopulations.length) return false;
    let responses = poll.subpopulations[0].responses;

    if (!responses.find(r => r.choice.toLowerCase().includes("obama"))) return false;
    if (!responses.find(r => r.choice.toLowerCase().includes("romney"))) return false;

    return true; 
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

        avgPredictive += pollster.predictivePlusMinus;
    }

    averagePollster = {
        pollster: "AVERAGE",
        predictivePlusMinus: avgPredictive / length + 2.0, // assume worse than average b/c unknown
        meanRevertedBias: 0,
    };

    return averagePollster;
}

function getPollsterAverages(surveyors, method, pollsters, averagePollster) {
    let pollster = {
        plusMinus: 0,
        meanBias: 0,
        banned: false,
    };

    let total = surveyors.length;

    for (let name of surveyors) {
        // find pollster with closest name
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

function getPollList(filename) {
    let polls = [];
    touch.sync(filename);
    
    return new Promise((resolve, reject) => {
        csv.fromPath(filename, {headers: true})
        .on("data", d => polls.push(d))
        .on("end", () => {
            resolve(polls);
        })
        .on("error", reject);
    });
}

function getPollsterRatings() {
    let pollsters = [];
    const filename = path.join(__dirname, "../data/pollster-ratings.csv");

    return new Promise((resolve, reject) => {
        // load pollster ratings
        csv.fromPath(filename, {
            headers: true,
        })
        .on("data", d => pollsters.push(d))
        .on("end", () => {
            resolve(pollsters);
        })
        .on("error", reject);
    });
}

function log(txt) {
    if (LOG) console.log(txt);
}


if (require.main === module) // called directly as a script
    async.run(getNewPolls.bind(this, "2012-president", true)); 
else
    module.exports = {
        getNewPolls,
    };
