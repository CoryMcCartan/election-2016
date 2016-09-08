/*
 * 2016 PRESIDENTIAL ELECTION PREDICTIONS
 * Polling fetcher
 *
 * © 2016 Cory McCartan
 */

let fetch = require("node-fetch");
let touch = require("touch");
let csv = require("fast-csv");
let async = require("./async.js");
require("./states.js");

// get new polls
// format new polls
// add new polls to list
// export polls

let LOG;

function * getNewPolls(topic, log=false) {
    LOG = log;
    const filename = "data/polls.csv";

    let makeURL = n => `http://elections.huffingtonpost.com/pollster/api/` + 
        `polls.json?page=${n+1}&topic=${topic}`;

    let polls = yield getPollList(filename);
    let mostRecentID = Math.max(...polls.map(p => p.id));

    // get new pages of polls back unti the most recent one we currently have
    let maxNewPolls = 600;
    for (let i = 0; i < ~~(maxNewPolls / 10); i++) {
        let recent = yield fetch(makeURL(i)).then(t => t.json());
        formatPolls(recent);

        let index = recent.findIndex(p => p.id === mostRecentID);
        if (index !== -1) { 
            polls.push(recent.slice(0, index));
            break;
        } else {
            polls.push(recent);
        }
    }

    csv.writeToPath(filename, polls, {headers: true});

    return polls;
}

function formatPolls(polls) {
    // defaults for polls that don't specify
    const default_moe = 5.0;
    const default_n = 400; 

    for (let poll of polls) {
        let start = +(new Date(poll.start_date));
        let end = +(new Date(poll.end_date));
        poll.date = (start + end) / 2;

        poll.partisan = poll.partisan.toLowerCase !== "nonpartisan";
        delete poll.affiliation;
        delete poll.last_updated;
        delete poll.end_date;
        delete poll.start_date;
        delete poll.pollster;
        delete poll.source;

        let questions = poll.questions.filter(q => isPresidentialPoll(q));
        let question = questions[0];

        if (LOG) {
            let str = questions.map(q => q.subpopulations[0].responses
                    .map(r => r.last_name).join("/")).join(" | ");

            if (!question)
                console.log(`NO MATCHING QUESTIONS: ${str}`);
            if (questions.length > 1) 
                console.log(`EXTRA QUESTIONS: ${str}`);
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

        let responses  = question.subpopulations[index].responses;

        poll.dem = responses.find(r => r.choice.toLowerCase().includes("clinton")).value;
        poll.gop = responses.find(r => r.choice.toLowerCase().includes("trump")).value;

        // split undecideds evenly
        let undecided = (responses.find(r => r.choice.toLowerCase().includes("undecided")) 
            || {value: 0.5*Math.abs(poll.dem - poll.gop)}).value;
        poll.dem += undecided / 2;
        poll.gop += undecided / 2;
    }

    return polls;
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

    if (responses.find(r => r.choice.toLowerCase().includes("bloomberg"))) return false;
    if (!responses.find(r => r.choice.toLowerCase().includes("clinton"))) return false;
    if (!responses.find(r => r.choice.toLowerCase().includes("trump"))) return false;

    return true; 
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


if (require.main === module) // called directly as a script
    async.run(getNewPolls.bind(this, "2016-president")); 
else
    module.exports = {
        getNewPolls,
    };
