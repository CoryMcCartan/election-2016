let fetch = require("node-fetch");
let csv = require("fast-csv");
let util = require("./util.js");


function get2014Election() {
    let data2014 = [];
    
    return new Promise((resolve, reject) => {
        csv.fromPath("data/2014.csv", {headers: true})
        .on("data", d => data2014.push(d))
        .on("end", () => {
            util.sortByKey(data2014, "abbr");
            resolve(data2014);
        })
        .on("error", reject);
    });
}

function getPollsterRatings() {
    let pollsters = [];

    return new Promise((resolve, reject) => {
        // load pollster ratings
        csv.fromPath("data/pollster-ratings.csv", {
            headers: true,
        })
        .on("data", d => pollsters.push(d))
        .on("end", () => {
            resolve(pollsters);
        })
        .on("error", reject);
    });
}

function getPolls(topicName, date) {
    let month = ("0" + (date.getMonth() + 1)).slice(-2);
    let day = ("0" + date.getDate()).slice(-2);
    let datestr = `${date.getFullYear()}-${month}-${day}`;
    let makeURL = n => `http://elections.huffingtonpost.com/pollster/api/` + 
        `polls.json?page=${n+1}&chart=${topicName}&before=${datestr}`;

    let promises = [];
    //          get     10*n    polls
    for (let i = 0; i < 6; i++) {
        promises[i] = fetch(makeURL(i)).then(t => t.json());
    }

    // wait until all data is fetched
    return new Promise((resolve, reject) => {
        Promise.all(promises).then((values) => {
            // flatten
            let polls = values.reduce((p, c) => p.concat(c));
            resolve(polls);
        });
    });
}

module.exports = {
    get2014Election,
    getPollsterRatings,
    getPolls,
};
